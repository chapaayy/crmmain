import { registerAs } from "@nestjs/config";

function parseCorsOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3001),
  apiPublicUrl: process.env.API_PUBLIC_URL,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME ?? "refreshToken"
}));
