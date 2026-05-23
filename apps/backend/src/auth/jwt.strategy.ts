import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload, JwtUser } from "./types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const secret = config.get<string>("jwt.accessSecret");

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is required");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        primaryRole: true,
        isActive: true,
        deletedAt: true
      }
    });

    if (!user?.isActive || user.deletedAt) {
      throw new UnauthorizedException("User is inactive");
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.primaryRole
    };
  }
}
