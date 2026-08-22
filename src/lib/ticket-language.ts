import type { TicketDesign, TicketElement, TicketRenderData } from "@/lib/ticket-template";

export type TicketLocale = "ru" | "he" | "en";

const LOCALE_MARKER = "__ATLAS_TICKET_LOCALE__:";

export const ticketCopy = {
  ru: {
    event: "СОБЫТИЕ", date: "ДАТА", ticket: "БИЛЕТ", guest: "ГОСТЬ", venue: "Площадка",
    order: "Заказ", code: "Код билета", support: "Важно", status: "СТАТУС",
    valid: "ДЕЙСТВИТЕЛЕН", used: "ИСПОЛЬЗОВАН", cancelled: "ОТМЕНЁН", refunded: "ВОЗВРАЩЁН",
    singleUse: "QR-код действителен для одного прохода. Передача билета третьим лицам регулируется организатором.",
  },
  he: {
    event: "אירוע", date: "תאריך", ticket: "כרטיס", guest: "אורח", venue: "מקום",
    order: "הזמנה", code: "קוד כרטיס", support: "חשוב", status: "סטטוס",
    valid: "בתוקף", used: "מומש", cancelled: "בוטל", refunded: "הוחזר",
    singleUse: "קוד ה-QR תקף לכניסה אחת בלבד. העברת הכרטיס לצד שלישי כפופה למדיניות המארגן.",
  },
  en: {
    event: "EVENT", date: "DATE", ticket: "TICKET", guest: "GUEST", venue: "Venue",
    order: "Order", code: "Ticket code", support: "Important", status: "STATUS",
    valid: "VALID", used: "USED", cancelled: "CANCELLED", refunded: "REFUNDED",
    singleUse: "The QR code is valid for one admission only. Ticket transfers are subject to the organizer's policy.",
  },
} as const;

export function getTicketLocale(design?: TicketDesign | null, transactionLocale?: string | null): TicketLocale {
  if (transactionLocale === "ru" || transactionLocale === "he" || transactionLocale === "en") return transactionLocale;
  const marker = design?.elements.find(element => element.hidden && element.binding === "CUSTOM" && element.content.startsWith(LOCALE_MARKER));
  const locale = marker?.content.slice(LOCALE_MARKER.length);
  return locale === "he" || locale === "en" ? locale : "ru";
}

export function withTicketLocale(design: TicketDesign, locale: TicketLocale): TicketDesign {
  const elements = design.elements.filter(element => !(element.hidden && element.binding === "CUSTOM" && element.content.startsWith(LOCALE_MARKER)));
  const marker: TicketElement = {
    id: "atlas-ticket-locale",
    binding: "CUSTOM",
    x: 0,
    y: 0,
    width: 5,
    height: 3,
    content: `${LOCALE_MARKER}${locale}`,
    fontSize: 8,
    color: "#FFFFFF",
    align: "left",
    bold: false,
    hidden: true,
  };
  return { ...design, elements: [...elements, marker] };
}

export function localeTag(locale: TicketLocale) {
  return locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : "ru-RU";
}

export function formatTicketDate(value: Date, locale: TicketLocale) {
  return value.toLocaleDateString(localeTag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" });
}

export function formatTicketTime(value: Date, locale: TicketLocale) {
  return value.toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export function resolveLocalizedTicketText(element: TicketElement, data: TicketRenderData, locale: TicketLocale) {
  switch (element.binding) {
    case "CUSTOM": return element.content;
    case "EVENT_TITLE": return data.eventTitle;
    case "EVENT_DATE": return formatTicketDate(data.startsAt, locale);
    case "EVENT_TIME": return formatTicketTime(data.startsAt, locale);
    case "VENUE": return data.venue;
    case "ADDRESS": return data.address;
    case "CUSTOMER_NAME": return data.customerName;
    case "TICKET_TYPE": return data.ticketType;
    case "ORDER_NUMBER": return data.orderNumber;
    case "TICKET_CODE": return data.ticketCode;
    default: return element.content;
  }
}

export function localizedStatus(status: "VALID" | "USED" | "CANCELLED" | "REFUNDED", locale: TicketLocale) {
  const copy = ticketCopy[locale];
  if (status === "USED") return copy.used;
  if (status === "CANCELLED") return copy.cancelled;
  if (status === "REFUNDED") return copy.refunded;
  return copy.valid;
}
