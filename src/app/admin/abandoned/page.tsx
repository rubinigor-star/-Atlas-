import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { prepareRecoveryActions, recoveryDashboard } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

function number(value: bigint | number) { return Number(value || 0); }
function stageLabel(stage: string) {
  if (stage === "PAYMENT_STARTED") return "Перешёл к оплате";
  if (stage === "CONTACTS_ENTERED") return "Оставил контакты";
  return "Открыл оформление";
}
function statusLabel(item: { status: string; actionStatus: string | null; abandonedAt: Date | null; stage: string }) {
  if (item.status === "RECOVERED") return "Восстановлено";
  if (!item.abandonedAt) return item.stage === "PAYMENT_STARTED" ? "На странице оплаты" : "Сейчас оформляет";
  if (item.actionStatus === "SENT") return "Email отправлен";
  if (item.actionStatus === "FAILED") return "Ошибка отправки";
  if (item.actionStatus === "SKIPPED") return "Канал недоступен";
  return "Потерянная продажа";
}

export default async function AbandonedSalesPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  await prepareRecoveryActions();
  const allowedEventIds = staff.eventAccess.map(item => item.eventId);
  const data = await recoveryDashboard(staff.organizationId!, allowedEventIds.length ? allowedEventIds : undefined);
  const active = number(data.totals.activeCount);
  const inProgress = number(data.totals.inProgressCount);
  const recovered = number(data.totals.recoveredCount);
  const totalFinished = active + recovered;
  const recoveryRate = totalFinished ? Math.round(recovered / totalFinished * 100) : 0;

  return <AdminShell>
    <div className="office-page-heading">
      <div><span className="eyebrow">Recovery Center</span><h1>Потерянные продажи</h1><p>Клиент появляется здесь сразу после ввода email или телефона. Через 30 минут без активности Atlas отмечает покупку как потерянную и запускает восстановление.</p></div>
      <span className="pill">Email подключён</span>
    </div>

    <div className="stats">
      <div className="stat"><span className="muted">Сейчас оформляют</span><strong>{inProgress}</strong></div>
      <div className="stat"><span className="muted">Потерянные покупки</span><strong>{active}</strong><small>{money(number(data.totals.potentialMinor))}</small></div>
      <div className="stat"><span className="muted">Восстановлено</span><strong>{recovered}</strong><small>{money(number(data.totals.recoveredMinor))}</small></div>
      <div className="stat"><span className="muted">Конверсия восстановления</span><strong>{recoveryRate}%</strong></div>
    </div>

    <div className="panel" style={{marginTop:24}}>
      <div className="row between"><div><span className="eyebrow">Автоматизация</span><h2 style={{marginBottom:4}}>Текущий сценарий</h2></div><span className="pill">Активен</span></div>
      <div className="row" style={{flexWrap:"wrap",gap:10,marginTop:16}}>
        <div className="stat"><span className="muted">30 минут без активности</span><strong style={{fontSize:18}}>Первый Email сразу</strong></div>
        <span style={{fontSize:24}}>→</span>
        <div className="stat"><span className="muted">Через 24 часа</span><strong style={{fontSize:18}}>Финальный Email</strong></div>
        <span style={{fontSize:24}}>→</span>
        <div className="stat"><span className="muted">После оплаты</span><strong style={{fontSize:18}}>Сценарий закрывается</strong></div>
      </div>
    </div>

    <div className="row between" style={{marginTop:30}}><h2 className="section-title">Последняя активность клиентов</h2><span className="muted">Показано до 100 записей</span></div>
    <div className="table-wrap"><table><thead><tr><th>Клиент</th><th>Мероприятие</th><th>Этап</th><th>Сумма</th><th>Последняя активность</th><th>Статус</th></tr></thead><tbody>
      {data.recent.map(item => <tr key={item.id}><td><strong>{[item.customerFirstName,item.customerLastName].filter(Boolean).join(" ")||"Не представился"}</strong><br/><small>{item.customerEmail||item.customerPhone||"Контакт не оставлен"}</small></td><td>{item.eventTitle}</td><td>{stageLabel(item.stage)}</td><td>{money(item.amountMinor)}</td><td>{new Intl.DateTimeFormat("ru-IL",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Jerusalem"}).format(new Date(item.lastActivityAt))}</td><td><span className="pill">{statusLabel(item)}</span></td></tr>)}
      {!data.recent.length && <tr><td colSpan={6}>Пока нет клиентов, оставивших email или телефон.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
