import { test } from "node:test";
import assert from "node:assert/strict";
import * as bcrypt from "bcrypt";
import { AuthService } from "../auth/auth.service";

test("auth login returns safe user and stores only hashed refresh token", async () => {
  const passwordHash = await bcrypt.hash("secret-password", 4);
  const refreshTokenRows: Array<{ tokenHash: string; userId: string; expiresAt: Date }> = [];
  const configValues: Record<string, string> = {
    "jwt.accessSecret": "access-secret",
    "jwt.refreshSecret": "refresh-secret",
    "jwt.accessExpiresIn": "15m",
    "jwt.refreshExpiresIn": "7d"
  };
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: "user-1",
          email: "admin@example.com",
          name: "Admin",
          firstName: "Admin",
          lastName: null,
          primaryRole: "SUPER_ADMIN",
          passwordHash,
          isActive: true,
          deletedAt: null
        }),
        update: async () => ({})
      },
      refreshToken: {
        create: async ({ data }: { data: { tokenHash: string; userId: string; expiresAt: Date } }) => {
          refreshTokenRows.push(data);
          return data;
        }
      }
    } as never,
    {
      signAsync: async (payload: { sub: string; type: string }) => `${payload.type}.${payload.sub}.token`
    } as never,
    {
      get: (key: string, fallback?: string) => configValues[key] ?? fallback
    } as never,
    {
      log: async () => ({})
    } as never
  );

  const session = await service.login({ email: "admin@example.com", password: "secret-password" });

  assert.equal(session.accessToken, "access.user-1.token");
  assert.equal(session.refreshToken, "refresh.user-1.token");
  assert.equal(session.user.email, "admin@example.com");
  assert.equal("passwordHash" in session.user, false);
  assert.equal(refreshTokenRows.length, 1);
  assert.equal(refreshTokenRows[0].tokenHash.length, 64);
  assert.notEqual(refreshTokenRows[0].tokenHash, session.refreshToken);
});
