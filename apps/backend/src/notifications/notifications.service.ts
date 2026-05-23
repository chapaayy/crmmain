import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma, TaskStatus } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationQueryDto } from "./dto/notification-query.dto";

interface CreateNotificationInput {
  userId: string;
  event: string;
  type?: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.NotificationSelect;

type NotificationPayload = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  async list(userId: string, query: NotificationQueryDto) {
    await this.createDueSoonNotifications(userId);

    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { body: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [total, unreadCount, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          userId,
          deletedAt: null,
          readAt: null
        }
      }),
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: data.map((notification) => this.serializeNotification(notification)),
      unreadCount,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        readAt: new Date()
      },
      select: notificationSelect
    });

    this.realtimeService.emitToUser(userId, "notification.read", this.serializeNotification(updated));

    return { notification: this.serializeNotification(updated) };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        deletedAt: null,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });
    this.realtimeService.emitToUser(userId, "notification.read_all", {
      userId,
      readAt: new Date().toISOString()
    });

    return { success: true };
  }

  async createForUser(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type ?? NotificationType.INFO,
        title: input.title,
        body: input.body,
        data: sanitizeJson({
          event: input.event,
          ...(input.data ?? {})
        })
      },
      select: notificationSelect
    });

    this.realtimeService.emitToUser(input.userId, input.event, this.serializeNotification(notification));
    this.realtimeService.emitToUser(input.userId, "notification.created", this.serializeNotification(notification));

    return notification;
  }

  async createForUsers(userIds: Array<string | null | undefined>, input: Omit<CreateNotificationInput, "userId">) {
    const uniqueUserIds = Array.from(new Set(userIds.filter((userId): userId is string => Boolean(userId))));
    const notifications: NotificationPayload[] = [];

    for (const userId of uniqueUserIds) {
      notifications.push(await this.createForUser({ ...input, userId }));
    }

    return notifications;
  }

  async createForPermission(permissionKey: string, input: Omit<CreateNotificationInput, "userId">) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            deletedAt: null,
            role: {
              deletedAt: null,
              permissions: {
                some: {
                  deletedAt: null,
                  permission: {
                    key: permissionKey,
                    deletedAt: null
                  }
                }
              }
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    return this.createForUsers(users.map((user) => user.id), input);
  }

  emitToUsers(userIds: Array<string | null | undefined>, event: string, data?: unknown) {
    this.realtimeService.emitToUsers(userIds, event, data);
  }

  private async createDueSoonNotifications(userId: string) {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedToId: userId,
        deletedAt: null,
        dueSoonNotifiedAt: null,
        dueAt: {
          gte: now,
          lte: soon
        },
        status: {
          notIn: [TaskStatus.DONE, TaskStatus.CANCELLED]
        }
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true
      },
      take: 20
    });

    for (const task of tasks) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          dueSoonNotifiedAt: now
        }
      });
      await this.createForUser({
        userId,
        event: "task.due_soon",
        type: NotificationType.WARNING,
        title: "Task due soon",
        body: task.title,
        data: {
          taskId: task.id,
          dueAt: task.dueAt?.toISOString(),
          priority: task.priority
        }
      });
    }
  }

  private serializeNotification(notification: NotificationPayload) {
    return notification;
  }
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
