import { db } from "@/lib/db";
import { ensureCommercialTermsTables } from "@/lib/commercial-terms";
import { archiveDeleteSql, ensureEventArchiveRuntime, isEventArchived } from "@/lib/event-archive";
import { ensurePromoterV2Runtime } from "@/lib/promoter-v2";

export async function canDeleteDraftEvent(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      categories: { select: { sold: true } },
      _count: { select: { orders: true } },
    },
  });
  if (!event || event.status !== "DRAFT") return false;
  if (event._count.orders > 0 || event.categories.some((category) => category.sold > 0)) return false;

  // Archive/restore is only an organizational action. It must not turn a never-published
  // draft into an undeletable event. Only an actual status transition is treated as
  // publication lifecycle history.
  const publicationHistory = await db.auditLog.count({
    where: {
      entityType: "Event",
      entityId: eventId,
      action: "EVENT_STATUS",
    },
  });
  return publicationHistory === 0;
}

export async function deleteDraftEvent(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      venueId: true,
      categories: { select: { id: true, sold: true } },
      _count: { select: { orders: true } },
    },
  });

  if (!event) throw new Error("Мероприятие не найдено");
  if (event.status !== "DRAFT") throw new Error("Удалять можно только неопубликованные черновики");
  if (event._count.orders > 0 || event.categories.some((category) => category.sold > 0)) {
    throw new Error("Этот черновик уже содержит историю продаж или заказов и не может быть удалён. Используйте архив.");
  }

  const publicationHistory = await db.auditLog.count({
    where: {
      entityType: "Event",
      entityId: eventId,
      action: "EVENT_STATUS",
    },
  });
  if (publicationHistory > 0) {
    throw new Error("Это мероприятие уже публиковалось и не может быть удалено. Используйте архив.");
  }

  await ensureEventArchiveRuntime();
  const archived = await isEventArchived(eventId);
  await ensureCommercialTermsTables();
  await ensurePromoterV2Runtime();

  const promoterLinks = await db.promoterLink.findMany({ where: { eventId }, select: { id: true } });
  const categoryIds = event.categories.map((category) => category.id);
  const zones = await db.zone.findMany({ where: { eventId }, select: { id: true } });
  const zoneIds = zones.map((zone) => zone.id);
  const tables = zoneIds.length ? await db.table.findMany({ where: { zoneId: { in: zoneIds } }, select: { id: true } }) : [];
  const tableIds = tables.map((table) => table.id);

  await db.$transaction(async (tx) => {
    if (promoterLinks.length) await tx.promoterLinkVisit.deleteMany({ where: { linkId: { in: promoterLinks.map((link) => link.id) } } });
    await tx.promoterLink.deleteMany({ where: { eventId } });

    // Promoter V2 tables are runtime-managed rather than Prisma models. Their foreign keys
    // intentionally use RESTRICT, so a draft event must explicitly clear visits and assignments
    // before deleting the Event row.
    await tx.$executeRawUnsafe(
      `DELETE FROM "PromoterVisitV2" WHERE "promoterEventId" IN (SELECT "id" FROM "PromoterEventV2" WHERE "eventId" = $1)`,
      eventId,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "PromoterEventV2" WHERE "eventId" = $1`, eventId);

    await tx.promoCode.deleteMany({ where: { eventId } });
    await tx.referral.deleteMany({ where: { eventId } });
    await tx.eventStaffAccess.deleteMany({ where: { eventId } });
    await tx.ticketTemplate.deleteMany({ where: { eventId } });

    if (tableIds.length) await tx.seat.deleteMany({ where: { tableId: { in: tableIds } } });
    if (zoneIds.length) await tx.table.deleteMany({ where: { zoneId: { in: zoneIds } } });
    await tx.zone.deleteMany({ where: { eventId } });

    if (categoryIds.length) await tx.ticketPriceTier.deleteMany({ where: { categoryId: { in: categoryIds } } });
    await tx.ticketCategory.deleteMany({ where: { eventId } });

    await tx.$executeRawUnsafe(`DELETE FROM "EventCommercialTerms" WHERE "eventId" = $1`, eventId);
    if (archived) await tx.$executeRawUnsafe(archiveDeleteSql(), eventId);
    await tx.event.delete({ where: { id: eventId } });
  });

  const venueInUse = await db.event.count({ where: { venueId: event.venueId } });
  if (venueInUse === 0) {
    await db.venue.delete({ where: { id: event.venueId } }).catch(() => undefined);
  }

  return { id: event.id, title: event.title };
}
