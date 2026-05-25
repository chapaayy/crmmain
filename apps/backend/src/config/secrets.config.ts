import { registerAs } from "@nestjs/config";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

export default registerAs("secrets", () => ({
  encryptionKey: process.env.SECRETS_ENCRYPTION_KEY,
  enableRevealAudit: parseBoolean(process.env.SECRETS_ENABLE_REVEAL_AUDIT, true),
  requireReasonOnReveal: parseBoolean(process.env.SECRETS_REQUIRE_REASON_ON_REVEAL, true),
  maskByDefault: parseBoolean(process.env.SECRETS_MASK_BY_DEFAULT, true)
}));
