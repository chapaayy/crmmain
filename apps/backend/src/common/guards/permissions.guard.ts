import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode } from "@prisma/client";
import { RequestWithUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException("User is missing from request");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        deletedAt: null
      },
      select: {
        primaryRole: true,
        roles: {
          where: { deletedAt: null },
          select: {
            role: {
              select: {
                code: true,
                deletedAt: true,
                permissions: {
                  where: { deletedAt: null },
                  select: {
                    permission: {
                      select: {
                        key: true,
                        deletedAt: true
                      }
                    }
                  }
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

    if (user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN)) {
      return true;
    }

    const permissions = new Set(
      user.roles.flatMap(({ role }) =>
        role.deletedAt
          ? []
          : role.permissions
              .filter(({ permission }) => !permission.deletedAt)
              .map(({ permission }) => permission.key)
      )
    );
    const missingPermissions = requiredPermissions.filter((permission) => !permissions.has(permission));

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(`Missing permissions: ${missingPermissions.join(", ")}`);
    }

    return true;
  }
}
