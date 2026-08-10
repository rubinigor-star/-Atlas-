import { db } from "@/lib/db";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { parseEventMedia, withEventMedia } from "@/lib/event-media";
import { parseEventRejectionMessage, withEventRejectionMessage } from "@/lib/event-approval-message";
import { parseBuyerQuestions, withBuyerQuestions } from "@/lib/buyer-questions";
import { parseGuestFields, serializeGuestFields, stripEventMarkers } from "@/lib/event-guest-fields";
import { parseEventType, withEventType } from "@/lib/event-type";

export type EventBasicsInput = {
  title: string;
  description: string;
  posterUrl: string;
  startsAt: string;
  venueName: string;
  city: string;
  address: string;
};

export async function getEventBasics(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { venue: true },
  });
  if (!event) return null;
  return {
    id: event.id,
    title: event.title,
    description: stripEventMarkers(event.description),
    posterUrl: event.posterUrl,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    salesMode: event.salesMode,
    mapEnabled: event.mapEnabled,
    venue: { name: event.venue.name, city: event.venue.city, address: event.venue.address },
  };
}

export async function updateEventBasics(eventId: string, value: EventBasicsInput) {
  const current = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { description: true, venueId: true },
  });

  const rejectionMessage = parseEventRejectionMessage(current.description);
  const questions = parseBuyerQuestions(current.description);
  const guestFields = parseGuestFields(current.description);
  const eventType = parseEventType(current.description);
  const media = parseEventMedia(current.description);

  let description = withBuyerQuestions(
    withEventRejectionMessage(withEventMedia(value.description, media), rejectionMessage),
    questions,
  );
  description = `${stripEventMarkers(description)}\n${serializeGuestFields(guestFields)}`;
  description = withEventType(description, eventType);

  await db.$transaction([
    db.event.update({
      where: { id: eventId },
      data: {
        title: value.title,
        description,
        posterUrl: value.posterUrl,
        startsAt: new Date(value.startsAt),
      },
    }),
    db.venue.update({
      where: { id: current.venueId },
      data: { name: value.venueName, city: value.city, address: value.address },
    }),
  ]);

  const walletTickets = await db.ticket.findMany({ where: { order: { eventId } }, select: { id: true } });
  if (walletTickets.length) {
    await db.ticket.updateMany({
      where: { id: { in: walletTickets.map((ticket) => ticket.id) } },
      data: { walletUpdatedAt: new Date() },
    });
    await notifyWalletTickets(walletTickets.map((ticket) => ticket.id));
  }
}
