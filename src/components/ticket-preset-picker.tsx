"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketDesign } from "@/lib/ticket-template";
import { classicTicketPresets } from "@/lib/ticket-template";

const clone = (value: TicketDesign): TicketDesign => JSON.parse(JSON.stringify(value));

export function TicketPresetPicker({ eventId, selectedName }: { eventId: string; selectedName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function choose(id: string, design: TicketDesign) {
    setBusy(id);
    setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}/ticket-template`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(clone(design)),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    setMessage(response.ok ? `${design.name} сохранён для мероприятия` : result.error || "Не удалось сохранить шаблон");
    if (response.ok) router.refresh();
  }

  return <section className="panel" style={{ marginBottom: 22 }}>
    <div className="row between" style={{ alignItems: "flex-start", gap: 16 }}>
      <div><span className="eyebrow">Classic collection</span><h2 style={{ margin: "5px 0" }}>Выберите шаблон билета</h2><p className="muted" style={{ margin: 0 }}>Выбор применяется к PDF, email и скачиванию билета. После выбора шаблон можно редактировать ниже.</p></div>
      <a className="btn secondary" href="/api/ticket-pdf-test" target="_blank" rel="noreferrer">Тест PDF: все 5</a>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginTop: 18 }}>
      {classicTicketPresets.map(preset => {
        const active = selectedName === preset.design.name;
        return <article key={preset.id} style={{ border: active ? "2px solid #ff5c45" : "1px solid #dce3ec", borderRadius: 14, padding: 10, background: "#fff", boxShadow: active ? "0 0 0 4px #fff0ed" : "none" }}>
          <div style={{ height: 145, borderRadius: 9, position: "relative", overflow: "hidden", padding: 11, background: preset.design.backgroundColor, boxShadow: "inset 0 0 0 1px #00000012" }}>
            <strong style={{ fontSize: 13, color: preset.design.textColor }}>ATLAS <span style={{ color: "#ff5c45" }}>ONE</span></strong>
            <div style={{ marginTop: 18, fontSize: 11, fontWeight: 900, color: preset.design.textColor }}>EVENT TITLE</div>
            <div style={{ marginTop: 10, width: "48%", display: "grid", gap: 5 }}><i style={{ height: 3, background: "#cbd5e1", borderRadius: 3 }}/><i style={{ height: 3, background: "#cbd5e1", borderRadius: 3 }}/><i style={{ height: 3, background: "#cbd5e1", borderRadius: 3 }}/></div>
            <div style={{ position: "absolute", right: 10, bottom: 12, width: 42, height: 42, display: "grid", placeItems: "center", background: "#fff", border: "1px solid #cad3df", borderRadius: 5, color: "#081426", fontSize: 24 }}>▦</div>
          </div>
          <strong style={{ display: "block", marginTop: 9 }}>{preset.label}{active ? " · выбран" : ""}</strong>
          <small className="muted" style={{ display: "block", minHeight: 34, marginTop: 4 }}>{preset.description}</small>
          <div className="row" style={{ gap: 7, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1 }} disabled={Boolean(busy)} onClick={() => void choose(preset.id, preset.design)}>{busy === preset.id ? "Сохраняем…" : "Выбрать"}</button>
            <a className="btn secondary" href={`/api/ticket-pdf-test?template=${encodeURIComponent(preset.id)}`} target="_blank" rel="noreferrer">PDF</a>
          </div>
        </article>;
      })}
    </div>
    {message && <div className="toast" style={{ marginTop: 14 }}>{message}</div>}
  </section>;
}
