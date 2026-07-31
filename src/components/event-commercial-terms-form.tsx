"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";
import { calculateServiceFee } from "@/lib/service-fee";

export function EventCommercialTermsForm({ eventId, initial, organizerName, isSuperAdmin }: {
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
  const [organizerPayer, setOrganizerPayer] = useState(initial.organizerServiceFeePayer);
  const [percentBps, setPercentBps] = useState(0);
  const [fixedMinor, setFixedMinor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/office/events/${eventId}/commercial-terms`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.terms) return;
        setPercentBps(data.terms.organizer.salesFeePercentBps);
        setFixedMinor(data.terms.organizer.salesFeeFixedMinor);
        setOrganizerPayer(data.terms.organizer.serviceFeePayer);
      })
      .catch(() => undefined);
  }, [eventId]);

  const effectivePayer = useOrganizerDefaults ? organizerPayer : serviceFeePayer;
  const example = useMemo(() => calculateServiceFee(10000, {
    salesFeePercentBps: percentBps,
    salesFeeFixedMinor: fixedMinor,
    serviceFeePayer: effectivePayer,
  }), [effectivePayer, fixedMinor, percentBps]);
  const percentLabel = `${(percentBps / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
  const feeLabel = `${percentLabel}${fixedMinor ? ` + ${money(fixedMinor)}` : ""}`;

  async function save() {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/office/events/${eventId}/commercial-terms`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ useOrganizerDefaults, serviceFeePayer }),
    });
    setSaving(false);
    setMessage(response.ok ? "Условия сохранены" : "Не удалось сохранить условия");
  }

  const optionStyle = (selected: boolean) => ({
    border: selected ? "2px solid #ff7900" : "1px solid var(--line)",
    borderRadius: 16,
    padding: 18,
    background: selected ? "#fff8f0" : "#fff",
    cursor: "pointer",
    display: "grid",
    gap: 7,
    textAlign: "left" as const,
  });

  return <section className="card" style={{ marginTop: 20, padding: 26, overflow: "visible" }}>
    <div style={{ display: "grid", gap: 7 }}>
      <span className="eyebrow">Условия продажи</span>
      <h2 style={{ margin: 0, fontSize: 28 }}>Кто оплачивает сервисный сбор?</h2>
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>Выберите, будет ли сбор добавлен к заказу покупателя или удержан из вашей выплаты.</p>
    </div>

    {isSuperAdmin && <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "#eef5ff", border: "1px solid #cfe0ff" }}><strong>Организатор: {organizerName}</strong></div>}

    <div style={{ marginTop: 20, padding: 18, borderRadius: 16, background: "#f8fafc", border: "1px solid var(--line)", display: "grid", gap: 8 }}>
      <div className="row between" style={{ flexWrap: "wrap", gap: 10 }}><strong>Размер сервисного сбора</strong><strong style={{ fontSize: 22 }}>{feeLabel}</strong></div>
      <small className="muted">Размер комиссии установлен в условиях организатора. Здесь выбирается только тот, кто её оплачивает.</small>
    </div>

    <label style={{ marginTop: 18, padding: 16, border: "1px solid var(--line)", borderRadius: 14, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
      <input type="checkbox" checked={useOrganizerDefaults} onChange={(event) => setUseOrganizerDefaults(event.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
      <span style={{ display: "grid", gap: 4 }}><strong>Использовать стандартное правило организатора</strong><small className="muted">Сейчас для {organizerName}: {organizerPayer === "BUYER" ? "сервисный сбор оплачивает покупатель" : "сервисный сбор оплачивает организатор"}.</small></span>
    </label>

    {!useOrganizerDefaults && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 16 }}>
      <button type="button" onClick={() => setServiceFeePayer("BUYER")} style={optionStyle(serviceFeePayer === "BUYER")}><span style={{ fontSize: 22 }}>{serviceFeePayer === "BUYER" ? "✓ " : ""}<strong>Платит покупатель</strong></span><span>Сбор добавляется сверху к стоимости билетов.</span></button>
      <button type="button" onClick={() => setServiceFeePayer("ORGANIZER")} style={optionStyle(serviceFeePayer === "ORGANIZER")}><span style={{ fontSize: 22 }}>{serviceFeePayer === "ORGANIZER" ? "✓ " : ""}<strong>Плачу я как организатор</strong></span><span>Покупатель платит только за билеты, а сбор удерживается из вашей выплаты.</span></button>
    </div>}

    <div style={{ marginTop: 16, padding: 20, borderRadius: 16, background: effectivePayer === "BUYER" ? "#f0f9ff" : "#fff7ed", border: effectivePayer === "BUYER" ? "1px solid #bae6fd" : "1px solid #fed7aa", display: "grid", gap: 10 }}>
      <strong style={{ fontSize: 21 }}>{effectivePayer === "BUYER" ? "Для этого мероприятия сбор оплачивает покупатель" : "Для этого мероприятия сбор оплачивает организатор"}</strong>
      <div className="row between"><span>Пример: билеты</span><strong>{money(example.subtotalMinor)}</strong></div>
      <div className="row between"><span>Сервисный сбор</span><strong>{money(example.serviceFeeMinor)}</strong></div>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      <div className="row between"><span>Покупатель оплачивает</span><strong style={{ fontSize: 20 }}>{money(example.buyerTotalMinor)}</strong></div>
      <div className="row between"><span>Организатор получает до других удержаний</span><strong style={{ fontSize: 20 }}>{money(example.organizerNetMinor)}</strong></div>
    </div>

    <div className="row" style={{ marginTop: 20, flexWrap: "wrap" }}><button className="btn" type="button" disabled={saving} onClick={save}>{saving ? "Сохраняем..." : "Сохранить условия"}</button>{message && <span className="muted">{message}</span>}</div>
  </section>;
}
