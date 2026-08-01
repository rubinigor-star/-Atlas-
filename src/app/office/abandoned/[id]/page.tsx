import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

type Row = {
  id: string; eventId: string; eventTitle: string; customerFirstName: string | null; customerLastName: string | null;
  customerEmail: string | null; customerPhone: string | null; quantity: number; amountMinor: number; stage: string; status: string;
  checkoutUrl: string; lastActivityAt: Date; abandonedAt: Date | null; recoveredAt: Date | null; createdAt: Date;
};

export default async function AbandonedDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const { id } = await params;
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Row[]>(`SELECT c.*,e."title" AS "eventTitle" FROM "AbandonedCheckout" c JOIN "Event" e ON e."id"=c."eventId" WHERE c."id"=$1 AND c."organizationId"=$2 LIMIT 1`, id, staff.organizationId);
  const item = rows[0];
  if (!item) notFound();
  const scoped = staff.eventAccess.map(access => access.eventId);
  if (scoped.length && !scoped.includes(item.eventId)) notFound();
  const name = [item.customerFirstName, item.customerLastName].filter(Boolean).join(" ") || "Не представился";
  const format = (value: Date | null) => value ? new Intl.DateTimeFormat("ru-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value)) : "-";
  return <AdminShell>
    <div className="office-page-heading"><div><Link href="/office/abandoned">← Потерянные продажи</Link><h1>{name}</h1><p>{item.eventTitle}</p></div><span className="pill">{item.status === "RECOVERED" ? "Восстановлено" : item.abandonedAt ? "Потерянная продажа" : "Сейчас оформляет"}</span></div>
    <div className="stats">
      <div className="stat"><span className="muted">Сумма</span><strong>{money(item.amountMinor)}</strong></div>
      <div className="stat"><span className="muted">Билетов</span><strong>{item.quantity}</strong></div>
      <div className="stat"><span className="muted">Последняя активность</span><strong style={{fontSize:18}}>{format(item.lastActivityAt)}</strong></div>
    </div>
    <div className="panel" style={{marginTop:24}}>
      <h2>Карточка клиента</h2>
      <div className="row between"><span>Email</span><strong>{item.customerEmail || "-"}</strong></div>
      <div className="row between"><span>Телефон</span><strong>{item.customerPhone || "-"}</strong></div>
      <div className="row between"><span>Этап</span><strong>{item.stage === "PAYMENT_STARTED" ? "Перешёл к оплате" : item.stage === "CONTACTS_ENTERED" ? "Оставил контакты" : "Открыл оформление"}</strong></div>
      <div className="row between"><span>Начал оформление</span><strong>{format(item.createdAt)}</strong></div>
      <div className="row between"><span>Покинул оформление</span><strong>{format(item.abandonedAt)}</strong></div>
      <div className="row between"><span>Восстановлен</span><strong>{format(item.recoveredAt)}</strong></div>
      <div style={{marginTop:20,display:"flex",gap:10,flexWrap:"wrap"}}>
        <a className="btn dark" href={item.checkoutUrl} target="_blank" rel="noreferrer">Открыть корзину клиента</a>
        {item.customerEmail && <a className="btn" href={`mailto:${item.customerEmail}`}>Написать Email</a>}
        {item.customerPhone && <a className="btn" href={`tel:${item.customerPhone}`}>Позвонить</a>}
      </div>
    </div>
  </AdminShell>;
}
