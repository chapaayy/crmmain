import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationType, Prisma, TaskPriority, TaskRelatedType, TaskStatus, TimelineEventType } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto } from "./dto/task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

const userSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  relatedType: true,
  relatedId: true,
  completedAt: true,
  assignedToId: true,
  productId: true,
  createdById: true,
  updatedById: true,
  assignedTo: {
    select: userSelect
  },
  createdBy: {
    select: userSelect
  },
  updatedBy: {
    select: userSelect
  },
  product: {
    select: {
      id: true,
      sku: true,
      name: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.TaskSelect;

type TaskPayload = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: TaskQueryDto, actorId: string) {
    const where = this.buildWhere(query, actorId);
    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: tasks.map((task) => this.serializeTask(task)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateTaskDto, actorId: string) {
    const task = await this.prisma.$transaction(async (tx) => {
      const relation = await this.resolveRelation(tx, dto.relatedType, dto.relatedId);
      await this.ensureAssignee(tx, dto.assigneeId);

      const created = await tx.task.create({
        data: {
          title: requiredString(dto.title, "Task title"),
          description: nullableString(dto.description),
          status: dto.status ?? TaskStatus.TODO,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          completedAt: dto.status === TaskStatus.DONE ? new Date() : undefined,
          assignedToId: nullableString(dto.assigneeId),
          createdById: actorId,
          updatedById: actorId,
          ...relation
        },
        select: taskSelect
      });

      await this.createTimeline(tx, created, actorId, TimelineEventType.CREATED, "Task created");
      await this.audit(tx, actorId, AuditAction.CREATE, "Task", created.id, undefined, created);

      return created;
    });

    await this.notifyAssignment(task, actorId);

    return { task: this.serializeTask(task) };
  }

  async get(id: string) {
    return { task: this.serializeTask(await this.requireTask(this.prisma, id)) };
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string) {
    let previousAssigneeId: string | null | undefined;
    const task = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireTask(tx, id);
      previousAssigneeId = before.assignedToId;
      const data: Prisma.TaskUncheckedUpdateInput = {
        updatedById: actorId
      };
      const writable = data as Record<string, unknown>;

      assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Task title"));
      assignIfDefined(writable, "description", dto.description, nullableString);
      assignIfDefined(writable, "priority", dto.priority);
      assignIfDefined(writable, "dueAt", dto.dueAt, (value) => new Date(value));
      assignIfDefined(writable, "assignedToId", dto.assigneeId, nullableString);

      if (dto.status !== undefined) {
        data.status = dto.status;
        data.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
      }

      if (dto.assigneeId !== undefined) {
        await this.ensureAssignee(tx, dto.assigneeId);
      }

      if (dto.relatedType !== undefined || dto.relatedId !== undefined) {
        Object.assign(data, await this.resolveRelation(tx, dto.relatedType, dto.relatedId));
      }

      const updated = await tx.task.update({
        where: { id },
        data,
        select: taskSelect
      });

      await this.createTimeline(tx, updated, actorId, TimelineEventType.UPDATED, "Task updated");
      await this.audit(tx, actorId, AuditAction.UPDATE, "Task", id, before, updated);

      return updated;
    });

    if (task.assignedToId && task.assignedToId !== previousAssigneeId) {
      await this.notifyAssignment(task, actorId);
    }

    return { task: this.serializeTask(task) };
  }

  async delete(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.requireTask(tx, id);

      await tx.task.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedById: actorId
        }
      });
      await this.createTimeline(tx, before, actorId, TimelineEventType.UPDATED, "Task deleted");
      await this.audit(tx, actorId, AuditAction.DELETE, "Task", id, before);
    });

    return { success: true };
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto, actorId: string) {
    const task = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireTask(tx, id);
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: dto.status,
          completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
          updatedById: actorId
        },
        select: taskSelect
      });

      await this.createTimeline(tx, updated, actorId, dto.status === TaskStatus.DONE ? TimelineEventType.TASK_COMPLETED : TimelineEventType.UPDATED, `Task ${dto.status.toLowerCase()}`);
      await this.audit(tx, actorId, AuditAction.UPDATE, "TaskStatus", id, before, updated);

      return updated;
    });

    return { task: this.serializeTask(task) };
  }

  private buildWhere(query: TaskQueryDto, actorId: string): Prisma.TaskWhereInput {
    const dueAt: Prisma.DateTimeFilter = {};

    if (query.dueFrom) {
      dueAt.gte = new Date(query.dueFrom);
    }

    if (query.dueTo) {
      dueAt.lte = new Date(query.dueTo);
    }

    return {
      deletedAt: null,
      NOT: [
        { relatedType: TaskRelatedType.CUSTOMER },
        { relatedType: TaskRelatedType.LEAD },
        { relatedType: TaskRelatedType.ORDER }
      ],
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.mine ? { assignedToId: actorId } : query.assigneeId ? { assignedToId: query.assigneeId } : {}),
      ...(query.creatorId ? { createdById: query.creatorId } : {}),
      ...(query.relatedType ? { relatedType: query.relatedType } : {}),
      ...(query.relatedId ? { relatedId: query.relatedId } : {}),
      ...(query.dueFrom || query.dueTo ? { dueAt } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { product: { name: { contains: query.search, mode: "insensitive" } } },
              { product: { sku: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async resolveRelation(tx: Prisma.TransactionClient, relatedType?: TaskRelatedType, relatedId?: string) {
    if (!relatedType && !relatedId) {
      return clearRelation();
    }

    if (!relatedType || !relatedId) {
      throw new BadRequestException("relatedType and relatedId must be provided together");
    }

    if (relatedType !== TaskRelatedType.PRODUCT) {
      throw new BadRequestException("Only product-linked tasks are supported");
    }

    await this.ensureProduct(tx, relatedId);
    return {
      ...clearRelation(),
      relatedType,
      relatedId,
      productId: relatedId
    };
  }

  private async ensureProduct(tx: Prisma.TransactionClient, id: string) {
    const entity = await tx.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!entity) {
      throw new BadRequestException("Product not found");
    }
  }

  private async ensureAssignee(tx: Prisma.TransactionClient, assigneeId?: string) {
    const normalized = nullableString(assigneeId);

    if (!normalized) {
      return;
    }

    const assignee = await tx.user.findFirst({
      where: {
        id: normalized,
        isActive: true,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!assignee) {
      throw new BadRequestException("Assignee not found");
    }
  }

  private async requireTask(client: DbClient, id: string): Promise<TaskPayload> {
    const task = await client.task.findFirst({
      where: {
        id,
        deletedAt: null,
        NOT: [
          { relatedType: TaskRelatedType.CUSTOMER },
          { relatedType: TaskRelatedType.LEAD },
          { relatedType: TaskRelatedType.ORDER }
        ]
      },
      select: taskSelect
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  private async notifyAssignment(task: TaskPayload, actorId: string) {
    if (!task.assignedToId) {
      return;
    }

    await this.notificationsService.createForUser({
      userId: task.assignedToId,
      event: "task.assigned",
      type: NotificationType.INFO,
      title: "Task assigned",
      body: task.title,
      data: {
        taskId: task.id,
        assignedById: actorId,
        dueAt: task.dueAt?.toISOString(),
        priority: task.priority,
        relatedType: task.relatedType,
        relatedId: task.relatedId
      }
    });
  }

  private createTimeline(tx: Prisma.TransactionClient, task: Pick<TaskPayload, "id" | "title">, actorId: string, type: TimelineEventType, title: string) {
    return tx.timelineEvent.create({
      data: {
        taskId: task.id,
        actorId,
        type,
        title,
        description: task.title
      }
    });
  }

  private serializeTask(task: TaskPayload) {
    const related = inferRelated(task);

    return {
      ...task,
      relatedType: task.relatedType ?? related.relatedType,
      relatedId: task.relatedId ?? related.relatedId
    };
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

function clearRelation() {
  return {
    relatedType: null,
    relatedId: null,
    productId: null
  };
}

function inferRelated(task: Pick<TaskPayload, "productId" | "relatedType" | "relatedId">) {
  if (task.productId) {
    return { relatedType: TaskRelatedType.PRODUCT, relatedId: task.productId };
  }

  if (task.relatedType === TaskRelatedType.PRODUCT && task.relatedId) {
    return { relatedType: TaskRelatedType.PRODUCT, relatedId: task.relatedId };
  }

  return { relatedType: null, relatedId: null };
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
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
