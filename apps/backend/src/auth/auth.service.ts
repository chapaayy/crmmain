import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { AuditAction, User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash } from "crypto";
import { CookieOptions } from "express";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "./types";

type SafeUser = Pick<User, "id" | "email" | "name" | "firstName" | "lastName" | "locale" | "primaryRole">;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService
  ) {}

  get refreshCookieName() {
    return this.config.get<string>("app.refreshTokenCookieName", "refreshToken");
  }

  get refreshCookieOptions(): CookieOptions {
    const secure = this.config.get<boolean | undefined>("app.authCookieSecure");
    const domain = this.config.get<string | undefined>("app.authCookieDomain");
    const options: CookieOptions = {
      httpOnly: true,
      secure: secure ?? this.config.get<string>("app.apiPublicUrl", "").startsWith("https://"),
      sameSite: this.config.get<CookieOptions["sameSite"]>("app.authCookieSameSite", "lax"),
      path: "/auth",
      maxAge: this.durationToMs(this.config.get<string>("jwt.refreshExpiresIn", "7d"))
    };

    if (domain) {
      options.domain = domain;
    }

    return options;
  }

  get expiredRefreshCookieOptions(): CookieOptions {
    return {
      ...this.refreshCookieOptions,
      maxAge: 0
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user?.isActive || user.deletedAt) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const session = await this.issueSession(user);

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: "AuthSession",
      entityId: user.id
    });

    return session;
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.deletedAt ||
      stored.expiresAt < new Date() ||
      stored.userId !== payload.sub ||
      !stored.user.isActive ||
      stored.user.deletedAt
    ) {
      throw new UnauthorizedException("Refresh token is invalid");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession(stored.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true }
    });

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, deletedAt: null },
      data: { revokedAt: new Date() }
    });

    if (stored) {
      await this.auditService.log({
        actorId: stored.userId,
        action: AuditAction.LOGOUT,
        entityType: "AuthSession",
        entityId: stored.id
      });
    }

    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, deletedAt: null },
      data: { revokedAt: new Date() }
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.LOGOUT,
      entityType: "AuthSession",
      entityId: userId
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        locale: true,
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
                permissions: {
                  where: { deletedAt: null },
                  select: {
                    permission: {
                      select: {
                        id: true,
                        key: true,
                        name: true,
                        resource: true,
                        action: true,
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

    const roles = user.roles.map(({ role }) => ({
      id: role.id,
      code: role.code,
      name: role.name
    }));
    const permissionMap = new Map<
      string,
      {
        id: string;
        key: string;
        name: string;
        resource: string;
        action: string;
      }
    >();

    for (const { role } of user.roles) {
      for (const { permission } of role.permissions) {
        if (permission.deletedAt) {
          continue;
        }

        permissionMap.set(permission.key, {
          id: permission.id,
          key: permission.key,
          name: permission.name,
          resource: permission.resource,
          action: permission.action
        });
      }
    }

    const permissions = Array.from(permissionMap.values());

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        locale: user.locale,
        primaryRole: user.primaryRole,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles,
        permissions
      }
    };
  }

  private async issueSession(user: SafeUser) {
    const accessToken = await this.signToken(user, "access");
    const refreshToken = await this.signToken(user, "refresh");

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + this.durationToMs(this.config.get<string>("jwt.refreshExpiresIn", "7d")))
      }
    });

    return {
      accessToken,
      refreshToken,
      user: this.toSafeUser(user)
    };
  }

  private async signToken(user: SafeUser, type: "access" | "refresh") {
    const secretKey = type === "access" ? "jwt.accessSecret" : "jwt.refreshSecret";
    const secretName = type === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET";
    const expiresKey = type === "access" ? "jwt.accessExpiresIn" : "jwt.refreshExpiresIn";
    const secret = this.config.get<string>(secretKey);
    const expiresIn = this.config.get<string>(
      expiresKey,
      type === "access" ? "15m" : "7d"
    ) as JwtSignOptions["expiresIn"];

    if (!secret) {
      throw new Error(`${secretName} is required`);
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.primaryRole,
      type
    };

    return this.jwt.signAsync(payload, {
      secret,
      expiresIn
    });
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    const secret = this.config.get<string>("jwt.refreshSecret");

    if (!secret) {
      throw new Error("JWT_REFRESH_SECRET is required");
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException("Refresh token is invalid");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    return payload;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private toSafeUser(user: SafeUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      role: user.primaryRole
    };
  }

  private durationToMs(value: string) {
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return amount * multipliers[unit as keyof typeof multipliers];
  }
}
