import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleCode, TaskPriority, TaskStatus, TimelineEventType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeTaskDto, UpdateEmployeeTaskDto } from "./dto/employee-task.dto";
import { EmployeeTaskQueryDto } from "./dto/employee-task-query.dto";

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

const responsibilitySummarySelect = {
  id: true,
  title: true,
  category: true,
  status: true
} satisfies Prisma.ResponsibilitySelect;

const employeeTaskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  assignedToId: true,
  assigneeEmployeeId: true,
  assigneeDepartment: true,
  responsibilityId: true,
  createdById: true,
  updatedById: true,
  assignedTo: { select: userSelect },
  assigneeEmployee: { select: employeeSummarySelect },
  responsibility: { select: responsibilitySummarySelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.TaskSelect;

type EmployeeTaskPayload = Prisma.TaskGetPayload<{ select: typeof employeeTaskSelect }>;

interface ActorAccess {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  employeeId?: string;
  userId: string;
}

@Injectable()
export class EmployeeTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(query: EmployeeTaskQueryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requireRead(access);
    const where = this.applyScope(access, this.buildWhere(query));
    const [total, data] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        select: employeeTaskSelect,
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data: data.map(serializeTask), meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async create(dto: CreateEmployeeTaskDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "employee_tasks.create");
    const assignee = await this.resolveAssignee(dto.assigneeUserId, dto.assigneeEmployeeId);

    if (dto.responsibilityId) {
      await this.requireResponsibility(dto.responsibilityId);
    }

    const task = await this.prisma.task.create({
      data: {
        title: requiredString(dto.title, "Task title"),
        description: nullableString(dto.description),
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueAt: optionalDate(dto.dueAt),
        completedAt: dto.status === TaskStatus.DONE ? new Date() : undefined,
        isEmployeeTask: true,
        assignedToId: assignee.userId,
        assigneeEmployeeId: assignee.employeeId,
        assigneeDepartment: nullableString(dto.assigneeDepartment),
        responsibilityId: nullableString(dto.responsibilityId),
        createdById: actorId,
        updatedById: actorId
      },
      select: employeeTaskSelect
    });

    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.CREATE,
        entityType: "EmployeeTask",
        entityId: task.id,
        after: sanitizeJson(serializeTask(task))
      }),
      this.createTaskTimeline(task, actorId, TimelineEventType.CREATED, "Employee task created")
    ]);

    return { task: serializeTask(task) };
  }

  async get(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requireRead(access);
    const task = await this.requireTask(id);

    this.ensureCanView(access, task);
    return { task: serializeTask(task) };
  }

  async update(id: string, dto: UpdateEmployeeTaskDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "employee_tasks.update");
    const before = await this.requireTask(id);
    const data: Prisma.TaskUncheckedUpdateInput = { updatedById: actorId };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Task title"));
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "priority", dto.priority);
    assignIfDefined(writable, "dueAt", dto.dueAt, nullableDate);
    assignIfDefined(writable, "assigneeDepartment", dto.assigneeDepartment, nullableString);
    assignIfDefined(writable, "responsibilityId", dto.responsibilityId, nullableString);

    if (dto.status !== undefined) {
      data.status = dto.status;
      data.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
    }

    if (dto.assigneeUserId !== undefined || dto.assigneeEmployeeId !== undefined) {
      this.requirePermission(access, "employee_tasks.assign");
      const assignee = await this.resolveAssignee(dto.assigneeUserId, dto.assigneeEmployeeId);

      data.assignedToId = assignee.userId;
      data.assigneeEmployeeId = assignee.employeeId;
    }

    if (dto.responsibilityId) {
      await this.requireResponsibility(dto.responsibilityId);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      select: employeeTaskSelect
    });

    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.UPDATE,
        entityType: "EmployeeTask",
        entityId: id,
        before: sanitizeJson(serializeTask(before)),
        after: sanitizeJson(serializeTask(task))
      }),
      this.createTaskTimeline(task, actorId, TimelineEventType.UPDATED, "Employee task updated")
    ]);

    return { task: serializeTask(task) };
  }

  async delete(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "employee_tasks.delete");
    const before = await this.requireTask(id);

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId }
    });
    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "EmployeeTask",
      entityId: id,
      before: sanitizeJson(serializeTask(before))
    });

    return { success: true };
  }

  async complete(id: string, actorId: string) {
    return this.updateStatus(id, TaskStatus.DONE, actorId);
  }

  async reopen(id: string, actorId: string) {
    return this.updateStatus(id, TaskStatus.IN_PROGRESS, actorId);
  }

  private async updateStatus(id: string, status: TaskStatus, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requireRead(access);
    const before = await this.requireTask(id);

    if (!this.canManage(access) && !isOwnTask(access, before)) {
      throw new ForbiddenException("You can only update your own employee tasks");
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
        updatedById: actorId
      },
      select: employeeTaskSelect
    });

    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.UPDATE,
        entityType: "EmployeeTaskStatus",
        entityId: id,
        before: sanitizeJson(serializeTask(before)),
        after: sanitizeJson(serializeTask(task))
      }),
      this.createTaskTimeline(task, actorId, status === TaskStatus.DONE ? TimelineEventType.TASK_COMPLETED : TimelineEventType.UPDATED, `Employee task ${status.toLowerCase()}`)
    ]);

    return { task: serializeTask(task) };
  }

  private buildWhere(query: EmployeeTaskQueryDto): Prisma.TaskWhereInput {
    const dueAt: Prisma.DateTimeFilter = {};

    if (query.dueFrom) {
      dueAt.gte = new Date(query.dueFrom);
    }

    if (query.dueTo) {
      dueAt.lte = new Date(query.dueTo);
    }

    return {
      deletedAt: null,
      OR: [
        { isEmployeeTask: true },
        { assigneeEmployeeId: { not: null } },
        { responsibilityId: { not: null } },
        { assigneeDepartment: { not: null } }
      ],
      ...(query.assigneeUserId ? { assignedToId: query.assigneeUserId } : {}),
      ...(query.assigneeEmployeeId ? { assigneeEmployeeId: query.assigneeEmployeeId } : {}),
      ...(query.responsibilityId ? { responsibilityId: query.responsibilityId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.dueFrom || query.dueTo ? { dueAt } : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: query.search, mode: "insensitive" } },
                  { description: { contains: query.search, mode: "insensitive" } },
                  { assigneeDepartment: { contains: query.search, mode: "insensitive" } },
                  { assigneeEmployee: { firstName: { contains: query.search, mode: "insensitive" } } },
                  { assigneeEmployee: { lastName: { contains: query.search, mode: "insensitive" } } },
                  { responsibility: { title: { contains: query.search, mode: "insensitive" } } }
                ]
              }
            ]
          }
        : {})
    };
  }

  private applyScope(access: ActorAccess, where: Prisma.TaskWhereInput): Prisma.TaskWhereInput {
    if (this.canManage(access)) {
      return where;
    }

    return {
      AND: [
        where,
        {
          OR: [
            { assignedToId: access.userId },
            ...(access.employeeId ? [{ assigneeEmployeeId: access.employeeId }] : []),
            { createdById: access.userId }
          ]
        }
      ]
    };
  }

  private async resolveAssignee(assigneeUserId?: string | null, assigneeEmployeeId?: string | null) {
    let userId = nullableString(assigneeUserId);
    const employeeId = nullableString(assigneeEmployeeId);

    if (employeeId) {
      const employee = await this.prisma.employeeProfile.findFirst({
        where: { id: employeeId, deletedAt: null, isActive: true },
        select: { id: true, userId: true }
      });

      if (!employee) {
        throw new BadRequestException("Assignee employee not found");
      }

      userId = userId ?? employee.userId;
    }

    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true },
        select: { id: true }
      });

      if (!user) {
        throw new BadRequestException("Assignee user not found");
      }
    }

    return { userId, employeeId };
  }

  private async requireResponsibility(id: string) {
    const responsibility = await this.prisma.responsibility.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!responsibility) {
      throw new BadRequestException("Responsibility not found");
    }
  }

  private async requireTask(id: string): Promise<EmployeeTaskPayload> {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: employeeTaskSelect
    });

    if (!task) {
      throw new NotFoundException("Employee task not found");
    }

    return task;
  }

  private ensureCanView(access: ActorAccess, task: EmployeeTaskPayload) {
    if (this.canManage(access) || isOwnTask(access, task)) {
      return;
    }

    throw new ForbiddenException("You can only view your own employee tasks");
  }

  private requireRead(access: ActorAccess) {
    if (access.isSuperAdmin || access.permissions.has("employee_tasks.read") || this.canManage(access)) {
      return;
    }

    throw new ForbiddenException("Missing employee task permission");
  }

  private requirePermission(access: ActorAccess, permission: string) {
    if (access.isSuperAdmin || access.permissions.has(permission)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permission}`);
  }

  private canManage(access: ActorAccess) {
    return access.isSuperAdmin || ["employee_tasks.create", "employee_tasks.update", "employee_tasks.delete", "employee_tasks.assign"].some((permission) => access.permissions.has(permission));
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

  private createTaskTimeline(task: Pick<EmployeeTaskPayload, "id" | "title">, actorId: string, type: TimelineEventType, title: string) {
    return this.prisma.timelineEvent.create({
      data: {
        taskId: task.id,
        actorId,
        type,
        title,
        description: task.title
      }
    });
  }
}

function isOwnTask(access: ActorAccess, task: EmployeeTaskPayload) {
  return task.assignedToId === access.userId || task.createdById === access.userId || Boolean(access.employeeId && task.assigneeEmployeeId === access.employeeId);
}

function serializeTask(task: EmployeeTaskPayload) {
  return {
    ...task,
    assigneeUserId: task.assignedToId
  };
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

function optionalDate(value: string | null | undefined) {
  return value ? new Date(value) : undefined;
}

function nullableDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
