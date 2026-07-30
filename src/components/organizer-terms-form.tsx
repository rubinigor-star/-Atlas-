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
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof Terms>(key: K, value: Terms[K]) => setForm((current) => ({ ...current, [key]: value }));

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
    <div><span className="eyebrow">Условия продажи</span><h2>Базовые условия организатора</h2><p className="muted">Эти значения применяются по умолчанию ко всем новым мероприятиям. Плательщика сервисного сбора организатор сможет изменить в конкретном мероприятии.</p></div>
    <div className="form-grid">
      <label>Комиссия Atlas, %<input disabled={readOnly} type="number" min="0" max="100" step="0.01" value={form.salesFeePercentBps / 100} onChange={(e) => set("salesFeePercentBps", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Фиксированная часть за билет, ₪<input disabled={readOnly} type="number" min="0" step="0.01" value={form.salesFeeFixedMinor / 100} onChange={(e) => set("salesFeeFixedMinor", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Кто оплачивает сервисный сбор<select disabled={readOnly} value={form.serviceFeePayer} onChange={(e) => set("serviceFeePayer", e.target.value as Terms["serviceFeePayer"])}><option value="BUYER">Покупатель</option><option value="ORGANIZER">Организатор</option></select></label>
      <label>Возвраты<select disabled={readOnly} value={form.refundsEnabled ? "YES" : "NO"} onChange={(e) => set("refundsEnabled", e.target.value === "YES")}><option value="YES">Разрешены</option><option value="NO">Запрещены</option></select></label>
      <label>Комиссия за возврат, %<input disabled={readOnly || !form.refundsEnabled} type="number" min="0" max="100" step="0.01" value={form.refundFeePercentBps / 100} onChange={(e) => set("refundFeePercentBps", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Фиксированная комиссия за возврат, ₪<input disabled={readOnly || !form.refundsEnabled} type="number" min="0" step="0.01" value={form.refundFeeFixedMinor / 100} onChange={(e) => set("refundFeeFixedMinor", Math.round(Number(e.target.value) * 100))}/></label>
      <label>Возврат доступен не позднее, часов до события<input disabled={readOnly || !form.refundsEnabled} type="number" min="0" step="1" value={form.refundDeadlineHours} onChange={(e) => set("refundDeadlineHours", Math.max(0, Number(e.target.value)))} /></label>
      <label>Окно возврата после переноса, дней<input disabled={readOnly} type="number" min="0" step="1" value={form.transferRefundWindowDays} onChange={(e) => set("transferRefundWindowDays", Math.max(0, Number(e.target.value)))} /></label>
    </div>
    {!readOnly && <div className="row"><button className="btn" disabled={saving} onClick={save}>{saving ? "Сохранение..." : "Сохранить условия"}</button>{message && <span className="muted">{message}</span>}</div>}
  </div>;
}
