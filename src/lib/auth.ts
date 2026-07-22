import { cookies } from "next/headers";
import type { StaffPermission } from "@prisma/client";
import { db } from "@/lib/db";
import { allPermissions } from "@/lib/permissions";

export const demoSessionCookie = "atlas_demo_staff";

export async function getCurrentStaff() {
  const store = await cookies();
  const email = store.get(demoSessionCookie)?.value || process.env.DEMO_USER_EMAIL || "organizer@atlas.test";
  const user = await db.user.findUnique({
    where: { email },
    include: { permissions: true, eventAccess: true, organization: true },
  });
  if (!user || !user.active) return null;
  const permissions = user.role === "ADMIN" ? allPermissions : user.permissions.map((grant) => grant.permission);
  return { ...user, permissionSet: new Set<StaffPermission>(permissions) };
}

export async function requirePermission(permission: StaffPermission) {
  const user = await getCurrentStaff();
  if (!user || !user.permissionSet.has(permission)) throw new Error("FORBIDDEN");
  return user;
}

export function canAccessEvent(user: Awaited<ReturnType<typeof getCurrentStaff>>, eventId: string) {
  if (!user) return false;
  return user.eventAccess.length === 0 || user.eventAccess.some((access) => access.eventId === eventId);
}

export async function requireEventAccess(permission: StaffPermission, eventId: string) {
  const user = await requirePermission(permission);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!event || event.organizationId !== user.organizationId || !canAccessEvent(user, eventId)) throw new Error("FORBIDDEN");
  return user;
}
