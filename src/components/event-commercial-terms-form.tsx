"use client";

import { useState } from "react";

export function EventCommercialTermsForm({
  eventId,
  initial,
}: {
  eventId: string;
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

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="row between">
      <div>
        <span className="eyebrow">Условия продажи</span>
        <h2 style={{ marginBottom: 6 }}>Сервисный сбор</h2>
        <p className="muted" style={{ margin: 0 }}>Настройка действует только для этого мероприятия.</p>
      </div>
    </div>

    <label className="row" style={{ alignItems: "center", marginTop: 20 }}>
      <input
        type="checkbox"
        checked={useOrganizerDefaults}
        onChange={(event) => setUseOrganizerDefaults(event.target.checked)}
      />
      <span>Использовать условия организатора</span>
    </label>

    {useOrganizerDefaults ? <div className="stat" style={{ marginTop: 16 }}>
      <span className="muted">Сейчас оплачивает</span>
      <strong>{initial.organizerServiceFeePayer === "BUYER" ? "Покупатель" : "Организатор"}</strong>
    </div> : <label style={{ display: "block", marginTop: 16 }}>
      <span className="muted">Кто оплачивает сервисный сбор</span>
      <select value={serviceFeePayer} onChange={(event) => setServiceFeePayer(event.target.value as "BUYER" | "ORGANIZER")} style={{ width: "100%", marginTop: 8 }}>
        <option value="BUYER">Покупатель - сбор добавляется к цене заказа</option>
        <option value="ORGANIZER">Организатор - сбор удерживается из выплаты</option>
      </select>
    </label>}

    <div className="row" style={{ marginTop: 18 }}>
      <button className="btn" type="button" disabled={saving} onClick={save}>{saving ? "Сохраняем..." : "Сохранить условия"}</button>
      {message && <span className="muted">{message}</span>}
    </div>
  </section>;
}
