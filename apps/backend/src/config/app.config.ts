import { registerAs } from "@nestjs/config";

function parseCorsOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseOptionalBoolean(value?: string) {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value.toLowerCase() === "true";
}

function parseSameSite(value?: string) {
  const normalized = (value ?? "lax").toLowerCase();

  if (normalized === "strict" || normalized === "none") {
    return normalized;
  }

  return "lax";
}

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3001),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  refreshTokenCookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? process.env.REFRESH_TOKEN_COOKIE_NAME ?? "refreshToken",
  authCookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  authCookiePath: process.env.AUTH_COOKIE_PATH || "/",
  authCookieSecure: parseOptionalBoolean(process.env.AUTH_COOKIE_SECURE),
  authCookieSameSite: parseSameSite(process.env.AUTH_COOKIE_SAME_SITE),
  getCacheTtlMs: Number(process.env.API_GET_CACHE_TTL_MS ?? 3000)
}));
