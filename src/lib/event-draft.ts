import { db } from "@/lib/db";

export async function createEventDraftForActor(actor: { id: string; organizationId: string | null; eventAccess: Array<{ eventId: string }> }) {
  if (!actor.organizationId) throw new Error("Организация не настроена");

  const now = new Date();
  const startsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const salesEnd = new Date(startsAt.getTime() - 30 * 60 * 1000);
  const token = crypto.randomUUID().slice(0, 8);

  const event = await db.event.create({
    data: {
      title: "Новое мероприятие",
      slug: `draft-${token}`,
      description: "Добавьте описание мероприятия",
      posterUrl: "/assets/noa-live-tel-aviv.png",
      startsAt,
      salesStart: now,
      salesEnd,
      status: "DRAFT",
      salesMode: "INSTANT",
      mapEnabled: false,
      organization: { connect: { id: actor.organizationId } },
      venue: { create: { name: "Новая площадка", city: "Город", address: "Адрес площадки" } },
      categories: {
        create: {
          name: "General Admission",
          colorHex: "#2563EB",
          priceMinor: 0,
          pricingMode: "FIXED",
          capacity: 100,
          salesStart: now,
          salesEnd,
          maxPerOrder: 10,
        },
      },
    },
  });

  if (actor.eventAccess.length > 0) {
    await db.eventStaffAccess.upsert({
      where: { userId_eventId: { userId: actor.id, eventId: event.id } },
      update: {},
      create: { userId: actor.id, eventId: event.id },
    });
  }

  return event;
}
