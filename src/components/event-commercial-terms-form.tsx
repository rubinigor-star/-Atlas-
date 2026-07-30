"use client";

import { useState } from "react";

export function EventCommercialTermsForm({ eventId, initial, organizerName, isSuperAdmin }: {
  eventId: string;
  organizerName: string;
  isSuperAdmin: boolean;
  initial: { useOrganizerDefaults: boolean; serviceFeePayer: "BUYER" | "ORGANIZER"; organizerServiceFeePayer: "BUYER" | "ORGANIZER" };
}) {
  const [useOrganizerDefaults, setUseOrganizerDefaults] = useState(initial.useOrganizerDefaults);
  const [serviceFeePayer, setServiceFeePayer] = useState(initial.serviceFeePayer);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const effectivePayer = useOrganizerDefaults ? initial.organizerServiceFeePayer : serviceFeePayer;

  async function save() {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/office/events/${eventId}/commercial-terms`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ useOrganizerDefaults, serviceFeePayer }) });
    setSaving(false); setMessage(response.ok ? "Условия мероприятия сохранены" : "Не удалось сохранить условия");
  }

  const summaryStyle = { border: "1px solid var(--line)", borderRadius: 14, padding: 18, display: "grid", gap: 7, background: "#fff" } as const;

  return <section className="card" style={{ marginTop: 20, padding: 26, overflow: "visible" }}>
    <div className="row between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 18 }}>
      <div style={{ display: "grid", gap: 7 }}>
        <span className="eyebrow">Условия продажи</span>
        <h2 style={{ margin: 0, fontSize: 28 }}>Сервисный сбор</h2>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>Настройка определяет, кто оплачивает сервисный сбор именно для этого мероприятия.</p>
      </div>
      <span className="pill">Уровень мероприятия</span>
    </div>

    {isSuperAdmin && <div style={{ marginTop: 20, padding: 16, borderRadius: 14, background: "#eef5ff", border: "1px solid #cfe0ff", display: "grid", gap: 5 }}>
      <strong>Режим суперадминистратора</strong>
      <span>Организатор: {organizerName}</span>
      <small className="muted">Ты редактируешь исключение конкретного мероприятия. Базовые комиссии и договоры задаются на уровне организатора.</small>
    </div>}

    <label style={{ marginTop: 20, padding: 16, border: "1px solid var(--line)", borderRadius: 14, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
      <input type="checkbox" checked={useOrganizerDefaults} onChange={(event) => setUseOrganizerDefaults(event.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
      <span style={{ display: "grid", gap: 4 }}><strong>Использовать условия организатора</strong><small className="muted">Применить базовое правило компании {organizerName}.</small></span>
    </label>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginTop: 16 }}>
      <div style={summaryStyle}>
        <span className="muted">Базовое правило организатора</span>
        <strong style={{ fontSize: 22 }}>{initial.organizerServiceFeePayer === "BUYER" ? "Платит покупатель" : "Платит организатор"}</strong>
        <small>{initial.organizerServiceFeePayer === "BUYER" ? "Сбор добавляется к сумме заказа" : "Сбор удерживается из выплаты организатору"}</small>
      </div>
      <div style={{ ...summaryStyle, background: "#fff8f6", borderColor: "#ffc7bd" }}>
        <span className="muted">Действует на мероприятии</span>
        <strong style={{ fontSize: 22 }}>{effectivePayer === "BUYER" ? "Платит покупатель" : "Платит организатор"}</strong>
        <small>{useOrganizerDefaults ? "Наследуется из условий организатора" : "Индивидуальное правило мероприятия"}</small>
      </div>
    </div>

    {!useOrganizerDefaults && <label className="field" style={{ marginTop: 18 }}>
      <span>Кто оплачивает сервисный сбор</span>
      <select value={serviceFeePayer} onChange={(event) => setServiceFeePayer(event.target.value as "BUYER" | "ORGANIZER")}>
        <option value="BUYER">Покупатель, сбор добавляется к цене заказа</option>
        <option value="ORGANIZER">Организатор, сбор удерживается из выплаты</option>
      </select>
      <small className="muted">Это правило переопределит базовые условия только для текущего мероприятия.</small>
    </label>}

    <div className="row" style={{ marginTop: 20, flexWrap: "wrap" }}>
      <button className="btn" type="button" disabled={saving} onClick={save}>{saving ? "Сохраняем..." : "Сохранить условия"}</button>
      {message && <span className="muted">{message}</span>}
    </div>
  </section>;
}
