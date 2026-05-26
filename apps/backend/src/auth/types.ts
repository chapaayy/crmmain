import { RoleCode } from "@prisma/client";

export type TokenKind = "access" | "refresh";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleCode;
  type: TokenKind;
  jti?: string;
}

export interface JwtUser {
  userId: string;
  email: string;
  role: RoleCode;
}

export interface RequestWithUser {
  user: JwtUser;
}

export interface RequestWithCookies {
  cookies?: Record<string, string | undefined>;
}
