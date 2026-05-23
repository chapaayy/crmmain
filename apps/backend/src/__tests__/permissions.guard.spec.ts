import { test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { PermissionsGuard } from "../common/guards/permissions.guard";

function contextFor(userId?: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { userId } : undefined
      })
    })
  } as never;
}

function guardFor(requiredPermissions: string[], user: unknown) {
  return new PermissionsGuard(
    {
      getAllAndOverride: () => requiredPermissions
    } as never,
    {
      user: {
        findFirst: async () => user
      }
    } as never
  );
}

test("permissions guard allows users with required role permission", async () => {
  const guard = guardFor(["orders.read"], {
    primaryRole: RoleCode.SALES_MANAGER,
    roles: [
      {
        role: {
          code: RoleCode.SALES_MANAGER,
          deletedAt: null,
          permissions: [{ permission: { key: "orders.read", deletedAt: null } }]
        }
      }
    ]
  });

  assert.equal(await guard.canActivate(contextFor("user-1")), true);
});

test("permissions guard allows SUPER_ADMIN without explicit permission", async () => {
  const guard = guardFor(["settings.manage"], {
    primaryRole: RoleCode.SUPER_ADMIN,
    roles: []
  });

  assert.equal(await guard.canActivate(contextFor("user-1")), true);
});

test("permissions guard rejects missing permissions", async () => {
  const guard = guardFor(["warehouse.manage"], {
    primaryRole: RoleCode.VIEWER,
    roles: [
      {
        role: {
          code: RoleCode.VIEWER,
          deletedAt: null,
          permissions: [{ permission: { key: "warehouse.read", deletedAt: null } }]
        }
      }
    ]
  });

  await assert.rejects(() => guard.canActivate(contextFor("user-1")), ForbiddenException);
});

test("permissions guard rejects requests without current user", async () => {
  const guard = guardFor(["orders.read"], null);

  await assert.rejects(() => guard.canActivate(contextFor()), ForbiddenException);
});
