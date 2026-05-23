import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleCode } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AssignUserRolesDto } from "./dto/assign-user-roles.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

const rolePriority: RoleCode[] = [
  RoleCode.SUPER_ADMIN,
  RoleCode.ADMIN,
  RoleCode.SALES_MANAGER,
  RoleCode.WAREHOUSE_MANAGER,
  RoleCode.ACCOUNTANT,
  RoleCode.VIEWER
];

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        permissions: {
          where: { deletedAt: null },
          include: {
            permission: true
          }
        },
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      },
      orderBy: { code: "asc" }
    });

    return {
      roles: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: role.permissions
          .filter(({ permission }) => !permission.deletedAt)
          .map(({ permission }) => ({
            id: permission.id,
            key: permission.key,
            name: permission.name,
            resource: permission.resource,
            action: permission.action
          }))
          .sort((first, second) => first.key.localeCompare(second.key)),
        counts: role._count
      }))
    };
  }

  async createRole(dto: CreateRoleDto, actorId: string) {
    const role = await this.prisma.role
      .upsert({
        where: { code: dto.code },
        update: {
          name: dto.name,
          description: dto.description,
          isSystem: dto.isSystem ?? false,
          updatedById: actorId,
          deletedAt: null
        },
        create: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          isSystem: dto.isSystem ?? false,
          createdById: actorId,
          updatedById: actorId
        }
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new BadRequestException("Role code or name already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "Role",
      entityId: role.id,
      after: sanitizeJson(role)
    });

    return this.getRolePermissions(role.id);
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, actorId: string) {
    const before = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null }
    });

    if (!before) {
      throw new NotFoundException("Role not found");
    }

    const role = await this.prisma.role
      .update({
        where: { id: roleId },
        data: {
          ...dto,
          updatedById: actorId
        }
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new BadRequestException("Role name already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Role",
      entityId: roleId,
      before: sanitizeJson(before),
      after: sanitizeJson(role)
    });

    return this.getRolePermissions(role.id);
  }

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ resource: "asc" }, { action: "asc" }, { key: "asc" }]
    });

    return { permissions };
  }

  async assignUserRoles(userId: string, dto: AssignUserRolesDto, assignedById: string) {
    const roleFilters: Prisma.RoleWhereInput[] = [
      ...(dto.roleIds?.length ? [{ id: { in: dto.roleIds } }] : []),
      ...(dto.roleCodes?.length ? [{ code: { in: dto.roleCodes } }] : [])
    ];

    if (roleFilters.length === 0) {
      throw new BadRequestException("Provide roleIds or roleCodes");
    }

    const [user, roles] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true }
      }),
      this.prisma.role.findMany({
        where: {
          deletedAt: null,
          OR: roleFilters
        }
      })
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (roles.length === 0) {
      throw new BadRequestException("No matching roles found");
    }

    const roleIds = Array.from(new Set(roles.map((role) => role.id)));
    const primaryRole = this.resolvePrimaryRole(roles.map((role) => role.code));

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.updateMany({
        where: {
          userId,
          roleId: { notIn: roleIds },
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      for (const roleId of roleIds) {
        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId,
              roleId
            }
          },
          update: {
            assignedById,
            deletedAt: null
          },
          create: {
            userId,
            roleId,
            assignedById
          }
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          primaryRole,
          updatedById: assignedById
        }
      });
    });

    await this.auditService.log({
      actorId: assignedById,
      action: AuditAction.UPDATE,
      entityType: "UserRole",
      entityId: userId,
      after: sanitizeJson({ roleIds, primaryRole })
    });

    return this.getUserRoles(userId);
  }

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto, updatedById: string) {
    const requestedPermissionIds = dto.permissionIds ?? [];
    const requestedPermissionKeys = dto.permissionKeys ?? [];

    if (dto.permissionIds === undefined && dto.permissionKeys === undefined) {
      throw new BadRequestException("Provide permissionIds or permissionKeys");
    }

    const permissionFilters: Prisma.PermissionWhereInput[] = [
      ...(requestedPermissionIds.length ? [{ id: { in: requestedPermissionIds } }] : []),
      ...(requestedPermissionKeys.length ? [{ key: { in: requestedPermissionKeys } }] : [])
    ];

    const [role, permissions] = await Promise.all([
      this.prisma.role.findFirst({
        where: { id: roleId, deletedAt: null },
        select: { id: true }
      }),
      permissionFilters.length
        ? this.prisma.permission.findMany({
            where: {
              deletedAt: null,
              OR: permissionFilters
            }
          })
        : Promise.resolve([])
    ]);

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    if (permissionFilters.length > 0 && permissions.length === 0) {
      throw new BadRequestException("No matching permissions found");
    }

    const permissionIds = Array.from(new Set(permissions.map((permission) => permission.id)));

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.updateMany({
        where: {
          roleId,
          permissionId: { notIn: permissionIds },
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      for (const permissionId of permissionIds) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId
            }
          },
          update: {
            deletedAt: null
          },
          create: {
            roleId,
            permissionId,
            createdById: updatedById
          }
        });
      }

      await tx.role.update({
        where: { id: roleId },
        data: {
          updatedById
        }
      });
    });

    await this.auditService.log({
      actorId: updatedById,
      action: AuditAction.UPDATE,
      entityType: "RolePermission",
      entityId: roleId,
      after: sanitizeJson({ permissionIds })
    });

    return this.getRolePermissions(roleId);
  }

  private async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        primaryRole: true,
        roles: {
          where: { deletedAt: null },
          select: {
            role: true
          }
        }
      }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        primaryRole: user.primaryRole,
        roles: user.roles.map(({ role }) => role)
      }
    };
  }

  private async getRolePermissions(roleId: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      include: {
        permissions: {
          where: { deletedAt: null },
          include: {
            permission: true
          }
        }
      }
    });

    return {
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        permissions: role.permissions
          .filter(({ permission }) => !permission.deletedAt)
          .map(({ permission }) => permission)
          .sort((first, second) => first.key.localeCompare(second.key))
      }
    };
  }

  private resolvePrimaryRole(roleCodes: RoleCode[]) {
    return rolePriority.find((roleCode) => roleCodes.includes(roleCode)) ?? RoleCode.VIEWER;
  }
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}
