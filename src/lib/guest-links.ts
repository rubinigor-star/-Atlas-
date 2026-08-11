import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const configured = process.env.GUEST_LINK_SECRET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("GUEST_LINK_SECRET is required in production");
  }
  return process.env.DATABASE_URL || "atlas-local-guest-link-secret";
}

export function guestManagementToken(linkId: string) {
  return createHmac("sha256", secret()).update(`guest-link:${linkId}`).digest("hex");
}

export function verifyGuestManagementToken(linkId: string, token: string) {
  if (!token) return false;
  const expected = guestManagementToken(linkId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function isGuestListPromoter(name: string) {
  return name.startsWith("__GUEST_LIST__:") || name.startsWith("__CHANNEL__:GUEST:");
}
