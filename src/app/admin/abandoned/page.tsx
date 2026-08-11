import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AbandonedTable } from "@/components/abandoned-table";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { recoveryDashboard } from "@/lib/abandoned-checkout";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { cleanupFalseRecoveredCheckouts, getAbandonedPromoterSources } from "@/lib/abandoned-order-attribution";

export const dynamic = "force-dynamic";

function number(value: bigint | number) { return Number(value || 0); }
function stageLabel(stage: string) {
  if (stage === "PAYMENT_STARTED") return "Перешёл к оплате";
  if (stage === "CONTACTS_ENTERED") return "Оставил контакты";
  return "Открыл оформление";
}
function statusInfo(status: string, abandonedAt: Date | null, action: string | null, stage: string) {
  if (status === "RECOVERED") return { label: "Восстановлено", tone: "recovered" as const };
  if (status === "OPTED_OUT") return { label: "Клиент отказался", tone: "neutral" as const };
  if (status === "STOPPED") return { label: "Напоминания остановлены", tone: "neutral" as const };
  if (action === "SENT") return { label: "Email отправлен", tone: "sent" as const };
  if (action === "FAILED") return { label: "Ошибка отправки", tone: "failed" as const };
  if (action === "SKIPPED") return { label: "Канал недоступен", tone: "neutral" as const };
  if (abandonedAt) return { label: "Потерянная продажа", tone: "lost" as const };
  if (stage === "PAYMENT_STARTED") return { label: "На странице оплаты", tone: "payment" as const };
  return { label: "Сейчас оформляет", tone: "live" as const };
}

export default async function AbandonedSalesPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  await refreshAbandonedCheckoutStatuses();
  await cleanupFalseRecoveredCheckouts();
  const allowedEventIds = staff.eventAccess.map(item => item.eventId);
  const data = await recoveryDashboard(staff.organizationId!, allowedEventIds.length ? allowedEventIds : undefined);
  const sources = await getAbandonedPromoterSources(data.recent.map(item => item.id));
  const sourceByCheckout = new Map(sources.map(source => [source.checkoutId, source]));
  const active = number(data.totals.activeCount);
  const recovered = number(data.totals.recoveredCount);
  const live = number(data.totals.inProgressCount);
  const totalFinished = active + recovered;
  const recoveryRate = totalFinished ? Math.round(recovered / totalFinished * 100) : 0;
  const formatter = new Intl.DateTimeFormat("ru-IL",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Jerusalem"});
  const items = data.recent.map(item => {
    const status = statusInfo(item.status,item.abandonedAt,item.actionStatus,item.stage);
    const source = sourceByCheckout.get(item.id);
    return {
      id:item.id,
      customerName:[item.customerFirstName,item.customerLastName].filter(Boolean).join(" ")||"Не представился",
      customerContact:item.customerEmail||item.customerPhone||"Контакт не оставлен",
      eventTitle:item.eventTitle,
      sourceLabel:source?`Промоутер · ${source.promoterName}`:"Прямой / другой источник",
      stageLabel:stageLabel(item.stage),
      amountLabel:money(item.amountMinor),
      activityLabel:formatter.format(new Date(item.lastActivityAt)),
      statusLabel:status.label,
      statusTone:status.tone,
    };
  });

  return <AdminShell>
    <div className="office-page-heading">
      <div><span className="eyebrow">Recovery Center</span><h1>Потерянные продажи</h1><p>Текущие оформления, брошенные покупки и восстановленная выручка по каждому мероприятию.</p></div>
      <Link href="/office/abandoned/settings" prefetch={false} className="btn">Настроить сценарий</Link>
    </div>

    <div className="stats">
      <div className="stat"><span className="muted">Сейчас оформляют</span><strong>{live}</strong></div>
      <div className="stat"><span className="muted">Потерянные покупки</span><strong>{active}</strong></div>
      <div className="stat"><span className="muted">Потенциальная выручка</span><strong>{money(number(data.totals.potentialMinor))}</strong></div>
      <div className="stat"><span className="muted">Восстановлено</span><strong>{recovered}</strong><small>{money(number(data.totals.recoveredMinor))}</small></div>
      <div className="stat"><span className="muted">Конверсия восстановления</span><strong>{recoveryRate}%</strong></div>
    </div>

    <div className="panel" style={{marginTop:24}}>
      <div className="row between"><div><span className="eyebrow">Автоматизация</span><h2 style={{marginBottom:4}}>Текущий сценарий</h2></div><span className="pill" style={{background:"#dcfae6",color:"#067647"}}>Активен</span></div>
      <div className="row" style={{flexWrap:"wrap",gap:10,marginTop:16}}>
        <div className="stat"><span className="muted">По настроенному таймеру без активности</span><strong style={{fontSize:18}}>Первый Email</strong></div>
        <span style={{fontSize:24}}>→</span>
        <div className="stat"><span className="muted">По второй задержке</span><strong style={{fontSize:18}}>Финальный Email</strong></div>
        <span style={{fontSize:24}}>→</span>
        <div className="stat"><span className="muted">После оплаты или ручной остановки</span><strong style={{fontSize:18}}>Сценарий закрывается</strong></div>
      </div>
      <p className="muted" style={{marginBottom:0}}>Нажмите «Настроить сценарий», чтобы изменить задержки или временно отключить автоматические письма.</p>
    </div>

    <div className="row between" style={{marginTop:30}}><h2 className="section-title">Последняя активность клиентов</h2><span className="muted">Вся строка открывает карточку клиента</span></div>
    <AbandonedTable items={items}/>
  </AdminShell>;
}
