"use client";

import { useMemo, useState } from "react";
import { Bot, Check, ChevronRight, Loader2, Send, ShieldCheck, Sparkles, X } from "lucide-react";

type EventContext = {
  id: string;
  title: string;
  status: string;
  salesMode: string;
  startsAt: string;
  venue: string;
  categories: Array<{ id: string; name: string; priceMinor: number; capacity: number; sold: number; pricingMode: string }>;
};

type PlanItem = { title: string; detail: string; risk: "safe" | "review" };
type AssistantPlan = { summary: string; notes: string[]; changes: PlanItem[]; mode: "demo" | "live" };

const examples = [
  "Создай обычную продажу: Dance Floor 400 билетов по 129 ₪ и VIP 80 билетов по 299 ₪. Максимум 6 билетов в заказе.",
  "Проверь настройки мероприятия и скажи, чего не хватает перед публикацией.",
  "Настрой обязательные поля покупателя: имя, телефон и email. Выбери шаблон Classic 1.",
];

export function EventAiAssistant({ event }: { event: EventContext }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const categorySummary = useMemo(() => event.categories.map((item) => `${item.name}: ${item.capacity} мест`).join(" · "), [event.categories]);

  async function ask() {
    const prompt = message.trim();
    if (!prompt) return;
    setBusy(true);
    setError("");
    setPlan(null);
    try {
      const response = await fetch(`/api/admin/events/${event.id}/ai-assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось подготовить план");
      setPlan(data.plan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подготовить план");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="panel" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(37,99,235,.16)", background: "linear-gradient(135deg,#07152b 0%,#102b55 58%,#174a7a 100%)", color: "white", boxShadow: "0 24px 70px rgba(7,21,43,.18)" }}>
      <div style={{ padding: "24px 26px", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)" }}><Sparkles size={20}/></span><span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", opacity: .72 }}>Atlas AI</span><span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,.1)" }}>уровень мероприятия</span></div>
          <h2 style={{ margin: "0 0 8px", color: "white" }}>Настройте мероприятие обычными словами</h2>
          <p style={{ margin: 0, maxWidth: 720, color: "rgba(255,255,255,.72)", lineHeight: 1.55 }}>Помощник видит текущее мероприятие, категории и режим продаж. Сначала он показывает безопасный план изменений, и только после подтверждения настройки могут быть применены.</p>
        </div>
        <button className="btn" type="button" onClick={() => setOpen(true)} style={{ background: "white", color: "#0b2345", minWidth: 190, justifyContent: "center" }}>Открыть помощника <ChevronRight size={17}/></button>
      </div>
      <div style={{ padding: "13px 26px", borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", flexWrap: "wrap", gap: 16, color: "rgba(255,255,255,.66)", fontSize: 13 }}><span>Мероприятие: <b style={{ color: "white" }}>{event.title}</b></span><span>Категорий: <b style={{ color: "white" }}>{event.categories.length}</b></span><span>Продажа: <b style={{ color: "white" }}>{event.salesMode === "INSTANT" ? "автоматическая" : "по одобрению"}</b></span></div>
    </section>

    {open && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,8,23,.58)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "flex-end" }} onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
      <aside style={{ width: "min(620px,100vw)", height: "100%", background: "#f7f9fc", boxShadow: "-30px 0 90px rgba(2,8,23,.24)", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
        <header style={{ padding: "20px 22px", background: "linear-gradient(135deg,#07152b,#123a68)", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><span style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" }}><Bot size={22}/></span><div><strong style={{ display: "block" }}>Atlas AI</strong><small style={{ color: "rgba(255,255,255,.68)" }}>{event.title}</small></div></div>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} style={{ border: 0, background: "rgba(255,255,255,.1)", color: "white", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", cursor: "pointer" }}><X size={19}/></button>
        </header>

        <div style={{ padding: 22, overflowY: "auto", display: "grid", alignContent: "start", gap: 16 }}>
          <div className="panel" style={{ background: "white", margin: 0 }}><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}><ShieldCheck size={18}/><strong>Контекст мероприятия загружен</strong></div><p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{event.venue} · {new Date(event.startsAt).toLocaleString("ru-IL")}<br/>{categorySummary || "Категории пока не созданы"}</p></div>

          {!plan && <div><p style={{ marginTop: 0 }}><strong>Что нужно настроить или проверить?</strong></p><div style={{ display: "grid", gap: 8 }}>{examples.map((example) => <button key={example} type="button" onClick={() => setMessage(example)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe4f0", background: "white", cursor: "pointer", color: "#27364b", lineHeight: 1.45 }}>{example}</button>)}</div></div>}

          {busy && <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", background: "white" }}><Loader2 className="spin" size={20}/><div><strong>Анализирую настройки</strong><div className="muted">Формирую понятный план без изменения данных.</div></div></div>}
          {error && <div className="toast">{error}</div>}

          {plan && <div style={{ display: "grid", gap: 14 }}>
            <div className="panel" style={{ background: "#eef6ff", borderColor: "#cfe4ff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><strong>Предлагаемый план</strong><span className="pill">{plan.mode === "live" ? "AI" : "Демо-режим"}</span></div><p style={{ marginBottom: 0, lineHeight: 1.55 }}>{plan.summary}</p></div>
            {plan.changes.map((item, index) => <div className="panel" key={`${item.title}-${index}`} style={{ background: "white", display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, margin: 0 }}><span style={{ width: 32, height: 32, borderRadius: 10, background: item.risk === "safe" ? "#e9f9ef" : "#fff4df", color: item.risk === "safe" ? "#15713a" : "#9a5b00", display: "grid", placeItems: "center" }}><Check size={17}/></span><div><strong>{item.title}</strong><p className="muted" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>{item.detail}</p></div></div>)}
            {plan.notes.length > 0 && <div className="panel" style={{ background: "#fffaf0" }}><strong>Обратите внимание</strong>{plan.notes.map((note) => <p className="muted" key={note} style={{ marginBottom: 0 }}>• {note}</p>)}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><button className="btn" type="button" onClick={() => setPlan(null)}>Изменить запрос</button><button className="btn dark" type="button" disabled title="Применение будет включено после финальной проверки исполнительного слоя">Применить после проверки</button></div>
          </div>}
        </div>

        <footer style={{ padding: 16, borderTop: "1px solid #e3e9f1", background: "white" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} rows={3} placeholder="Например: создай две категории билетов и настрой обычную продажу…" style={{ width: "100%", resize: "none", border: "1px solid #ccd7e5", borderRadius: 14, padding: 13, font: "inherit", boxSizing: "border-box" }}/><button className="btn dark" type="button" onClick={() => void ask()} disabled={busy || !message.trim()} style={{ width: 48, height: 48, padding: 0, display: "grid", placeItems: "center" }}>{busy ? <Loader2 className="spin" size={18}/> : <Send size={18}/>}</button></div>
          <small className="muted" style={{ display: "block", marginTop: 8 }}>Enter — отправить · Shift+Enter — новая строка. Никакие изменения не применяются без подтверждения.</small>
        </footer>
      </aside>
    </div>}
  </>;
}
