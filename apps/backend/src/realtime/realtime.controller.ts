import { Controller, Get, Query, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../auth/types";
import { RealtimePayload, RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get("events")
  async events(@Query("token") token: string | undefined, @Res() response: Response) {
    const userId = await this.validateToken(token);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    const send = (payload: RealtimePayload) => {
      response.write(`event: ${payload.event}\n`);
      response.write(`data: ${JSON.stringify(payload.data ?? {})}\n\n`);
    };
    const unsubscribe = this.realtimeService.subscribe(userId, send);
    const heartbeat = setInterval(() => {
      send({
        event: "heartbeat",
        data: {
          at: new Date().toISOString()
        }
      });
    }, 25_000);

    response.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }

  private async validateToken(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException("Realtime token is required");
    }

    const secret = this.configService.get<string>("jwt.accessSecret");

    if (!secret) {
      throw new UnauthorizedException("JWT access secret is not configured");
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret }).catch(() => {
      throw new UnauthorizedException("Invalid realtime token");
    });

    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid realtime token type");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("User is inactive");
    }

    return user.id;
  }
}
