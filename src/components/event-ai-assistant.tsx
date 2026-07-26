"use client";

import { useMemo, useState } from "react";
import { Bot, Check, ChevronRight, Loader2, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import styles from "./event-ai-assistant.module.css";

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
    <section className={styles.hero}>
      <div className={styles.main}>
        <div className={styles.copy}>
          <div className={styles.brandRow}>
            <span className={styles.iconBox}><Sparkles size={22}/></span>
            <span className={styles.brand}>Atlas AI</span>
            <span className={styles.level}>уровень мероприятия</span>
          </div>
          <h2 className={styles.title}>Настройте мероприятие обычными словами</h2>
          <p className={styles.description}>Помощник видит текущее мероприятие, категории и режим продаж. Сначала он показывает безопасный план изменений, и только после подтверждения настройки могут быть применены.</p>
        </div>

        <div className={styles.actionWrap}>
          <button className={styles.openButton} type="button" onClick={() => setOpen(true)}>
            <Sparkles size={20}/>
            <span>Открыть помощника</span>
            <ChevronRight size={18}/>
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>Мероприятие:<b>{event.title}</b></div>
        <div className={styles.metaItem}>Категорий:<b>{event.categories.length}</b></div>
        <div className={styles.metaItem}>Продажа:<b>{event.salesMode === "INSTANT" ? "автоматическая" : "по одобрению"}</b></div>
      </div>
    </section>

    {open && <div role="dialog" aria-modal="true" className={styles.overlay} onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
      <aside className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <div className={styles.drawerBrand}>
            <span className={styles.iconBox}><Bot size={22}/></span>
            <div className={styles.drawerBrandText}><strong>Atlas AI</strong><small>{event.title}</small></div>
          </div>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} className={styles.closeButton}><X size={19}/></button>
        </header>

        <div className={styles.drawerBody}>
          <div className="panel" style={{ background: "white", margin: 0 }}><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}><ShieldCheck size={18}/><strong>Контекст мероприятия загружен</strong></div><p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{event.venue} · {new Date(event.startsAt).toLocaleString("ru-IL")}<br/>{categorySummary || "Категории пока не созданы"}</p></div>

          {!plan && <div><p style={{ marginTop: 0 }}><strong>Что нужно настроить или проверить?</strong></p><div style={{ display: "grid", gap: 8 }}>{examples.map((example) => <button key={example} type="button" onClick={() => setMessage(example)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe4f0", background: "white", cursor: "pointer", color: "#27364b", lineHeight: 1.45 }}>{example}</button>)}</div></div>}

          {busy && <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", background: "white" }}><Loader2 className="spin" size={20}/><div><strong>Анализирую настройки</strong><div className="muted">Формирую понятный план без изменения данных.</div></div></div>}
          {error && <div className="toast">{error}</div>}

          {plan && <div style={{ display: "grid", gap: 14 }}>
            <div className="panel" style={{ background: "#eef6ff", borderColor: "#cfe4ff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><strong>Предлагаемый план</strong><span className="pill">{plan.mode === "live" ? "AI" : "Демо-режим"}</span></div><p style={{ marginBottom: 0, lineHeight: 1.55 }}>{plan.summary}</p></div>
            {plan.changes.map((item, index) => <div className="panel" key={`${item.title}-${index}`} style={{ background: "white", display: "grid", gridTemplateColumns: "32px minmax(0,1fr)", gap: 12, margin: 0 }}><span style={{ width: 32, height: 32, borderRadius: 10, background: item.risk === "safe" ? "#e9f9ef" : "#fff4df", color: item.risk === "safe" ? "#15713a" : "#9a5b00", display: "grid", placeItems: "center" }}><Check size={17}/></span><div><strong>{item.title}</strong><p className="muted" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>{item.detail}</p></div></div>)}
            {plan.notes.length > 0 && <div className="panel" style={{ background: "#fffaf0" }}><strong>Обратите внимание</strong>{plan.notes.map((note) => <p className="muted" key={note} style={{ marginBottom: 0 }}>• {note}</p>)}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><button className="btn" type="button" onClick={() => setPlan(null)}>Изменить запрос</button><button className="btn dark" type="button" disabled title="Применение будет включено после финальной проверки исполнительного слоя">Применить после проверки</button></div>
          </div>}
        </div>

        <footer className={styles.drawerFooter}>
          <div className={styles.composer}><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} rows={3} placeholder="Например: создай две категории билетов и настрой обычную продажу…" className={styles.textarea}/><button className={`btn dark ${styles.sendButton}`} type="button" onClick={() => void ask()} disabled={busy || !message.trim()}>{busy ? <Loader2 className="spin" size={18}/> : <Send size={18}/>}</button></div>
          <small className="muted" style={{ display: "block", marginTop: 8 }}>Enter — отправить · Shift+Enter — новая строка. Никакие изменения не применяются без подтверждения.</small>
        </footer>
      </aside>
    </div>}
  </>;
}
