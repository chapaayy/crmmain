import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsQueryDto } from "./dto/audit-logs-query.dto";

interface AuditInput {
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before,
        after: input.after
      }
    });
  }

  async list(query: AuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      deletedAt: null,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.search
        ? {
            OR: [
              { entityType: { contains: query.search, mode: "insensitive" } },
              { entityId: { contains: query.search, mode: "insensitive" } },
              { actor: { email: { contains: query.search, mode: "insensitive" } } },
              { actor: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }
}
