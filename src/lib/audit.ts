import type { User } from "@prisma/client";
import { db } from "@/lib/db";

export async function writeAudit(actor: Pick<User, "id" | "organizationId">, input: { action: string; entityType: string; entityId?: string; summary: string; metadata?: unknown }) {
  if (!actor.organizationId) return;
  await db.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
