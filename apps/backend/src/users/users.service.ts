import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleCode } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AuditService } from "../audit/audit.service";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AssignUserRolesDto } from "../rbac/dto/assign-user-roles.dto";
import { RbacService } from "../rbac/rbac.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const userSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  primaryRole: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    where: { deletedAt: null },
    select: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true
        }
      }
    }
  }
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService
  ) {}

  async list(query: PaginationQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: users.map(this.serializeUser),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing && !existing.deletedAt) {
      throw new ConflictException("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = existing?.deletedAt
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: dto.name,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            isActive: dto.isActive ?? true,
            primaryRole: RoleCode.VIEWER,
            deletedAt: null,
            updatedById: actorId
          },
          select: userSelect
        })
      : await this.prisma.user.create({
          data: {
            email: dto.email,
            passwordHash,
            name: dto.name,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            isActive: dto.isActive ?? true,
            primaryRole: RoleCode.VIEWER,
            createdById: actorId,
            updatedById: actorId
          },
          select: userSelect
        });

    if (dto.roleIds?.length || dto.roleCodes?.length) {
      await this.rbacService.assignUserRoles(
        user.id,
        { roleIds: dto.roleIds, roleCodes: dto.roleCodes },
        actorId
      );
    }

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: user.id,
      after: sanitizeJson(user)
    });

    return this.findOne(user.id);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return { user: this.serializeUser(user) };
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.requireUser(id);
    const user = await this.prisma.user
      .update({
        where: { id },
        data: {
          ...dto,
          updatedById: actorId
        },
        select: userSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("User with this email already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(user)
    });

    return { user: this.serializeUser(user) };
  }

  async softDelete(id: string, actorId: string) {
    const before = await this.requireUser(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: actorId
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async updatePassword(id: string, dto: UpdatePasswordDto, actorId: string) {
    await this.requireUser(id);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        updatedById: actorId,
        refreshTokens: {
          updateMany: {
            where: { revokedAt: null, deletedAt: null },
            data: { revokedAt: new Date() }
          }
        }
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "UserPassword",
      entityId: id
    });

    return { success: true };
  }

  async updateActive(id: string, dto: UpdateActiveDto, actorId: string) {
    const before = await this.requireUser(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        updatedById: actorId
      },
      select: userSelect
    });

    if (!dto.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null, deletedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "UserActive",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(user)
    });

    return { user: this.serializeUser(user) };
  }

  assignRoles(id: string, dto: AssignUserRolesDto, actorId: string) {
    return this.rbacService.assignUserRoles(id, dto, actorId);
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  private serializeUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
    return {
      ...user,
      roles: user.roles.map(({ role }) => role)
    };
  }
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}
