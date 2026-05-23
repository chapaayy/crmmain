import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, DocumentType, Prisma, TimelineEventType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDocumentDto, GenerateOrderDocumentDto } from "./dto/document.dto";
import { DocumentQueryDto } from "./dto/document-query.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

const customerSelect = {
  id: true,
  name: true,
  companyName: true,
  phone: true,
  email: true,
  inn: true,
  kpp: true,
  legalAddress: true,
  deliveryAddress: true
} satisfies Prisma.CustomerSelect;

const fileAssetSelect = {
  id: true,
  key: true,
  originalName: true,
  mimeType: true,
  size: true,
  url: true,
  createdAt: true
} satisfies Prisma.FileAssetSelect;

const documentSelect = {
  id: true,
  type: true,
  number: true,
  title: true,
  status: true,
  orderId: true,
  customerId: true,
  leadId: true,
  paymentId: true,
  fileAssetId: true,
  issuedAt: true,
  expiresAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      number: true,
      total: true,
      currency: true,
      paymentStatus: true,
      customer: {
        select: customerSelect
      }
    }
  },
  customer: {
    select: customerSelect
  },
  lead: {
    select: {
      id: true,
      title: true,
      phone: true,
      email: true
    }
  },
  payment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      method: true,
      paidAt: true
    }
  },
  fileAsset: {
    select: fileAssetSelect
  }
} satisfies Prisma.DocumentSelect;

type DocumentPayload = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;
const orderDocumentSelect = {
  id: true,
  number: true,
  customerId: true,
  currency: true,
  subtotal: true,
  discount: true,
  tax: true,
  total: true,
  paidAmount: true,
  paymentStatus: true,
  customer: {
    select: customerSelect
  },
  items: {
    where: { deletedAt: null },
    select: {
      sku: true,
      name: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      discount: true,
      total: true
    },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.OrderSelect;
type OrderDocumentPayload = Prisma.OrderGetPayload<{ select: typeof orderDocumentSelect }>;

interface CompanySettings {
  profile: Record<string, string>;
  requisites: Record<string, string>;
}

interface DocumentFile {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async list(query: DocumentQueryDto) {
    const where = this.buildWhere(query);
    const [total, documents] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        select: documentSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: documents.map((document) => this.serializeDocument(document)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateDocumentDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const refs = await this.resolveReferences(tx, dto);
      const number = nullableString(dto.number) ?? (await this.nextDocumentNumber(tx, dto.type));
      const title = nullableString(dto.title) ?? defaultDocumentTitle(dto.type, number);
      const company = await this.getCompanySettings(tx);
      const lines = this.genericDocumentLines(dto.type, number, title, company, refs, dto.metadata);
      const file = await this.writeDocumentFile(dto.type, number, lines);

      const document = await this.createDocumentWithFile(tx, {
        type: dto.type,
        number,
        title,
        status: nullableString(dto.status) ?? "READY",
        orderId: refs.orderId,
        customerId: refs.customerId,
        leadId: refs.leadId,
        paymentId: refs.paymentId,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
        file,
        actorId
      });

      await this.addTimeline(tx, document, actorId, "Document created");
      await this.audit(tx, actorId, AuditAction.CREATE, "Document", document.id, undefined, document);

      return document;
    });

    return { document: this.serializeDocument(result) };
  }

  async get(id: string) {
    return { document: this.serializeDocument(await this.requireDocument(this.prisma, id)) };
  }

  async delete(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.requireDocument(tx, id);
      const deletedAt = new Date();

      await tx.document.update({
        where: { id },
        data: {
          deletedAt,
          updatedById: actorId
        }
      });

      if (before.fileAssetId) {
        await tx.fileAsset.update({
          where: { id: before.fileAssetId },
          data: {
            deletedAt,
            updatedById: actorId
          }
        });
      }

      await this.addTimeline(tx, before, actorId, "Document deleted");
      await this.audit(tx, actorId, AuditAction.DELETE, "Document", id, before);
    });

    return { success: true };
  }

  async generateInvoice(orderId: string, dto: GenerateOrderDocumentDto, actorId: string) {
    return this.generateOrderDocument(orderId, DocumentType.INVOICE, dto, actorId);
  }

  async generateCommercialOffer(orderId: string, dto: GenerateOrderDocumentDto, actorId: string) {
    return this.generateOrderDocument(orderId, DocumentType.COMMERCIAL_OFFER, dto, actorId);
  }

  async getDownload(id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        number: true,
        fileAsset: {
          select: {
            originalName: true,
            mimeType: true,
            path: true,
            deletedAt: true
          }
        }
      }
    });

    if (!document?.fileAsset || document.fileAsset.deletedAt) {
      throw new NotFoundException("Document file not found");
    }

    try {
      await stat(document.fileAsset.path);
    } catch {
      throw new NotFoundException("Document file is missing from uploads");
    }

    return {
      path: document.fileAsset.path,
      filename: document.fileAsset.originalName || `${document.title || document.number || document.id}.pdf`,
      mimeType: document.fileAsset.mimeType
    };
  }

  private async generateOrderDocument(orderId: string, type: DocumentType.INVOICE | DocumentType.COMMERCIAL_OFFER, dto: GenerateOrderDocumentDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrderForDocument(tx, orderId);
      const number = await this.nextDocumentNumber(tx, type);
      const title = nullableString(dto.title) ?? defaultDocumentTitle(type, number);
      const company = await this.getCompanySettings(tx);
      const lines = this.orderDocumentLines(type, number, title, company, order, dto.metadata);
      const file = await this.writeDocumentFile(type, number, lines);
      const document = await this.createDocumentWithFile(tx, {
        type,
        number,
        title,
        status: "READY",
        orderId: order.id,
        customerId: order.customerId,
        issuedAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
        file,
        actorId
      });

      await this.addTimeline(tx, document, actorId, type === DocumentType.INVOICE ? "Invoice generated" : "Commercial offer generated");
      await this.audit(tx, actorId, AuditAction.CREATE, "Document", document.id, undefined, document);

      return document;
    });

    return { document: this.serializeDocument(result) };
  }

  private buildWhere(query: DocumentQueryDto): Prisma.DocumentWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      createdAt.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      createdAt.lte = new Date(query.dateTo);
    }

    return {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.paymentId ? { paymentId: query.paymentId } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { title: { contains: query.search, mode: "insensitive" } },
              { order: { number: { contains: query.search, mode: "insensitive" } } },
              { customer: { name: { contains: query.search, mode: "insensitive" } } },
              { customer: { companyName: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async createDocumentWithFile(
    tx: Prisma.TransactionClient,
    input: {
      type: DocumentType;
      number: string;
      title: string;
      status: string;
      orderId?: string;
      customerId?: string;
      leadId?: string;
      paymentId?: string;
      issuedAt: Date;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
      file: DocumentFile;
      actorId: string;
    }
  ) {
    const fileAsset = await tx.fileAsset.create({
      data: {
        key: input.file.key,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        size: input.file.size,
        path: input.file.path,
        createdById: input.actorId,
        updatedById: input.actorId
      },
      select: {
        id: true
      }
    });
    const created = await tx.document.create({
      data: {
        type: input.type,
        number: input.number,
        title: input.title,
        status: input.status,
        orderId: input.orderId,
        customerId: input.customerId,
        leadId: input.leadId,
        paymentId: input.paymentId,
        fileAssetId: fileAsset.id,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
        createdById: input.actorId,
        updatedById: input.actorId
      },
      select: {
        id: true
      }
    });

    await tx.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        url: `/documents/${created.id}/download`
      }
    });

    return tx.document.findUniqueOrThrow({
      where: { id: created.id },
      select: documentSelect
    });
  }

  private async resolveReferences(tx: Prisma.TransactionClient, dto: CreateDocumentDto) {
    let orderId = nullableString(dto.orderId);
    let customerId = nullableString(dto.customerId);
    const leadId = nullableString(dto.leadId);
    const paymentId = nullableString(dto.paymentId);

    if (paymentId) {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, deletedAt: null },
        select: {
          id: true,
          orderId: true,
          order: {
            select: {
              customerId: true
            }
          }
        }
      });

      if (!payment) {
        throw new BadRequestException("Payment not found");
      }

      if (orderId && orderId !== payment.orderId) {
        throw new BadRequestException("Payment belongs to another order");
      }

      orderId = payment.orderId;
      customerId = customerId ?? payment.order.customerId;
    }

    if (orderId) {
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        select: {
          id: true,
          customerId: true
        }
      });

      if (!order) {
        throw new BadRequestException("Order not found");
      }

      if (customerId && customerId !== order.customerId) {
        throw new BadRequestException("Order belongs to another customer");
      }

      customerId = order.customerId;
    }

    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true }
      });

      if (!customer) {
        throw new BadRequestException("Customer not found");
      }
    }

    if (leadId) {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, deletedAt: null },
        select: { id: true }
      });

      if (!lead) {
        throw new BadRequestException("Lead not found");
      }
    }

    return {
      orderId,
      customerId,
      leadId,
      paymentId
    };
  }

  private async requireOrderForDocument(tx: Prisma.TransactionClient, id: string) {
    const order = await tx.order.findFirst({
      where: { id, deletedAt: null },
      select: orderDocumentSelect
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  private async nextDocumentNumber(tx: Prisma.TransactionClient, type: DocumentType) {
    const settings = await this.getDocumentNumbering(tx);
    const now = new Date();
    const year = now.getFullYear();
    const yearlyReset = booleanValue(settings.yearlyReset, true);
    const startFrom = numberValue(settings.startFrom, 1);
    const prefix = prefixForType(type, settings);
    const count = await tx.document.count({
      where: {
        type,
        deletedAt: null,
        ...(yearlyReset ? { createdAt: { gte: new Date(year, 0, 1) } } : {})
      }
    });

    return `${prefix}-${year}-${String(startFrom + count).padStart(4, "0")}`;
  }

  private async getDocumentNumbering(client: DbClient) {
    const row = await client.setting.findFirst({
      where: {
        namespace: "crm",
        key: "documentNumbering",
        deletedAt: null
      },
      select: {
        value: true
      }
    });

    return isRecord(row?.value) ? row.value : {};
  }

  private async getCompanySettings(client: DbClient): Promise<CompanySettings> {
    const rows = await client.setting.findMany({
      where: {
        namespace: "crm",
        key: { in: ["companyProfile", "requisites"] },
        deletedAt: null
      },
      select: {
        key: true,
        value: true
      }
    });
    const settings = Object.fromEntries(rows.map((row) => [row.key, isRecord(row.value) ? row.value : {}]));

    return {
      profile: {
        name: stringValue(settings.companyProfile, "name", this.configService.get<string>("COMPANY_NAME") ?? "Company"),
        shortName: stringValue(settings.companyProfile, "shortName", this.configService.get<string>("COMPANY_SHORT_NAME") ?? ""),
        phone: stringValue(settings.companyProfile, "phone", this.configService.get<string>("COMPANY_PHONE") ?? ""),
        email: stringValue(settings.companyProfile, "email", this.configService.get<string>("COMPANY_EMAIL") ?? ""),
        website: stringValue(settings.companyProfile, "website", this.configService.get<string>("COMPANY_WEBSITE") ?? ""),
        address: stringValue(settings.companyProfile, "address", this.configService.get<string>("COMPANY_ADDRESS") ?? "")
      },
      requisites: {
        inn: stringValue(settings.requisites, "inn", this.configService.get<string>("COMPANY_INN") ?? ""),
        kpp: stringValue(settings.requisites, "kpp", this.configService.get<string>("COMPANY_KPP") ?? ""),
        ogrn: stringValue(settings.requisites, "ogrn", this.configService.get<string>("COMPANY_OGRN") ?? ""),
        bankName: stringValue(settings.requisites, "bankName", this.configService.get<string>("COMPANY_BANK_NAME") ?? ""),
        bik: stringValue(settings.requisites, "bik", this.configService.get<string>("COMPANY_BIK") ?? ""),
        account: stringValue(settings.requisites, "account", this.configService.get<string>("COMPANY_ACCOUNT") ?? ""),
        correspondentAccount: stringValue(
          settings.requisites,
          "correspondentAccount",
          this.configService.get<string>("COMPANY_CORRESPONDENT_ACCOUNT") ?? ""
        )
      }
    };
  }

  private genericDocumentLines(
    type: DocumentType,
    number: string,
    title: string,
    company: CompanySettings,
    refs: { orderId?: string; customerId?: string; leadId?: string; paymentId?: string },
    metadata?: Record<string, unknown>
  ) {
    return compactLines([
      title,
      `Number: ${number}`,
      `Type: ${type}`,
      `Issued: ${new Date().toLocaleDateString("ru-RU")}`,
      "",
      ...companyLines(company),
      "",
      refs.orderId ? `Order ID: ${refs.orderId}` : undefined,
      refs.customerId ? `Customer ID: ${refs.customerId}` : undefined,
      refs.leadId ? `Lead ID: ${refs.leadId}` : undefined,
      refs.paymentId ? `Payment ID: ${refs.paymentId}` : undefined,
      metadata ? `Metadata: ${JSON.stringify(metadata)}` : undefined
    ]);
  }

  private orderDocumentLines(
    type: DocumentType,
    number: string,
    title: string,
    company: CompanySettings,
    order: OrderDocumentPayload,
    metadata?: Record<string, unknown>
  ) {
    const customerName = order.customer.companyName || order.customer.name;

    return compactLines([
      title,
      `Number: ${number}`,
      `Order: ${order.number}`,
      `Issued: ${new Date().toLocaleDateString("ru-RU")}`,
      "",
      ...companyLines(company),
      "",
      `Customer: ${customerName}`,
      order.customer.inn ? `Customer INN: ${order.customer.inn}` : undefined,
      order.customer.kpp ? `Customer KPP: ${order.customer.kpp}` : undefined,
      order.customer.legalAddress ? `Legal address: ${order.customer.legalAddress}` : undefined,
      "",
      "Items:",
      ...order.items.flatMap((item, index) => [
        `${index + 1}. ${item.sku} ${item.name}`,
        `   Qty: ${formatQuantity(item.quantity)} ${item.unit}; Price: ${formatMoney(item.unitPrice)} ${order.currency}; Total: ${formatMoney(item.total)} ${order.currency}`
      ]),
      "",
      `Subtotal: ${formatMoney(order.subtotal)} ${order.currency}`,
      `Discount: ${formatMoney(order.discount)} ${order.currency}`,
      `Tax: ${formatMoney(order.tax)} ${order.currency}`,
      `Total: ${formatMoney(order.total)} ${order.currency}`,
      type === DocumentType.INVOICE ? `Paid: ${formatMoney(order.paidAmount)} ${order.currency}; Payment status: ${order.paymentStatus}` : undefined,
      metadata ? `Metadata: ${JSON.stringify(metadata)}` : undefined
    ]);
  }

  private async writeDocumentFile(type: DocumentType, number: string, lines: string[]): Promise<DocumentFile> {
    const root = this.configService.get<string>("UPLOADS_DIR") ?? path.join(process.cwd(), "uploads");
    const month = new Date().toISOString().slice(0, 7);
    const directory = path.join(root, "documents", month);
    const safeName = `${type.toLowerCase()}-${number}-${randomUUID().slice(0, 8)}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");
    const fullPath = path.join(directory, safeName);
    const key = `documents/${month}/${safeName}`;
    const buffer = createPdfBuffer(lines);

    await mkdir(directory, { recursive: true });
    await writeFile(fullPath, buffer);

    return {
      key,
      originalName: safeName,
      mimeType: "application/pdf",
      size: buffer.length,
      path: fullPath
    };
  }

  private async requireDocument(client: DbClient, id: string): Promise<DocumentPayload> {
    const document = await client.document.findFirst({
      where: { id, deletedAt: null },
      select: documentSelect
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return document;
  }

  private addTimeline(tx: Prisma.TransactionClient, document: Pick<DocumentPayload, "orderId" | "customerId" | "leadId" | "title">, actorId: string, title: string) {
    return tx.timelineEvent.create({
      data: {
        orderId: document.orderId ?? undefined,
        customerId: document.customerId ?? undefined,
        leadId: document.leadId ?? undefined,
        actorId,
        type: TimelineEventType.FILE_UPLOADED,
        title,
        description: document.title
      }
    });
  }

  private serializeDocument(document: DocumentPayload) {
    return document;
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    before?: unknown,
    after?: unknown
  ) {
    return tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        before: before === undefined ? undefined : sanitizeJson(before),
        after: after === undefined ? undefined : sanitizeJson(after)
      }
    });
  }
}

function prefixForType(type: DocumentType, settings: Record<string, unknown>) {
  const fallback: Record<DocumentType, string> = {
    INVOICE: "INV",
    COMMERCIAL_OFFER: "CO",
    DELIVERY_NOTE: "DN",
    ACT: "ACT",
    CONTRACT: "CON"
  };
  const settingKey: Record<DocumentType, string> = {
    INVOICE: "invoicePrefix",
    COMMERCIAL_OFFER: "commercialOfferPrefix",
    DELIVERY_NOTE: "deliveryNotePrefix",
    ACT: "actPrefix",
    CONTRACT: "contractPrefix"
  };
  const configured = settings[settingKey[type]];

  return typeof configured === "string" && configured.trim() ? configured.trim().toUpperCase() : fallback[type];
}

function defaultDocumentTitle(type: DocumentType, number: string) {
  const labels: Record<DocumentType, string> = {
    INVOICE: "Invoice",
    COMMERCIAL_OFFER: "Commercial offer",
    DELIVERY_NOTE: "Delivery note",
    ACT: "Act",
    CONTRACT: "Contract"
  };

  return `${labels[type]} ${number}`;
}

function companyLines(company: CompanySettings) {
  return compactLines([
    `Company: ${company.profile.name}`,
    company.profile.address ? `Address: ${company.profile.address}` : undefined,
    company.profile.phone ? `Phone: ${company.profile.phone}` : undefined,
    company.profile.email ? `Email: ${company.profile.email}` : undefined,
    company.requisites.inn ? `INN: ${company.requisites.inn}` : undefined,
    company.requisites.kpp ? `KPP: ${company.requisites.kpp}` : undefined,
    company.requisites.ogrn ? `OGRN: ${company.requisites.ogrn}` : undefined,
    company.requisites.bankName ? `Bank: ${company.requisites.bankName}` : undefined,
    company.requisites.bik ? `BIK: ${company.requisites.bik}` : undefined,
    company.requisites.account ? `Account: ${company.requisites.account}` : undefined,
    company.requisites.correspondentAccount ? `Corr. account: ${company.requisites.correspondentAccount}` : undefined
  ]);
}

function createPdfBuffer(rawLines: string[]) {
  const lines = rawLines.flatMap((line) => wrapLine(line || " ", 94)).slice(0, 65);
  const body = [
    "BT",
    "/F1 10 Tf",
    "50 800 Td",
    "14 TL",
    ...lines.flatMap((line, index) => [`(${escapePdfText(line)}) Tj`, index === lines.length - 1 ? "" : "T*"]).filter(Boolean),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

function wrapLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const parts: string[] = [];
  let rest = normalized;

  while (rest.length > maxLength) {
    const slice = rest.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf(" "), Math.floor(maxLength * 0.75));
    parts.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }

  if (rest) {
    parts.push(rest);
  }

  return parts;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function compactLines(lines: Array<string | undefined>) {
  return lines.filter((line): line is string => line !== undefined);
}

function stringValue(record: unknown, key: string, fallback: string) {
  if (!isRecord(record)) {
    return fallback;
  }

  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: Prisma.Decimal | number | string | null | undefined) {
  return decimalToNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuantity(value: Prisma.Decimal | number | string | null | undefined) {
  return decimalToNumber(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function nullableString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
