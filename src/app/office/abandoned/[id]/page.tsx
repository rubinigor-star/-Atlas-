import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StopAbandonedRemindersButton } from "@/components/stop-abandoned-reminders-button";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";
import { getAbandonedPromoterSources } from "@/lib/abandoned-order-attribution";

export const dynamic = "force-dynamic";

type Row = {
  id: string; eventId: string; eventTitle: string; customerFirstName: string | null; customerLastName: string | null;
  customerEmail: string | null; customerPhone: string | null; quantity: number; amountMinor: number; stage: string; status: string;
  checkoutUrl: string; lastActivityAt: Date; abandonedAt: Date | null; recoveredAt: Date | null; optOutAt: Date | null; stopReason: string | null; createdAt: Date;
};
type Action = { id:string; position:number; templateKey:string; channel:string; status:string; scheduledAt:Date; sentAt:Date|null; providerId:string|null; error:string|null; createdAt:Date };

function actionLabel(action: Action) {
  const step = action.position === 1 ? "Первое напоминание" : action.position === 2 ? "Финальное напоминание" : `Шаг ${action.position}`;
  if (action.status === "SENT") return `${step} отправлено`;
  if (action.status === "FAILED") return `${step}: ошибка отправки`;
  if (action.status === "SKIPPED") return `${step}: пропущено`;
  if (action.status === "CANCELLED") return `${step}: отменено`;
  return `${step} запланировано`;
}

export default async function AbandonedDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const { id } = await params;
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Row[]>(`SELECT c.*,e."title" AS "eventTitle" FROM "AbandonedCheckout" c JOIN "Event" e ON e."id"=c."eventId" WHERE c."id"=$1 AND c."organizationId"=$2 LIMIT 1`, id, staff.organizationId);
  const item = rows[0];
  if (!item) notFound();
  const scoped = staff.eventAccess.map(access => access.eventId);
  if (scoped.length && !scoped.includes(item.eventId)) notFound();
  const actions = await db.$queryRawUnsafe<Action[]>(`SELECT a."id",s."position",s."templateKey",a."channel",a."status",a."scheduledAt",a."sentAt",a."providerId",a."error",a."createdAt" FROM "RecoveryAction" a JOIN "RecoveryScenarioStep" s ON s."id"=a."scenarioStepId" WHERE a."checkoutId"=$1 ORDER BY a."createdAt" ASC`, id);
  const sources = await getAbandonedPromoterSources([id]);
  const source = sources[0];
  const sourceLabel = source ? `Промоутер · ${source.promoterName} · ${source.linkLabel}` : "Прямой / другой источник";
  const name = [item.customerFirstName, item.customerLastName].filter(Boolean).join(" ") || "Не представился";
  const format = (value: Date | null) => value ? new Intl.DateTimeFormat("ru-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value)) : "-";
  const statusLabel = item.status === "RECOVERED" ? "Восстановлено" : item.status === "OPTED_OUT" ? "Клиент отказался" : item.status === "STOPPED" ? "Напоминания остановлены" : item.abandonedAt ? "Потерянная продажа" : "Сейчас оформляет";
  const timeline = [
    { at:item.createdAt, title:"Оформление начато", detail:"Клиент открыл checkout" },
    item.customerEmail || item.customerPhone ? { at:item.lastActivityAt, title:"Контакты сохранены", detail:item.customerEmail || item.customerPhone || "" } : null,
    item.abandonedAt ? { at:item.abandonedAt, title:"Покупка признана потерянной", detail:"Запущен сценарий восстановления" } : null,
    ...actions.map(action => ({ at:action.sentAt || action.scheduledAt || action.createdAt, title:actionLabel(action), detail:[action.channel,action.error,action.providerId].filter(Boolean).join(" · ") })),
    item.status === "STOPPED" ? { at:item.lastActivityAt, title:"Напоминания остановлены", detail:item.stopReason || "Сценарий остановлен" } : null,
    item.optOutAt ? { at:item.optOutAt, title:"Клиент отказался от напоминаний", detail:"Все будущие действия отменены" } : null,
    item.recoveredAt ? { at:item.recoveredAt, title:"Покупка восстановлена", detail:"Сценарий остановлен после возврата и оплаты" } : null,
  ].filter(Boolean) as Array<{at:Date;title:string;detail:string}>;
  timeline.sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());

  return <AdminShell>
    <div className="office-page-heading"><div><Link href="/office/abandoned" prefetch={false}>← Потерянные продажи</Link><h1>{name}</h1><p>{item.eventTitle}</p></div><span className="pill">{statusLabel}</span></div>
    <div className="stats">
      <div className="stat"><span className="muted">Сумма</span><strong>{money(item.amountMinor)}</strong></div>
      <div className="stat"><span className="muted">Билетов</span><strong>{item.quantity}</strong></div>
      <div className="stat"><span className="muted">Последняя активность</span><strong style={{fontSize:18}}>{format(item.lastActivityAt)}</strong></div>
    </div>
    <div className="panel" style={{marginTop:24}}>
      <h2>Карточка клиента</h2>
      <div className="row between"><span>Email</span><strong>{item.customerEmail || "-"}</strong></div>
      <div className="row between"><span>Телефон</span><strong>{item.customerPhone || "-"}</strong></div>
      <div className="row between"><span>Источник</span><strong>{sourceLabel}</strong></div>
      <div className="row between"><span>Этап</span><strong>{item.stage === "PAYMENT_STARTED" ? "Перешёл к оплате" : item.stage === "CONTACTS_ENTERED" ? "Оставил контакты" : "Открыл оформление"}</strong></div>
      <div className="row between"><span>Начал оформление</span><strong>{format(item.createdAt)}</strong></div>
      <div className="row between"><span>Покинул оформление</span><strong>{format(item.abandonedAt)}</strong></div>
      <div className="row between"><span>Восстановлен</span><strong>{format(item.recoveredAt)}</strong></div>
      <div className="row between"><span>Причина остановки</span><strong>{item.stopReason || "-"}</strong></div>
      <div style={{marginTop:20,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-start"}}>
        <a className="btn dark" href={item.checkoutUrl} target="_blank" rel="noreferrer">Открыть корзину клиента</a>
        {item.customerEmail && <a className="btn" href={`mailto:${item.customerEmail}`}>Написать Email</a>}
        {item.customerPhone && <a className="btn" href={`tel:${item.customerPhone}`}>Позвонить</a>}
        {item.status === "ACTIVE" && item.abandonedAt && <StopAbandonedRemindersButton checkoutId={item.id}/>} 
      </div>
    </div>
    <div className="panel" style={{marginTop:24}}>
      <span className="eyebrow">История автоматизации</span><h2>Timeline</h2>
      <div style={{display:"grid",gap:14,marginTop:18}}>
        {timeline.map((entry,index)=><div key={`${entry.title}-${index}`} style={{display:"grid",gridTemplateColumns:"150px 1fr",gap:16,paddingBottom:14,borderBottom:index===timeline.length-1?"none":"1px solid #e5e7eb"}}><span className="muted">{format(entry.at)}</span><div><strong>{entry.title}</strong>{entry.detail&&<div className="muted" style={{marginTop:3}}>{entry.detail}</div>}</div></div>)}
        {!timeline.length&&<p className="muted">История пока пуста.</p>}
      </div>
    </div>
  </AdminShell>;
}
