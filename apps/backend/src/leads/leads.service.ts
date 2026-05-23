import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, CustomerStatus, CustomerType, LeadStatus, Prisma, TimelineEventType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "../customers/dto/comment.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";

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

const leadListSelect = {
  id: true,
  number: true,
  title: true,
  phone: true,
  email: true,
  status: true,
  source: true,
  interestedProducts: true,
  customerId: true,
  contactId: true,
  assignedToId: true,
  assignedTo: {
    select: managerSelect
  },
  estimatedValue: true,
  currency: true,
  expectedCloseAt: true,
  nextContactAt: true,
  convertedAt: true,
  lostReason: true,
  comment: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.LeadSelect;

const leadDetailSelect = {
  ...leadListSelect,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      inn: true
    }
  },
  contact: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true
    }
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
} satisfies Prisma.LeadSelect;

type LeadPayload = Prisma.LeadGetPayload<{ select: typeof leadDetailSelect }>;
type LeadListPayload = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: LeadQueryDto) {
    const where = this.buildWhere(query);
    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        select: leadListSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: leads.map((lead) => this.serializeLead(lead)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateLeadDto, actorId: string) {
    await this.ensureNoDuplicate({ phone: dto.phone, email: dto.email });
    await this.ensureNoCustomerDuplicate({ phone: dto.phone, email: dto.email });
    await this.ensureManagerExists(dto.responsibleManagerId);

    const lead = await this.prisma.lead.create({
      data: this.toCreateData(dto, actorId),
      select: leadDetailSelect
    });

    await this.createTimeline(lead.id, actorId, TimelineEventType.CREATED, "Lead created", lead.title);
    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "Lead",
      entityId: lead.id,
      after: sanitizeJson(this.serializeLead(lead))
    });

    return { lead: this.serializeLead(lead) };
  }

  async get(id: string) {
    return { lead: this.serializeLead(await this.requireLead(id)) };
  }

  async update(id: string, dto: UpdateLeadDto, actorId: string) {
    const before = await this.requireLead(id);

    await this.ensureNoDuplicate({ phone: dto.phone, email: dto.email }, id);
    await this.ensureNoCustomerDuplicate({ phone: dto.phone, email: dto.email }, before.customerId ?? undefined);
    await this.ensureManagerExists(dto.responsibleManagerId);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: this.toUpdateData(dto, actorId),
      select: leadDetailSelect
    });
    const type = dto.status && dto.status !== before.status ? TimelineEventType.STATUS_CHANGED : TimelineEventType.UPDATED;
    const title = type === TimelineEventType.STATUS_CHANGED ? `Lead status changed to ${dto.status}` : "Lead updated";

    await this.createTimeline(id, actorId, type, title, lead.title);
    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Lead",
      entityId: id,
      before: sanitizeJson(this.serializeLead(before)),
      after: sanitizeJson(this.serializeLead(lead))
    });

    return { lead: this.serializeLead(lead) };
  }

  async delete(id: string, actorId: string) {
    const before = await this.requireLead(id);

    await this.prisma.lead.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: actorId
      }
    });

    await this.createTimeline(id, actorId, TimelineEventType.UPDATED, "Lead deleted", before.title);
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "Lead",
      entityId: id,
      before: sanitizeJson(this.serializeLead(before))
    });

    return { success: true };
  }

  async convertToCustomer(id: string, actorId: string) {
    const lead = await this.requireLead(id);

    if (lead.convertedAt || lead.customerId) {
      throw new BadRequestException("Lead is already converted");
    }

    await this.ensureNoCustomerDuplicate({
      phone: lead.phone ?? undefined,
      email: lead.email ?? undefined
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          code: `CUST-${Date.now()}`,
          type: CustomerType.COMPANY,
          name: lead.title,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          notes: lead.comment ?? lead.notes,
          status: CustomerStatus.ACTIVE,
          ownerId: lead.assignedToId,
          createdById: actorId,
          updatedById: actorId
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          source: true,
          ownerId: true,
          createdAt: true
        }
      });
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          customerId: customer.id,
          convertedAt: new Date(),
          status: LeadStatus.WON,
          updatedById: actorId
        },
        select: leadDetailSelect
      });

      await tx.timelineEvent.create({
        data: {
          leadId: id,
          customerId: customer.id,
          actorId,
          type: TimelineEventType.STATUS_CHANGED,
          title: "Lead converted to customer",
          description: customer.name
        }
      });

      return { customer, lead: updatedLead };
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "LeadConversion",
      entityId: id,
      after: sanitizeJson(result)
    });

    return {
      customer: result.customer,
      lead: this.serializeLead(result.lead)
    };
  }

  async addComment(leadId: string, dto: CreateCommentDto, actorId: string) {
    const lead = await this.requireLead(leadId);
    const comment = await this.prisma.comment.create({
      data: {
        leadId,
        authorId: actorId,
        body: cleanRequired(dto.body, "Comment")
      },
      select: commentSelect
    });

    await this.createTimeline(leadId, actorId, TimelineEventType.COMMENTED, "Comment added", comment.body);
    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "LeadComment",
      entityId: comment.id,
      after: sanitizeJson(comment)
    });

    this.publishCommentEvent([lead.assignedToId], leadId, comment.id, lead.title);

    return { comment };
  }

  private buildWhere(query: LeadQueryDto): Prisma.LeadWhereInput {
    return {
      deletedAt: null,
      ...(query.managerId ? { assignedToId: query.managerId } : {}),
      ...(query.source ? { source: { equals: query.source, mode: "insensitive" } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { source: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private async requireLead(id: string): Promise<LeadPayload> {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      select: leadDetailSelect
    });

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    return lead;
  }

  private async ensureNoDuplicate(fields: { phone?: string | null; email?: string | null }, exceptId?: string) {
    const phone = normalizePhone(fields.phone);
    const email = normalizeEmail(fields.email);
    const OR: Prisma.LeadWhereInput[] = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : [])
    ];

    if (OR.length === 0) {
      return;
    }

    const duplicate = await this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException("Lead with this phone or email already exists");
    }
  }

  private async ensureNoCustomerDuplicate(fields: { phone?: string | null; email?: string | null }, exceptCustomerId?: string) {
    const phone = normalizePhone(fields.phone);
    const email = normalizeEmail(fields.email);
    const OR: Prisma.CustomerWhereInput[] = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : [])
    ];

    if (OR.length === 0) {
      return;
    }

    const duplicate = await this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        ...(exceptCustomerId ? { id: { not: exceptCustomerId } } : {}),
        OR
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException("Customer with this phone or email already exists");
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

  private toCreateData(dto: CreateLeadDto, actorId: string): Prisma.LeadUncheckedCreateInput {
    return {
      number: `LEAD-${Date.now()}`,
      title: cleanRequired(dto.name, "Lead name"),
      phone: normalizePhone(dto.phone),
      email: normalizeEmail(dto.email),
      source: cleanOptional(dto.source),
      status: dto.status ?? LeadStatus.NEW,
      interestedProducts: dto.interestedProducts ?? [],
      assignedToId: dto.responsibleManagerId,
      nextContactAt: dto.nextContactAt ? new Date(dto.nextContactAt) : undefined,
      expectedCloseAt: dto.nextContactAt ? new Date(dto.nextContactAt) : undefined,
      comment: cleanOptional(dto.comment),
      notes: cleanOptional(dto.comment),
      estimatedValue: dto.estimatedValue === undefined ? undefined : new Prisma.Decimal(dto.estimatedValue),
      createdById: actorId,
      updatedById: actorId
    };
  }

  private toUpdateData(dto: UpdateLeadDto, actorId: string): Prisma.LeadUncheckedUpdateInput {
    const data: Prisma.LeadUncheckedUpdateInput = {
      updatedById: actorId
    };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.name, (value) => cleanRequired(value, "Lead name"));
    assignIfDefined(writable, "phone", dto.phone, normalizePhone);
    assignIfDefined(writable, "email", dto.email, normalizeEmail);
    assignIfDefined(writable, "source", dto.source, cleanOptional);
    assignIfDefined(writable, "status", dto.status);
    assignIfDefined(writable, "interestedProducts", dto.interestedProducts, (value) => value);
    assignIfDefined(writable, "assignedToId", dto.responsibleManagerId, cleanOptional);
    assignIfDefined(writable, "nextContactAt", dto.nextContactAt, (value) => new Date(value));
    assignIfDefined(writable, "expectedCloseAt", dto.nextContactAt, (value) => new Date(value));
    assignIfDefined(writable, "comment", dto.comment, cleanOptional);
    assignIfDefined(writable, "notes", dto.comment, cleanOptional);
    assignIfDefined(writable, "estimatedValue", dto.estimatedValue, (value) => new Prisma.Decimal(value));

    return data;
  }

  private serializeLead(lead: LeadPayload | LeadListPayload) {
    return {
      ...lead,
      name: lead.title,
      responsibleManagerId: lead.assignedToId,
      responsibleManager: lead.assignedTo,
      title: undefined,
      assignedToId: undefined,
      assignedTo: undefined
    };
  }

  private createTimeline(leadId: string, actorId: string, type: TimelineEventType, title: string, description?: string) {
    return this.prisma.timelineEvent.create({
      data: {
        leadId,
        actorId,
        type,
        title,
        description
      }
    });
  }

  private publishCommentEvent(userIds: Array<string | null | undefined>, leadId: string, commentId: string, leadTitle: string) {
    void this.notificationsService
      .createForUsers(userIds, {
        event: "comment.created",
        title: "Comment added",
        body: leadTitle,
        data: {
          entityType: "LEAD",
          leadId,
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

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
