import { createHmac } from "node:crypto";

export const officeSessionTtlSeconds = 60 * 60 * 24 * 14;

function authSecret() {
  return process.env.OFFICE_AUTH_SECRET || process.env.CUSTOMER_AUTH_SECRET || process.env.CRON_SECRET || "atlas-local-office-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function createOfficeSessionToken(userId: string) {
  const body = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + officeSessionTtlSeconds,
  })).toString("base64url");

  return `${body}.${sign(body)}`;
}
