import type { User } from "@prisma/client";
import { db } from "@/lib/db";

const eventCreationActions = new Set(["EVENT_CREATED", "EVENT_CLONED"]);

export async function writeAudit(actor: Pick<User, "id" | "organizationId">, input: { action: string; entityType: string; entityId?: string; summary: string; metadata?: unknown }) {
  if (!actor.organizationId) return;

  if (input.entityType === "Event" && input.entityId && eventCreationActions.has(input.action)) {
    const scopedEventCount = await db.eventStaffAccess.count({ where: { userId: actor.id } });
    if (scopedEventCount > 0) {
      await db.eventStaffAccess.upsert({
        where: { userId_eventId: { userId: actor.id, eventId: input.entityId } },
        update: {},
        create: { userId: actor.id, eventId: input.entityId },
      });
    }
  }

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
