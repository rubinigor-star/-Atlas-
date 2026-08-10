import { db } from "@/lib/db";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { parseEventMedia, withEventMedia, type EventMediaItem } from "@/lib/event-media";
import { parseEventRejectionMessage, withEventRejectionMessage } from "@/lib/event-approval-message";
import { parseBuyerQuestions, withBuyerQuestions } from "@/lib/buyer-questions";
import { parseGuestFields, serializeGuestFields, stripEventMarkers } from "@/lib/event-guest-fields";
import { parseEventTypes, withEventTypes, type EventType } from "@/lib/event-type";
import { parseEventPresentation, withEventPresentation, stripEventPresentation, type EventPresentation } from "@/lib/event-presentation";
import { getEventLanguageSettings, saveEventLanguageSettings } from "@/lib/event-language-server";
import type { EventLanguageSettings } from "@/lib/event-language";

export type EventBasicsInput = {
  title: string;
  description: string;
  posterUrl: string;
  startsAt: string;
  venueName: string;
  city: string;
  address: string;
  presentation: EventPresentation;
  media: EventMediaItem[];
  eventTypes: EventType[];
  language: EventLanguageSettings;
};

export async function getEventBasics(eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, include: { venue: true } });
  if (!event) return null;
  const language = await getEventLanguageSettings(eventId);
  return {
    id: event.id,
    title: event.title,
    description: stripEventPresentation(stripEventMarkers(event.description)),
    posterUrl: event.posterUrl,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    salesMode: event.salesMode,
    mapEnabled: event.mapEnabled,
    venue: { name: event.venue.name, city: event.venue.city, address: event.venue.address },
    presentation: parseEventPresentation(event.description),
    media: parseEventMedia(event.description),
    eventTypes: parseEventTypes(event.description),
    language,
  };
}

export async function updateEventBasics(eventId: string, value: EventBasicsInput, updatedBy: string | null = null) {
  const current = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { description: true, venueId: true } });
  const rejectionMessage = parseEventRejectionMessage(current.description);
  const questions = parseBuyerQuestions(current.description);
  const guestFields = parseGuestFields(current.description);

  let description = withEventPresentation(value.description, value.presentation);
  description = withEventMedia(description, value.media);
  description = withEventRejectionMessage(description, rejectionMessage);
  description = withBuyerQuestions(description, questions);
  description = `${stripEventMarkers(description)}\n${serializeGuestFields(guestFields)}`;
  description = withEventTypes(description, value.eventTypes);

  await db.$transaction([
    db.event.update({ where: { id: eventId }, data: { title: value.title, description, posterUrl: value.posterUrl, startsAt: new Date(value.startsAt) } }),
    db.venue.update({ where: { id: current.venueId }, data: { name: value.venueName, city: value.city, address: value.address } }),
  ]);
  await saveEventLanguageSettings(eventId, value.language, updatedBy);

  const walletTickets = await db.ticket.findMany({ where: { order: { eventId } }, select: { id: true } });
  if (walletTickets.length) {
    await db.ticket.updateMany({ where: { id: { in: walletTickets.map((ticket) => ticket.id) } }, data: { walletUpdatedAt: new Date() } });
    await notifyWalletTickets(walletTickets.map((ticket) => ticket.id));
  }
}
