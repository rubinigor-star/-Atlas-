import { db } from "@/lib/db";
import { ensureCommercialTermsTables } from "@/lib/commercial-terms";
import { ensureEventArchiveRuntime, isEventArchived } from "@/lib/event-archive";

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

  await ensureEventArchiveRuntime();
  if (await isEventArchived(eventId)) {
    throw new Error("Архивированное мероприятие нельзя удалить. Сначала восстановите его как черновик.");
  }

  await ensureCommercialTermsTables();

  await db.$transaction(async (tx) => {
    await tx.promoterLinkVisit.deleteMany({ where: { link: { eventId } } });
    await tx.promoterLink.deleteMany({ where: { eventId } });
    await tx.promoCode.deleteMany({ where: { eventId } });
    await tx.referral.deleteMany({ where: { eventId } });
    await tx.eventStaffAccess.deleteMany({ where: { eventId } });
    await tx.ticketTemplate.deleteMany({ where: { eventId } });

    await tx.seat.deleteMany({ where: { table: { zone: { eventId } } } });
    await tx.table.deleteMany({ where: { zone: { eventId } } });
    await tx.zone.deleteMany({ where: { eventId } });

    await tx.ticketPriceTier.deleteMany({ where: { category: { eventId } } });
    await tx.ticketCategory.deleteMany({ where: { eventId } });

    await tx.$executeRawUnsafe(`DELETE FROM "EventCommercialTerms" WHERE "eventId" = $1`, eventId);
    await tx.event.delete({ where: { id: eventId } });
  });

  const venueInUse = await db.event.count({ where: { venueId: event.venueId } });
  if (venueInUse === 0) {
    await db.venue.delete({ where: { id: event.venueId } }).catch(() => undefined);
  }

  return { id: event.id, title: event.title };
}
