import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, ResponsibilityAssignmentRole, ResponsibilityInstructionFormat, ResponsibilityStatus, RoleCode } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssignResponsibilityDto,
  CreateResponsibilityChecklistItemDto,
  CreateResponsibilityDto,
  CreateResponsibilityInstructionDto,
  UpdateResponsibilityChecklistItemDto,
  UpdateResponsibilityDto,
  UpdateResponsibilityInstructionDto
} from "./dto/responsibility.dto";
import { ResponsibilityQueryDto } from "./dto/responsibility-query.dto";

const userSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const employeeSummarySelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  position: true,
  department: true,
  userId: true
} satisfies Prisma.EmployeeProfileSelect;

const assignmentSelect = {
  id: true,
  responsibilityId: true,
  employeeId: true,
  userId: true,
  role: true,
  assignedById: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: employeeSummarySelect },
  user: { select: userSelect },
  assignedBy: { select: userSelect }
} satisfies Prisma.ResponsibilityAssignmentSelect;

const instructionSelect = {
  id: true,
  responsibilityId: true,
  title: true,
  content: true,
  format: true,
  version: true,
  isActive: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect }
} satisfies Prisma.ResponsibilityInstructionSelect;

const checklistSelect = {
  id: true,
  responsibilityId: true,
  title: true,
  description: true,
  sortOrder: true,
  isRequired: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ResponsibilityChecklistItemSelect;

const taskSummarySelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  assignedToId: true,
  assigneeEmployeeId: true,
  assignedTo: { select: userSelect },
  assigneeEmployee: { select: employeeSummarySelect }
} satisfies Prisma.TaskSelect;

const secretSummarySelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  url: true,
  username: true,
  login: true,
  phone: true,
  email: true,
  responsibilityId: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SecretVaultItemSelect;

const responsibilitySelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  status: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  ownerUser: { select: userSelect },
  ownerEmployee: { select: employeeSummarySelect },
  createdBy: { select: userSelect },
  assignments: {
    select: assignmentSelect,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  },
  instructions: {
    select: instructionSelect,
    orderBy: [{ isActive: "desc" }, { version: "desc" }, { updatedAt: "desc" }]
  },
  checklistItems: {
    select: checklistSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  tasks: {
    where: { deletedAt: null },
    select: taskSummarySelect,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
  },
  secrets: {
    where: { deletedAt: null },
    select: secretSummarySelect,
    orderBy: { createdAt: "desc" }
  },
  _count: {
    select: {
      assignments: true,
      instructions: true,
      checklistItems: true,
      tasks: true,
      secrets: true
    }
  }
} satisfies Prisma.ResponsibilitySelect;

type ResponsibilityPayload = Prisma.ResponsibilityGetPayload<{ select: typeof responsibilitySelect }>;

interface ActorAccess {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  employeeId?: string;
  userId: string;
}

@Injectable()
export class ResponsibilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(query: ResponsibilityQueryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermissionAny(access, ["responsibilities.read", "responsibilities.create", "responsibilities.update", "responsibilities.assign"]);
    const where = this.applyResponsibilityScope(access, this.buildWhere(query));
    const [total, data] = await Promise.all([
      this.prisma.responsibility.count({ where }),
      this.prisma.responsibility.findMany({
        where,
        select: responsibilitySelect,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data: data.map(serializeResponsibility), meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async create(dto: CreateResponsibilityDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.create");
    const owner = await this.resolveOwner(dto.ownerUserId, dto.ownerEmployeeId);
    const responsibility = await this.prisma.responsibility.create({
      data: {
        title: requiredString(dto.title, "Responsibility title"),
        description: nullableString(dto.description),
        category: nullableString(dto.category),
        status: dto.status ?? ResponsibilityStatus.ACTIVE,
        ownerUserId: owner.userId,
        ownerEmployeeId: owner.employeeId,
        createdById: actorId
      },
      select: responsibilitySelect
    });

    if (owner.userId || owner.employeeId) {
      await this.prisma.responsibilityAssignment.create({
        data: {
          responsibilityId: responsibility.id,
          userId: owner.userId,
          employeeId: owner.employeeId,
          role: ResponsibilityAssignmentRole.OWNER,
          assignedById: actorId
        }
      });
    }

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "Responsibility",
      entityId: responsibility.id,
      after: sanitizeJson(serializeResponsibility(responsibility))
    });

    return { responsibility: serializeResponsibility(await this.requireResponsibility(responsibility.id)) };
  }

  async get(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermissionAny(access, ["responsibilities.read", "responsibilities.update", "responsibilities.assign"]);
    const responsibility = await this.requireResponsibility(id);
    this.ensureCanViewResponsibility(access, responsibility);
    return { responsibility: serializeResponsibility(responsibility) };
  }

  async update(id: string, dto: UpdateResponsibilityDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.update");
    const before = await this.requireResponsibility(id);
    const data: Prisma.ResponsibilityUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Responsibility title"));
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "category", dto.category, nullableString);
    assignIfDefined(writable, "status", dto.status);

    if (dto.ownerUserId !== undefined || dto.ownerEmployeeId !== undefined) {
      const owner = await this.resolveOwner(dto.ownerUserId, dto.ownerEmployeeId);
      data.ownerUserId = owner.userId;
      data.ownerEmployeeId = owner.employeeId;
    }

    const responsibility = await this.prisma.responsibility.update({
      where: { id },
      data,
      select: responsibilitySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Responsibility",
      entityId: id,
      before: sanitizeJson(serializeResponsibility(before)),
      after: sanitizeJson(serializeResponsibility(responsibility))
    });

    return { responsibility: serializeResponsibility(responsibility) };
  }

  async delete(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.delete");
    const before = await this.requireResponsibility(id);
    await this.prisma.responsibility.update({
      where: { id },
      data: { deletedAt: new Date(), status: ResponsibilityStatus.ARCHIVED }
    });
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "Responsibility",
      entityId: id,
      before: sanitizeJson(serializeResponsibility(before))
    });

    return { success: true };
  }

  async assign(id: string, dto: AssignResponsibilityDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.assign");
    const before = await this.requireResponsibility(id);
    const assignmentTarget = await this.resolveOwner(dto.userId, dto.employeeId);

    if (!assignmentTarget.userId && !assignmentTarget.employeeId) {
      throw new BadRequestException("employeeId or userId is required");
    }

    const assignment = await this.prisma.responsibilityAssignment.create({
      data: {
        responsibilityId: id,
        userId: assignmentTarget.userId,
        employeeId: assignmentTarget.employeeId,
        role: dto.role ?? ResponsibilityAssignmentRole.PARTICIPANT,
        assignedById: actorId
      },
      select: assignmentSelect
    });

    if ((dto.role ?? ResponsibilityAssignmentRole.PARTICIPANT) === ResponsibilityAssignmentRole.OWNER) {
      await this.prisma.responsibility.update({
        where: { id },
        data: {
          ownerUserId: assignmentTarget.userId,
          ownerEmployeeId: assignmentTarget.employeeId
        }
      });
    }

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ResponsibilityAssignment",
      entityId: assignment.id,
      before: sanitizeJson(serializeResponsibility(before)),
      after: sanitizeJson(assignment)
    });

    return { assignment };
  }

  async deleteAssignment(responsibilityId: string, assignmentId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.assign");
    const assignment = await this.prisma.responsibilityAssignment.findFirst({
      where: { id: assignmentId, responsibilityId },
      select: assignmentSelect
    });

    if (!assignment) {
      throw new NotFoundException("Responsibility assignment not found");
    }

    await this.prisma.responsibilityAssignment.delete({ where: { id: assignmentId } });
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "ResponsibilityAssignment",
      entityId: assignmentId,
      before: sanitizeJson(assignment)
    });

    return { success: true };
  }

  async listForEmployee(employeeId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.read");

    if (!this.canManageResponsibility(access) && access.employeeId !== employeeId) {
      throw new ForbiddenException("You can only view your own responsibilities");
    }

    const data = await this.prisma.responsibility.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerEmployeeId: employeeId }, { assignments: { some: { employeeId } } }]
      },
      select: responsibilitySelect,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });

    return { data: data.map(serializeResponsibility) };
  }

  async listForUser(userId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.read");

    if (!this.canManageResponsibility(access) && access.userId !== userId) {
      throw new ForbiddenException("You can only view your own responsibilities");
    }

    const data = await this.prisma.responsibility.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerUserId: userId }, { assignments: { some: { userId } } }]
      },
      select: responsibilitySelect,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });

    return { data: data.map(serializeResponsibility) };
  }

  async listInstructions(responsibilityId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "instructions.read");
    await this.requireVisibleResponsibility(responsibilityId, access);
    const data = await this.prisma.responsibilityInstruction.findMany({
      where: { responsibilityId },
      select: instructionSelect,
      orderBy: [{ isActive: "desc" }, { version: "desc" }, { updatedAt: "desc" }]
    });

    return { data };
  }

  async createInstruction(responsibilityId: string, dto: CreateResponsibilityInstructionDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "instructions.manage");
    await this.requireResponsibility(responsibilityId);
    const instruction = await this.prisma.responsibilityInstruction.create({
      data: {
        responsibilityId,
        title: requiredString(dto.title, "Instruction title"),
        content: requiredString(dto.content, "Instruction content"),
        format: dto.format ?? ResponsibilityInstructionFormat.MARKDOWN,
        isActive: dto.isActive ?? true,
        createdById: actorId
      },
      select: instructionSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "ResponsibilityInstruction",
      entityId: instruction.id,
      after: sanitizeJson(instruction)
    });

    return { instruction };
  }

  async updateInstruction(id: string, dto: UpdateResponsibilityInstructionDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "instructions.manage");
    const before = await this.requireInstruction(id);
    const data: Prisma.ResponsibilityInstructionUncheckedUpdateInput = { updatedById: actorId };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Instruction title"));
    assignIfDefined(writable, "format", dto.format);
    assignIfDefined(writable, "isActive", dto.isActive);

    if (dto.content !== undefined) {
      data.content = requiredString(dto.content, "Instruction content");
      data.version = { increment: 1 };
    }

    const instruction = await this.prisma.responsibilityInstruction.update({
      where: { id },
      data,
      select: instructionSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ResponsibilityInstruction",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(instruction)
    });

    return { instruction };
  }

  async deleteInstruction(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "instructions.manage");
    const before = await this.requireInstruction(id);
    await this.prisma.responsibilityInstruction.delete({ where: { id } });
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "ResponsibilityInstruction",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async listChecklist(responsibilityId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.read");
    await this.requireVisibleResponsibility(responsibilityId, access);
    const data = await this.prisma.responsibilityChecklistItem.findMany({
      where: { responsibilityId },
      select: checklistSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return { data };
  }

  async createChecklistItem(responsibilityId: string, dto: CreateResponsibilityChecklistItemDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.update");
    await this.requireResponsibility(responsibilityId);
    const item = await this.prisma.responsibilityChecklistItem.create({
      data: {
        responsibilityId,
        title: requiredString(dto.title, "Checklist item title"),
        description: nullableString(dto.description),
        sortOrder: dto.sortOrder ?? 0,
        isRequired: dto.isRequired ?? false
      },
      select: checklistSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "ResponsibilityChecklistItem",
      entityId: item.id,
      after: sanitizeJson(item)
    });

    return { item };
  }

  async updateChecklistItem(id: string, dto: UpdateResponsibilityChecklistItemDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.update");
    const before = await this.requireChecklistItem(id);
    const data: Prisma.ResponsibilityChecklistItemUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Checklist item title"));
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "sortOrder", dto.sortOrder);
    assignIfDefined(writable, "isRequired", dto.isRequired);

    const item = await this.prisma.responsibilityChecklistItem.update({
      where: { id },
      data,
      select: checklistSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ResponsibilityChecklistItem",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(item)
    });

    return { item };
  }

  async deleteChecklistItem(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "responsibilities.update");
    const before = await this.requireChecklistItem(id);
    await this.prisma.responsibilityChecklistItem.delete({ where: { id } });
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "ResponsibilityChecklistItem",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  private buildWhere(query: ResponsibilityQueryDto): Prisma.ResponsibilityWhereInput {
    return {
      deletedAt: null,
      ...(query.category ? { category: { contains: query.category, mode: "insensitive" } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.ownerEmployeeId ? { ownerEmployeeId: query.ownerEmployeeId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { category: { contains: query.search, mode: "insensitive" } },
              { ownerEmployee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { ownerEmployee: { lastName: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private applyResponsibilityScope(access: ActorAccess, where: Prisma.ResponsibilityWhereInput): Prisma.ResponsibilityWhereInput {
    if (this.canManageResponsibility(access)) {
      return where;
    }

    return {
      AND: [
        where,
        {
          OR: [
            { ownerUserId: access.userId },
            ...(access.employeeId ? [{ ownerEmployeeId: access.employeeId }] : []),
            { assignments: { some: { userId: access.userId } } },
            ...(access.employeeId ? [{ assignments: { some: { employeeId: access.employeeId } } }] : [])
          ]
        }
      ]
    };
  }

  private async resolveOwner(userIdValue?: string | null, employeeIdValue?: string | null) {
    let userId = nullableString(userIdValue);
    const employeeId = nullableString(employeeIdValue);

    if (employeeId) {
      const employee = await this.prisma.employeeProfile.findFirst({
        where: { id: employeeId, deletedAt: null, isActive: true },
        select: { id: true, userId: true }
      });

      if (!employee) {
        throw new BadRequestException("Employee not found or inactive");
      }

      userId = userId ?? employee.userId;
    }

    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true },
        select: { id: true }
      });

      if (!user) {
        throw new BadRequestException("User not found or inactive");
      }
    }

    return { userId, employeeId };
  }

  private async requireVisibleResponsibility(id: string, access: ActorAccess) {
    const responsibility = await this.requireResponsibility(id);
    this.ensureCanViewResponsibility(access, responsibility);
    return responsibility;
  }

  private async requireResponsibility(id: string): Promise<ResponsibilityPayload> {
    const responsibility = await this.prisma.responsibility.findFirst({
      where: { id, deletedAt: null },
      select: responsibilitySelect
    });

    if (!responsibility) {
      throw new NotFoundException("Responsibility not found");
    }

    return responsibility;
  }

  private async requireInstruction(id: string) {
    const instruction = await this.prisma.responsibilityInstruction.findFirst({
      where: { id },
      select: instructionSelect
    });

    if (!instruction) {
      throw new NotFoundException("Responsibility instruction not found");
    }

    return instruction;
  }

  private async requireChecklistItem(id: string) {
    const item = await this.prisma.responsibilityChecklistItem.findFirst({
      where: { id },
      select: checklistSelect
    });

    if (!item) {
      throw new NotFoundException("Responsibility checklist item not found");
    }

    return item;
  }

  private ensureCanViewResponsibility(access: ActorAccess, responsibility: ResponsibilityPayload) {
    if (this.canManageResponsibility(access) || isOwnResponsibility(access, responsibility)) {
      return;
    }

    throw new ForbiddenException("You can only view your own responsibilities");
  }

  private requirePermission(access: ActorAccess, permission: string) {
    if (access.isSuperAdmin || access.permissions.has(permission)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permission}`);
  }

  private requirePermissionAny(access: ActorAccess, permissions: string[]) {
    if (access.isSuperAdmin || permissions.some((permission) => access.permissions.has(permission))) {
      return;
    }

    throw new ForbiddenException(`Missing permissions: ${permissions.join(", ")}`);
  }

  private canManageResponsibility(access: ActorAccess) {
    return access.isSuperAdmin || ["responsibilities.create", "responsibilities.update", "responsibilities.delete", "responsibilities.assign"].some((permission) => access.permissions.has(permission));
  }

  private async getActorAccess(actorId: string): Promise<ActorAccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null, isActive: true },
      select: {
        primaryRole: true,
        employeeProfile: { select: { id: true } },
        roles: {
          where: { deletedAt: null },
          select: {
            role: {
              select: {
                code: true,
                deletedAt: true,
                permissions: {
                  where: { deletedAt: null },
                  select: { permission: { select: { key: true, deletedAt: true } } }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new ForbiddenException("User is inactive or deleted");
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));
    const permissions = new Set(
      user.roles.flatMap(({ role }) =>
        role.deletedAt ? [] : role.permissions.filter(({ permission }) => !permission.deletedAt).map(({ permission }) => permission.key)
      )
    );

    return {
      isSuperAdmin: user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN),
      permissions,
      employeeId: user.employeeProfile?.id,
      userId: actorId
    };
  }
}

function isOwnResponsibility(access: ActorAccess, responsibility: ResponsibilityPayload) {
  return (
    responsibility.ownerUserId === access.userId ||
    Boolean(access.employeeId && responsibility.ownerEmployeeId === access.employeeId) ||
    responsibility.assignments.some((assignment) => assignment.userId === access.userId || Boolean(access.employeeId && assignment.employeeId === access.employeeId))
  );
}

function serializeResponsibility(responsibility: ResponsibilityPayload) {
  return responsibility;
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function requiredString(value: string | undefined, field: string) {
  const normalized = nullableString(value);

  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }

  return normalized;
}

function nullableString(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
