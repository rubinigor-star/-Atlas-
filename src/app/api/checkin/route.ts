import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkinSchema } from "@/lib/schemas";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { checkInTicket, normalizeTicketCode, type CheckinResult } from "@/lib/checkin";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { checkInExternalTicket } from "@/lib/external-tickets";
import { resolveStaffLocale,type Locale } from "@/lib/i18n";

type UnifiedCheckinResult = CheckinResult & { externalTicketId?: string; sourceName?: string; platformKey?: string | null };
type CountRow = { count: number | bigint };
const copy={
 ru:{VALID:"Вход разрешён",USED:"Этот билет уже был использован",CANCELLED:"Билет отменён или заказ не оплачен",NOT_FOUND:"Билет не найден",WRONG_EVENT:"Билет относится к другому мероприятию",TOO_EARLY:"Для этого мероприятия вход ещё не открыт",manual:"Проверьте билет вручную",forbidden:"Недостаточно прав",failed:"Не удалось проверить билет"},
 he:{VALID:"אפשר להיכנס",USED:"הכרטיס כבר מומש",CANCELLED:"הכרטיס בוטל או שההזמנה לא שולמה",NOT_FOUND:"הכרטיס לא נמצא",WRONG_EVENT:"הכרטיס שייך לאירוע אחר",TOO_EARLY:"הכניסה לאירוע עדיין לא נפתחה",manual:"יש לבדוק את הכרטיס ידנית",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לבדוק את הכרטיס"},
 en:{VALID:"Entry allowed",USED:"This ticket has already been used",CANCELLED:"The ticket was cancelled or the order is unpaid",NOT_FOUND:"Ticket not found",WRONG_EVENT:"This ticket belongs to a different event",TOO_EARLY:"Admission is not open for this event yet",manual:"Check the ticket manually",forbidden:"Insufficient permission",failed:"The ticket could not be verified"}
} as const;
function localeForStaff(staff:Awaited<ReturnType<typeof requirePermission>>):Locale{return resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale})}

export async function POST(req: Request) {
  let responseLocale:Locale="ru";
  try {
    const staff = await requirePermission("SCAN");
    responseLocale=localeForStaff(staff);
    const payload = await req.json();
    const { code } = checkinSchema.parse(payload);
    const selectedEventId = typeof payload.eventId === "string" && payload.eventId ? payload.eventId : null;
    if (selectedEventId && !canAccessEvent(staff, selectedEventId)) throw new Error("FORBIDDEN");
    const source = payload.source === "MANUAL" ? "MANUAL" : "CAMERA";
    const normalizedCode = normalizeTicketCode(code);
    let result: UnifiedCheckinResult = await checkInTicket({ code: normalizedCode, staff, selectedEventId, deferNotFoundAudit: Boolean(selectedEventId) });

    if (result.status === "NOT_FOUND" && selectedEventId) {
      await ensureExternalTicketStorage();
      const external = await checkInExternalTicket(selectedEventId, normalizedCode);
      if (external.status === "AMBIGUOUS") {
        await db.scan.create({ data: { result: "NOT_FOUND" } });
        result = { status: "NOT_FOUND", message: copy[responseLocale].NOT_FOUND, eventId: selectedEventId, warning: copy[responseLocale].manual };
      } else if (external.status === "NOT_FOUND") {
        await db.scan.create({ data: { result: "NOT_FOUND" } });
      } else {
        result = { status: external.status, message: external.message, externalTicketId: external.externalTicketId, eventId: external.eventId, holderName: external.holderName, categoryName: external.categoryName, sourceName: external.sourceName, platformKey: external.platformKey };
      }
    }

    const localizedMessage=copy[responseLocale][result.status];
    const localizedWarning=result.warning?copy[responseLocale].manual:undefined;
    await writeAudit(staff, { action: `CHECKIN_${result.status}`, entityType: result.externalTicketId ? "ExternalTicket" : "Ticket", entityId: result.externalTicketId || result.ticketId, summary: `CHECKIN_${result.status}`, metadata: { code: normalizedCode.slice(0, 12), source, ticketSource: result.sourceName || "Atlas", eventId: result.eventId || selectedEventId, userAgent: req.headers.get("user-agent")?.slice(0, 180) || undefined } });
    if (result.status === "VALID" && result.ticketId) await notifyWalletTickets([result.ticketId]);

    const allowedEvents = staff.eventAccess.map((item) => item.eventId);
    const scopedIds = staff.eventScope === "ALL" ? undefined : allowedEvents;
    const eventScope = selectedEventId ? { eventId: selectedEventId } : scopedIds ? { eventId: { in: scopedIds } } : {};
    const nativeEntered = await db.ticket.count({ where: { status: "USED", order: { status: "PAID", event: { organizationId: staff.organizationId! }, ...eventScope } } });
    let externalEntered = 0;
    if (selectedEventId) { await ensureExternalTicketStorage(); const counts = await db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) AS "count" FROM "ExternalTicket" WHERE "eventId"=$1 AND "status"='USED'`, selectedEventId); externalEntered = Number(counts[0]?.count || 0); }
    return NextResponse.json({ ...result, message:localizedMessage, warning:localizedWarning, entered: nativeEntered + externalEntered, scannedAt: new Date().toISOString() });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    const c=copy[responseLocale];
    return NextResponse.json({ status: "NOT_FOUND", message: forbidden ? c.forbidden : c.failed, entered: 0, scannedAt: new Date().toISOString() }, { status: forbidden ? 403 : 400 });
  }
}
