import { db } from "@/lib/db";
import { claimNotification, completeNotification, failNotification } from "@/lib/notification-ledger";
import { sendSms019 } from "@/lib/sms-019";
import { shortTicketUrl } from "@/lib/short-ticket-link";
import { normalizeLocale } from "@/lib/i18n";

export function getSmsPriceMinor() {
  const value = Number(process.env.SMS_PRICE_MINOR ?? "20");
  return Number.isInteger(value) && value >= 0 ? value : 20;
}

export const ticketSmsCopy = {
  ru: { event:"Ваши билеты на", ready:"готовы", order:"Заказ", tickets:"Билеты" },
  he: { event:"הכרטיסים לאירוע", ready:"מוכנים", order:"הזמנה", tickets:"לצפייה בכרטיסים" },
  en: { event:"Your tickets for", ready:"are ready", order:"Order", tickets:"Tickets" },
} as const;

export async function sendOrderTicketSms(publicId: string, options?: { automatic?: boolean }) {
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: true, tickets: true },
  });

  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "PAID") throw new Error("Билет можно отправить только после оплаты");
  if (!order.tickets.length) throw new Error("В заказе ещё нет билетов");

  const automatic = Boolean(options?.automatic);
  // The first ticket-delivery SMS is included in the sale and is free for the organizer.
  // Only an explicit later resend is a paid additional service. Automatic retries keep
  // the same zero-priced dedupe record, so a provider retry can never become billable.
  const priceMinor = automatic ? 0 : getSmsPriceMinor();
  const claim = await claimNotification({
    dedupeKey: automatic ? `ticket-sms:auto:${order.id}` : undefined,
    organizationId: order.event.organizationId,
    orderId: order.id,
    channel: "SMS",
    type: automatic ? "TICKET_AUTO" : "TICKET_RESEND",
    recipient: order.customerPhone,
    priceMinor,
    metadata: { publicId: order.publicId, eventId: order.eventId },
  });

  if (!claim.claimed) {
    return { recipient: order.customerPhone, providerStatus: "ALREADY_SENT", priceMinor: 0, alreadySent: true };
  }

  try {
    const ticketUrl = await shortTicketUrl(order.publicId);
    const locale=normalizeLocale(order.communicationLocale);
    const text=ticketSmsCopy[locale];
    const eventMessage=`${text.event} ${order.event.title} ${text.ready}.`;
    const message = `${eventMessage} ${text.order}: ${order.publicId}. ${text.tickets}: ${ticketUrl}`;
    const result = await sendSms019({ phone: order.customerPhone, message, campaignName: `ticket-${order.publicId}` });

    if (!result.ok) {
      const errorMessage = result.providerMessage || `019SMS error ${result.status}`;
      await failNotification(claim.id!, errorMessage, result.providerStatus);
      console.error("ticket_sms.failed", { publicId, providerStatus: result.providerStatus ?? null, providerMessage: errorMessage, httpStatus: result.status });
      throw new Error(errorMessage);
    }

    await completeNotification(claim.id!, { providerStatus: result.providerStatus, providerMessage: result.providerMessage });
    console.info("ticket_sms.sent", { publicId, providerStatus: result.providerStatus ?? null, recipient: order.customerPhone, priceMinor });
    return { recipient: order.customerPhone, providerStatus: result.providerStatus ?? null, priceMinor, alreadySent: false, ticketUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMS error";
    await failNotification(claim.id!, message).catch(() => undefined);
    console.error("ticket_sms.exception", { publicId, message });
    throw error;
  }
}
