"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Terms = {
  salesFeePercentBps: number;
  salesFeeFixedMinor: number;
  serviceFeePayer: "BUYER" | "ORGANIZER";
  refundsEnabled: boolean;
  refundFeePercentBps: number;
  refundFeeFixedMinor: number;
  refundDeadlineHours: number;
  transferRefundWindowDays: number;
};

export function OrganizerTermsForm({ organizationId, initial, readOnly = false }: { organizationId: string; initial: Terms; readOnly?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    salesFeePercentBps: initial.salesFeePercentBps,
    salesFeeFixedMinor: initial.salesFeeFixedMinor,
    serviceFeePayer: initial.serviceFeePayer,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/platform/organizers/${organizationId}/terms`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage("Не удалось сохранить условия");
      return;
    }
    setMessage("Условия сохранены");
    router.refresh();
  }

  return <div className="card stack">
    <div>
      <span className="eyebrow">Условия продажи</span>
      <h2>Базовые условия организатора</h2>
      <p className="muted">Эти значения применяются по умолчанию к продажам. Плательщика сервисного сбора можно переопределить для конкретного мероприятия.</p>
    </div>
    <div className="form-grid">
      <label>Комиссия Atlas, %<input disabled={readOnly} type="number" min="0" max="100" step="0.01" value={form.salesFeePercentBps / 100} onChange={(e) => set("salesFeePercentBps", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Фиксированная часть за билет, ₪<input disabled={readOnly} type="number" min="0" step="0.01" value={form.salesFeeFixedMinor / 100} onChange={(e) => set("salesFeeFixedMinor", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Кто оплачивает сервисный сбор<select disabled={readOnly} value={form.serviceFeePayer} onChange={(e) => set("serviceFeePayer", e.target.value as "BUYER" | "ORGANIZER")}><option value="BUYER">Покупатель</option><option value="ORGANIZER">Организатор</option></select></label>
    </div>

    <div className="platform-section-card" style={{marginTop:6,boxShadow:"none"}}>
      <span className="eyebrow">Отмена заказа</span>
      <h3 style={{margin:"6px 0 10px"}}>Единая политика Cancellation</h3>
      <p className="muted" style={{marginTop:0}}>Эти правила не редактируются в коммерческих условиях организатора. Они применяются единым Cancellation-модулем Atlas.</p>
      <div className="platform-readiness-grid" style={{marginTop:14}}>
        <div className="platform-readiness-item ready"><b>5%</b><div><strong>Комиссия за отмену</strong><small>5% от суммы операции, максимум 100 ₪</small></div></div>
        <div className="platform-readiness-item ready"><b>+</b><div><strong>Sales fee сохраняется</strong><small>Комиссия первоначальной продажи не аннулируется при возврате</small></div></div>
        <div className="platform-readiness-item ready"><b>−</b><div><strong>Нагрузка организатора</strong><small>Фактический refund клиенту + комиссия отмены уменьшают баланс организатора</small></div></div>
      </div>
      <p className="muted" style={{marginBottom:0}}>Право клиента на отмену определяется Cancellation-модулем и применимой политикой/законодательством. Добровольный возврат сверх стандартной суммы оплачивается из баланса организатора.</p>
    </div>

    {!readOnly && <div className="row"><button className="btn" disabled={saving} onClick={save}>{saving ? "Сохранение..." : "Сохранить условия"}</button>{message && <span className="muted">{message}</span>}</div>}
  </div>;
}
