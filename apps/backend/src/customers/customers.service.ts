import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, CustomerStatus, CustomerType, LeadStatus, Prisma, TimelineEventType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/comment.dto";
import { CreateCustomerContactDto, UpdateCustomerContactDto } from "./dto/customer-contact.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";

const managerSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: {
    select: managerSelect
  }
} satisfies Prisma.CommentSelect;

const timelineSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  payload: true,
  occurredAt: true,
  createdAt: true,
  actor: {
    select: managerSelect
  }
} satisfies Prisma.TimelineEventSelect;

const contactSelect = {
  id: true,
  customerId: true,
  firstName: true,
  lastName: true,
  fullName: true,
  position: true,
  phone: true,
  email: true,
  isPrimary: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CustomerContactSelect;

const customerListSelect = {
  id: true,
  code: true,
  type: true,
  name: true,
  companyName: true,
  inn: true,
  kpp: true,
  ogrn: true,
  legalAddress: true,
  deliveryAddress: true,
  phone: true,
  email: true,
  messengers: true,
  source: true,
  segment: true,
  website: true,
  address: true,
  notes: true,
  status: true,
  ownerId: true,
  owner: {
    select: managerSelect
  },
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      contacts: true,
      orders: true,
      comments: true
    }
  }
} satisfies Prisma.CustomerSelect;

const customerDetailSelect = {
  ...customerListSelect,
  contacts: {
    where: { deletedAt: null },
    select: contactSelect,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }]
  },
  comments: {
    where: { deletedAt: null },
    select: commentSelect,
    orderBy: { createdAt: "desc" },
    take: 20
  },
  events: {
    where: { deletedAt: null },
    select: timelineSelect,
    orderBy: { occurredAt: "desc" },
    take: 30
  }
} satisfies Prisma.CustomerSelect;

type CustomerPayload = Prisma.CustomerGetPayload<{ select: typeof customerDetailSelect }>;
type CustomerListPayload = Prisma.CustomerGetPayload<{ select: typeof customerListSelect }>;
type ContactPayload = Prisma.CustomerContactGetPayload<{ select: typeof contactSelect }>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: CustomerQueryDto) {
    const where = this.buildWhere(query);
    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: customerListSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: customers.map((customer) => this.serializeCustomer(customer)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateCustomerDto, actorId: string) {
    await this.ensureNoDuplicate({
      phone: dto.phone,
      email: dto.email,
      inn: dto.inn
    });
    await this.ensureManagerExists(dto.responsibleManagerId);

    const customer = await this.prisma.customer.create({
      data: this.toCreateData(dto, actorId),
      select: customerDetailSelect
    });

    await this.createTimeline(customer.id, actorId, TimelineEventType.CREATED, "Customer created", customer.name);
    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "Customer",
      entityId: customer.id,
      after: sanitizeJson(this.serializeCustomer(customer))
    });

    return { customer: this.serializeCustomer(customer) };
  }

  async get(id: string) {
    return { customer: this.serializeCustomer(await this.requireCustomer(id)) };
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const before = await this.requireCustomer(id);

    await this.ensureNoDuplicate(
      {
        phone: dto.phone,
        email: dto.email,
        inn: dto.inn
      },
      id
    );
    await this.ensureManagerExists(dto.responsibleManagerId);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: this.toUpdateData(dto, actorId),
      select: customerDetailSelect
    });

    await this.createTimeline(id, actorId, TimelineEventType.UPDATED, "Customer updated", customer.name);
    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Customer",
      entityId: id,
      before: sanitizeJson(this.serializeCustomer(before)),
      after: sanitizeJson(this.serializeCustomer(customer))
    });

    return { customer: this.serializeCustomer(customer) };
  }

  async delete(id: string, actorId: string) {
    const before = await this.requireCustomer(id);

    await this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CustomerStatus.ARCHIVED,
        updatedById: actorId
      }
    });

    await this.createTimeline(id, actorId, TimelineEventType.UPDATED, "Customer archived", before.name);
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "Customer",
      entityId: id,
      before: sanitizeJson(this.serializeCustomer(before))
    });

    return { success: true };
  }

  async createContact(customerId: string, dto: CreateCustomerContactDto, actorId: string) {
    await this.requireCustomer(customerId);

    const contact = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, deletedAt: null },
          data: { isPrimary: false, updatedById: actorId }
        });
      }

      return tx.customerContact.create({
        data: {
          customerId,
          fullName: cleanRequired(dto.fullName, "Contact name"),
          firstName: cleanOptional(dto.firstName),
          lastName: cleanOptional(dto.lastName),
          position: cleanOptional(dto.position),
          phone: normalizePhone(dto.phone),
          email: normalizeEmail(dto.email),
          isPrimary: dto.isPrimary ?? false,
          notes: cleanOptional(dto.notes),
          createdById: actorId,
          updatedById: actorId
        },
        select: contactSelect
      });
    });

    await this.createTimeline(customerId, actorId, TimelineEventType.CREATED, "Contact added", contact.fullName);
    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "CustomerContact",
      entityId: contact.id,
      after: sanitizeJson(contact)
    });

    return { contact };
  }

  async updateContact(customerId: string, contactId: string, dto: UpdateCustomerContactDto, actorId: string) {
    await this.requireCustomer(customerId);
    const before = await this.requireContact(customerId, contactId);

    const contact = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, id: { not: contactId }, deletedAt: null },
          data: { isPrimary: false, updatedById: actorId }
        });
      }

      return tx.customerContact.update({
        where: { id: contactId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: cleanRequired(dto.fullName, "Contact name") } : {}),
          ...(dto.firstName !== undefined ? { firstName: cleanOptional(dto.firstName) } : {}),
          ...(dto.lastName !== undefined ? { lastName: cleanOptional(dto.lastName) } : {}),
          ...(dto.position !== undefined ? { position: cleanOptional(dto.position) } : {}),
          ...(dto.phone !== undefined ? { phone: normalizePhone(dto.phone) } : {}),
          ...(dto.email !== undefined ? { email: normalizeEmail(dto.email) } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.notes !== undefined ? { notes: cleanOptional(dto.notes) } : {}),
          updatedById: actorId
        },
        select: contactSelect
      });
    });

    await this.createTimeline(customerId, actorId, TimelineEventType.UPDATED, "Contact updated", contact.fullName);
    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "CustomerContact",
      entityId: contactId,
      before: sanitizeJson(before),
      after: sanitizeJson(contact)
    });

    return { contact };
  }

  async deleteContact(customerId: string, contactId: string, actorId: string) {
    await this.requireCustomer(customerId);
    const before = await this.requireContact(customerId, contactId);

    await this.prisma.customerContact.update({
      where: { id: contactId },
      data: {
        deletedAt: new Date(),
        isPrimary: false,
        updatedById: actorId
      }
    });

    await this.createTimeline(customerId, actorId, TimelineEventType.UPDATED, "Contact deleted", before.fullName);
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "CustomerContact",
      entityId: contactId,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async timeline(customerId: string) {
    await this.requireCustomer(customerId);
    const [events, comments] = await Promise.all([
      this.prisma.timelineEvent.findMany({
        where: { customerId, deletedAt: null },
        select: timelineSelect,
        orderBy: { occurredAt: "desc" }
      }),
      this.prisma.comment.findMany({
        where: { customerId, deletedAt: null },
        select: commentSelect,
        orderBy: { createdAt: "desc" }
      })
    ]);

    return {
      timeline: [
        ...events.map((event) => ({ kind: "event" as const, ...event })),
        ...comments.map((comment) => ({
          kind: "comment" as const,
          id: comment.id,
          type: TimelineEventType.COMMENTED,
          title: "Comment",
          description: comment.body,
          occurredAt: comment.createdAt,
          createdAt: comment.createdAt,
          actor: comment.author
        }))
      ].sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime())
    };
  }

  async addComment(customerId: string, dto: CreateCommentDto, actorId: string) {
    const customer = await this.requireCustomer(customerId);
    const comment = await this.prisma.comment.create({
      data: {
        customerId,
        authorId: actorId,
        body: cleanRequired(dto.body, "Comment")
      },
      select: commentSelect
    });

    await this.createTimeline(customerId, actorId, TimelineEventType.COMMENTED, "Comment added", comment.body);
    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "CustomerComment",
      entityId: comment.id,
      after: sanitizeJson(comment)
    });

    this.publishCommentEvent([customer.ownerId], customerId, comment.id, customer.name);

    return { comment };
  }

  private buildWhere(query: CustomerQueryDto): Prisma.CustomerWhereInput {
    return {
      deletedAt: null,
      ...(query.managerId ? { ownerId: query.managerId } : {}),
      ...(query.source ? { source: { equals: query.source, mode: "insensitive" } } : {}),
      ...(query.segment ? { segment: { equals: query.segment, mode: "insensitive" } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { companyName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { inn: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private async requireCustomer(id: string): Promise<CustomerPayload> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: customerDetailSelect
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  private async requireContact(customerId: string, contactId: string): Promise<ContactPayload> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId, deletedAt: null },
      select: contactSelect
    });

    if (!contact) {
      throw new NotFoundException("Customer contact not found");
    }

    return contact;
  }

  private async ensureNoDuplicate(fields: { phone?: string; email?: string; inn?: string }, exceptId?: string) {
    const phone = normalizePhone(fields.phone);
    const email = normalizeEmail(fields.email);
    const inn = normalizeInn(fields.inn);
    const OR: Prisma.CustomerWhereInput[] = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : []),
      ...(inn ? [{ inn }] : [])
    ];

    if (OR.length === 0) {
      return;
    }

    const duplicate = await this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR
      },
      select: { id: true, name: true, phone: true, email: true, inn: true }
    });

    if (duplicate) {
      throw new ConflictException("Customer with this phone, email, or INN already exists");
    }

    const leadOR: Prisma.LeadWhereInput[] = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : [])
    ];

    if (leadOR.length > 0) {
      const duplicateLead = await this.prisma.lead.findFirst({
        where: {
          deletedAt: null,
          customerId: null,
          status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
          OR: leadOR
        },
        select: { id: true, title: true, phone: true, email: true }
      });

      if (duplicateLead) {
        throw new ConflictException("Open lead with this phone or email already exists");
      }
    }
  }

  private async ensureManagerExists(managerId?: string) {
    if (!managerId) {
      return;
    }

    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, isActive: true, deletedAt: null },
      select: { id: true }
    });

    if (!manager) {
      throw new BadRequestException("Responsible manager not found");
    }
  }

  private toCreateData(dto: CreateCustomerDto, actorId: string): Prisma.CustomerUncheckedCreateInput {
    const name = cleanRequired(dto.name, "Customer name");

    return {
      code: `CUST-${Date.now()}`,
      type: dto.type ?? CustomerType.COMPANY,
      name,
      companyName: cleanOptional(dto.companyName),
      inn: normalizeInn(dto.inn),
      kpp: cleanOptional(dto.kpp),
      ogrn: cleanOptional(dto.ogrn),
      legalAddress: cleanOptional(dto.legalAddress),
      deliveryAddress: cleanOptional(dto.deliveryAddress),
      phone: normalizePhone(dto.phone),
      email: normalizeEmail(dto.email),
      messengers: dto.messengers ?? [],
      source: cleanOptional(dto.source),
      segment: cleanOptional(dto.segment),
      notes: cleanOptional(dto.notes),
      status: dto.status ?? CustomerStatus.ACTIVE,
      ownerId: dto.responsibleManagerId,
      createdById: actorId,
      updatedById: actorId
    };
  }

  private toUpdateData(dto: UpdateCustomerDto, actorId: string): Prisma.CustomerUncheckedUpdateInput {
    const data: Prisma.CustomerUncheckedUpdateInput = {
      updatedById: actorId
    };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "type", dto.type);
    assignIfDefined(writable, "name", dto.name, (value) => cleanRequired(value, "Customer name"));
    assignIfDefined(writable, "companyName", dto.companyName, cleanOptional);
    assignIfDefined(writable, "inn", dto.inn, normalizeInn);
    assignIfDefined(writable, "kpp", dto.kpp, cleanOptional);
    assignIfDefined(writable, "ogrn", dto.ogrn, cleanOptional);
    assignIfDefined(writable, "legalAddress", dto.legalAddress, cleanOptional);
    assignIfDefined(writable, "deliveryAddress", dto.deliveryAddress, cleanOptional);
    assignIfDefined(writable, "phone", dto.phone, normalizePhone);
    assignIfDefined(writable, "email", dto.email, normalizeEmail);
    assignIfDefined(writable, "messengers", dto.messengers, (value) => value);
    assignIfDefined(writable, "source", dto.source, cleanOptional);
    assignIfDefined(writable, "segment", dto.segment, cleanOptional);
    assignIfDefined(writable, "ownerId", dto.responsibleManagerId, cleanOptional);
    assignIfDefined(writable, "notes", dto.notes, cleanOptional);
    assignIfDefined(writable, "status", dto.status);

    return data;
  }

  private serializeCustomer(customer: CustomerPayload | CustomerListPayload) {
    return {
      ...customer,
      responsibleManagerId: customer.ownerId,
      responsibleManager: customer.owner,
      owner: undefined,
      ownerId: undefined
    };
  }

  private createTimeline(customerId: string, actorId: string, type: TimelineEventType, title: string, description?: string) {
    return this.prisma.timelineEvent.create({
      data: {
        customerId,
        actorId,
        type,
        title,
        description
      }
    });
  }

  private publishCommentEvent(userIds: Array<string | null | undefined>, customerId: string, commentId: string, customerName: string) {
    void this.notificationsService
      .createForUsers(userIds, {
        event: "comment.created",
        title: "Comment added",
        body: customerName,
        data: {
          entityType: "CUSTOMER",
          customerId,
          commentId
        }
      })
      .catch(() => undefined);
  }
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function cleanRequired(value: string | undefined, field: string) {
  const normalized = cleanOptional(value);

  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }

  return normalized;
}

function cleanOptional(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | null | undefined) {
  return cleanOptional(value)?.toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  const normalized = cleanOptional(value);
  return normalized ? normalized.replace(/[^\d+]/g, "") : undefined;
}

function normalizeInn(value: string | null | undefined) {
  const normalized = cleanOptional(value);
  return normalized ? normalized.replace(/\D/g, "") : undefined;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
