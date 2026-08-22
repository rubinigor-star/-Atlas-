import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ScannerClient } from "@/components/scanner-client";
import { AdminShell } from "@/components/admin-shell";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { localeTag, resolveStaffLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type CountRow = { count: number | bigint };

export default async function Scanner() {
  const staff = await requirePermission("SCAN");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const c=locale==="he"?{title:"סריקת כרטיסים",intro:"בקרת כניסה מהנייד, נתוני האירוע וחיפוש מהיר של אורחים.",entered:"נכנסו",time:"שעה",result:"תוצאה",guest:"אורח",category:"קטגוריה",event:"אירוע",code:"קוד"}:locale==="en"?{title:"Ticket scanner",intro:"Mobile door control, live event statistics and quick guest search.",entered:"Entered",time:"Time",result:"Result",guest:"Guest",category:"Category",event:"Event",code:"Code"}:{title:"Сканер билетов",intro:"Мобильный контроль входа, статистика мероприятия и быстрый поиск гостя.",entered:"Вошли",time:"Время",result:"Результат",guest:"Гость",category:"Категория",event:"Мероприятие",code:"Код"};
  await ensureExternalTicketStorage();
  const allowedEvents = staff.eventAccess.map((item) => item.eventId);
  const scopedIds = staff.eventScope === "ALL" ? undefined : allowedEvents;
  const eventFilter = {
    organizationId: staff.organizationId!,
    ...(scopedIds ? { id: { in: scopedIds } } : {}),
  };

  const [events, scans] = await Promise.all([
    db.event.findMany({ where: eventFilter, orderBy: { startsAt: "asc" }, select: { id: true, title: true, startsAt: true, categories: { select: { capacity: true } } } }),
    db.scan.findMany({ where: { ticket: { order: { event: eventFilter } } }, take: 20, orderBy: { scannedAt: "desc" }, include: { ticket: { include: { category: true, order: { include: { event: true } } } } } }),
  ]);

  const eventOptions = await Promise.all(events.map(async (event) => {
    const [nativeSold, nativeEntered, externalSoldRows, externalEnteredRows] = await Promise.all([
      db.ticket.count({ where: { order: { eventId: event.id, status: "PAID" } } }),
      db.ticket.count({ where: { status: "USED", order: { eventId: event.id, status: "PAID" } } }),
      db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) AS "count" FROM "ExternalTicket" WHERE "eventId"=$1 AND "status"!='CANCELLED'`, event.id),
      db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) AS "count" FROM "ExternalTicket" WHERE "eventId"=$1 AND "status"='USED'`, event.id),
    ]);
    const externalSold = Number(externalSoldRows[0]?.count || 0);
    const externalEntered = Number(externalEnteredRows[0]?.count || 0);
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      capacity: event.categories.reduce((sum, category) => sum + category.capacity, 0),
      sold: nativeSold + externalSold,
      entered: nativeEntered + externalEntered,
    };
  }));

  const totalEntered = eventOptions.reduce((sum, event) => sum + event.entered, 0);

  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Door control</span><h1>{c.title}</h1><p>{c.intro}</p></div><span className="office-live"><i/>{c.entered}: {totalEntered}</span></div><div className="office-scanner"><ScannerClient initialEntered={totalEntered} events={eventOptions}/><div className="table-wrap"><table><thead><tr><th>{c.time}</th><th>{c.result}</th><th>{c.guest}</th><th>{c.category}</th><th>{c.event}</th><th>{c.code}</th></tr></thead><tbody>{scans.map((scan) => <tr key={scan.id}><td>{scan.scannedAt.toLocaleString(localeTag(locale), { timeZone: "Asia/Jerusalem" })}</td><td><span className="pill">{scan.result}</span></td><td>{scan.ticket?.holderName ?? "-"}</td><td>{scan.ticket?.category.name ?? "-"}</td><td>{scan.ticket?.order.event.title ?? "-"}</td><td>{scan.ticket?.publicCode.slice(0, 16) ?? "-"}</td></tr>)}</tbody></table></div></div></AdminShell>;
}
