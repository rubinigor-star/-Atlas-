import { createHmac, timingSafeEqual } from "crypto";
import type { StaffPermission } from "@prisma/client";
import { db } from "@/lib/db";
import { allPermissions } from "@/lib/permissions";
import { resolveStaffLocale } from "@/lib/i18n";

const MOBILE_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type MobileSessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

function mobileAuthSecret() {
  const secret = process.env.MOBILE_AUTH_SECRET || process.env.OFFICE_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("MOBILE_AUTH_SECRET is required in production");
  }
  return secret || "atlas-local-mobile-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", mobileAuthSecret()).update(value).digest("base64url");
}

function encode(payload: MobileSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): MobileSessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MobileSessionPayload;
    if (payload.version !== 1 || typeof payload.userId !== "string" || typeof payload.expiresAt !== "number") return null;
    if (payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createMobileSessionToken(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return encode({ userId, issuedAt, expiresAt: issuedAt + MOBILE_SESSION_TTL_SECONDS, version: 1 });
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function getMobileStaff(request: Request) {
  const token = bearerToken(request);
  const session = token ? decode(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { permissions: true, eventAccess: true, organization: true },
  });
  if (!user || !user.active || !["ORGANIZER", "CHECKIN", "ADMIN"].includes(user.role)) return null;
  const permissions = user.role === "ADMIN" ? allPermissions : user.permissions.map((grant) => grant.permission);
  const staffLocale = resolveStaffLocale({
    memberOverride: user.interfaceLocaleOverride,
    userPreference: user.preferredLocale,
    organizationDefault: user.organization?.defaultStaffLocale,
  });
  return {
    ...user,
    permissionSet: new Set<StaffPermission>(permissions),
    staffLocale,
    localePreference: {
      override: user.interfaceLocaleOverride,
      userPreferred: user.preferredLocale,
      organizationDefault: user.organization?.defaultStaffLocale ?? "ru",
    },
  };
}
