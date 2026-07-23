import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.GUEST_LINK_SECRET || process.env.DATABASE_URL || "atlas-local-guest-link-secret";
}

export function guestManagementToken(linkId: string) {
  return createHmac("sha256", secret()).update(`guest-link:${linkId}`).digest("hex");
}

export function verifyGuestManagementToken(linkId: string, token: string) {
  const expected = guestManagementToken(linkId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function isGuestListPromoter(name: string) {
  return name.startsWith("__GUEST_LIST__:");
}
