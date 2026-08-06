import { createHmac, timingSafeEqual } from "crypto";

const VERSION = "v1";

function secret() {
  const value = process.env.CUSTOMER_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!value) throw new Error("Missing short-link signing secret");
  return value;
}

function signature(publicId: string) {
  return createHmac("sha256", secret()).update(`${VERSION}:${publicId}`).digest("base64url").slice(0, 12);
}

export function createShortTicketCode(publicId: string) {
  const id = Buffer.from(publicId, "utf8").toString("base64url");
  return `${VERSION}.${id}.${signature(publicId)}`;
}

export function parseShortTicketCode(code: string) {
  const [version, encodedId, providedSignature] = code.split(".");
  if (version !== VERSION || !encodedId || !providedSignature) return null;

  let publicId = "";
  try {
    publicId = Buffer.from(encodedId, "base64url").toString("utf8");
  } catch {
    return null;
  }

  if (!publicId || publicId.length > 120) return null;
  const expected = signature(publicId);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return publicId;
}

export function shortTicketUrl(publicId: string) {
  const origin = (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
  return `${origin}/t/${createShortTicketCode(publicId)}`;
}
