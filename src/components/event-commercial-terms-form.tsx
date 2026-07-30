"use client";

import { useState } from "react";

export function EventCommercialTermsForm({
  eventId,
  initial,
  organizerName,
  isSuperAdmin,
}: {
  eventId: string;
  organizerName: string;
  isSuperAdmin: boolean;
  initial: {
    useOrganizerDefaults: boolean;
    serviceFeePayer: "BUYER" | "ORGANIZER";
    organizerServiceFeePayer: "BUYER" | "ORGANIZER";
  };
}) {
  const [useOrganizerDefaults, setUseOrganizerDefaults] = useState(initial.useOrganizerDefaults);
  const [serviceFeePayer, setServiceFeePayer] = useState(initial.serviceFeePayer);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const effectivePayer = useOrganizerDefaults ? initial.organizerServiceFeePayer : serviceFeePayer;

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/office/events/${eventId}/commercial-terms`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ useOrganizerDefaults, serviceFeePayer }),
    });
    setSaving(false);
    setMessage(response.ok ? "Условия мероприятия сохранены" : "Не удалось сохранить условия");
  }

  return <section className="card settings-card commercial-terms-card">
    <div className="settings-card-head">
      <div>
        <span className="eyebrow">Условия продажи</span>
        <h2>Сервисный сбор</h2>
        <p className="muted">Настройка определяет, кто оплачивает сервисный сбор именно для этого мероприятия.</p>
      </div>
      <span className="pill">Уровень мероприятия</span>
    </div>

    {isSuperAdmin && <div className="role-context-banner">
      <strong>Режим суперадминистратора</strong>
      <span>Организатор: {organizerName}</span>
      <small>Ты редактируешь исключение для конкретного мероприятия. Базовые комиссии и договоры задаются в карточке организатора.</small>
    </div>}

    <label className="settings-toggle">
      <input type="checkbox" checked={useOrganizerDefaults} onChange={(event) => setUseOrganizerDefaults(event.target.checked)} />
      <span><strong>Использовать условия организатора</strong><small>Применить базовое правило компании {organizerName}.</small></span>
    </label>

    <div className="commercial-summary-grid">
      <div className="commercial-summary">
        <span className="muted">Базовое правило организатора</span>
        <strong>{initial.organizerServiceFeePayer === "BUYER" ? "Платит покупатель" : "Платит организатор"}</strong>
        <small>{initial.organizerServiceFeePayer === "BUYER" ? "Сбор добавляется к сумме заказа" : "Сбор удерживается из выплаты организатору"}</small>
      </div>
      <div className="commercial-summary active">
        <span className="muted">Действует на мероприятии</span>
        <strong>{effectivePayer === "BUYER" ? "Платит покупатель" : "Платит организатор"}</strong>
        <small>{useOrganizerDefaults ? "Наследуется из условий организатора" : "Индивидуальное правило мероприятия"}</small>
      </div>
    </div>

    {!useOrganizerDefaults && <label className="field settings-field">
      <span>Кто оплачивает сервисный сбор</span>
      <select value={serviceFeePayer} onChange={(event) => setServiceFeePayer(event.target.value as "BUYER" | "ORGANIZER")}>
        <option value="BUYER">Покупатель, сбор добавляется к цене заказа</option>
        <option value="ORGANIZER">Организатор, сбор удерживается из выплаты</option>
      </select>
      <small className="muted">Это правило переопределит базовые условия только для текущего мероприятия.</small>
    </label>}

    <div className="settings-actions">
      <button className="btn" type="button" disabled={saving} onClick={save}>{saving ? "Сохраняем..." : "Сохранить условия"}</button>
      {message && <span className="muted">{message}</span>}
    </div>
  </section>;
}
