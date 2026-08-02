"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Mail, MonitorSmartphone, WalletCards } from "lucide-react";
import type { TicketDesign } from "@/lib/ticket-template";
import { classicTicketPresets } from "@/lib/ticket-template";

type EventData = {
  id: string;
  title: string;
  startsAt: string;
  venue: string;
  address: string;
  ticketType: string;
};

type PreviewMode = "PDF" | "WALLET" | "WEB" | "EMAIL";
type Locale = "ru" | "he" | "en";

const clone = (value: TicketDesign): TicketDesign => JSON.parse(JSON.stringify(value));

const copy = {
  ru: { ticket: "Билет", guest: "Гость", category: "Категория", order: "Заказ", status: "Действителен", date: "Дата и время", venue: "Площадка", seat: "Место" },
  he: { ticket: "כרטיס", guest: "אורח", category: "קטגוריה", order: "הזמנה", status: "בתוקף", date: "תאריך ושעה", venue: "מקום", seat: "מושב" },
  en: { ticket: "Ticket", guest: "Guest", category: "Category", order: "Order", status: "Valid", date: "Date and time", venue: "Venue", seat: "Seat" },
} as const;

function QrPreview({ size = 112 }: { size?: number }) {
  return <div aria-label="QR preview" style={{ width: size, height: size, borderRadius: 12, background: "repeating-conic-gradient(#081426 0 25%,#fff 0 50%) 50% / 14px 14px", border: "8px solid white", boxShadow: "0 0 0 1px #d7dee8" }} />;
}

function Field({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return <div style={{ textAlign: align }}><small style={{ display: "block", marginBottom: 4, color: "#7b8798", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</small><strong style={{ display: "block", color: "inherit", fontSize: 14 }}>{value}</strong></div>;
}

export function TicketPresetPicker({ event, initialDesign }: { event: EventData; initialDesign: TicketDesign }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [design, setDesign] = useState(initialDesign);
  const [mode, setMode] = useState<PreviewMode>("PDF");
  const [locale, setLocale] = useState<Locale>("ru");

  const text = copy[locale];
  const rtl = locale === "he";
  const startsAt = useMemo(() => new Date(event.startsAt), [event.startsAt]);
  const date = startsAt.toLocaleDateString(locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const time = startsAt.toLocaleTimeString(locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });

  async function choose(id: string, nextDesign: TicketDesign) {
    setBusy(id);
    setMessage("");
    setDesign(clone(nextDesign));
    const response = await fetch(`/api/admin/events/${event.id}/ticket-template`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(clone(nextDesign)),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    setMessage(response.ok ? `${nextDesign.name} сохранён. Редактор ниже обновлён.` : result.error || "Не удалось сохранить шаблон");
    if (response.ok) router.refresh();
  }

  const modes: { id: PreviewMode; label: string; icon: typeof Download }[] = [
    { id: "PDF", label: "PDF", icon: Download },
    { id: "WALLET", label: "Apple Wallet", icon: WalletCards },
    { id: "WEB", label: "Страница билета", icon: MonitorSmartphone },
    { id: "EMAIL", label: "Email", icon: Mail },
  ];

  const ticketBody = <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <div><div style={{ fontWeight: 950, fontSize: 18, letterSpacing: "-.04em" }}>ATLAS <span style={{ color: design.accentColor }}>ONE</span></div><div style={{ marginTop: 5, color: "#7b8798", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>{text.ticket}</div></div>
      <span style={{ borderRadius: 999, padding: "6px 10px", background: "#eaf8f0", color: "#167647", border: "1px solid #a7dec0", fontSize: 10, fontWeight: 900 }}>{text.status.toUpperCase()}</span>
    </div>
    <h2 style={{ margin: "28px 0 8px", color: "inherit", fontSize: 28, lineHeight: 1.02, letterSpacing: "-.04em" }}>{event.title}</h2>
    <p style={{ margin: 0, color: design.textColor, opacity: .7, fontWeight: 700 }}>{date} · {time}</p>
    <div style={{ marginTop: 25, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <Field label={text.venue} value={event.venue} align={rtl ? "right" : "left"} />
      <Field label={text.category} value={event.ticketType} align={rtl ? "right" : "left"} />
      <Field label={text.guest} value={locale === "he" ? "איגור רובין" : "Igor Rubin"} align={rtl ? "right" : "left"} />
      <Field label={text.seat} value={locale === "he" ? "שורה A · מושב 12" : locale === "en" ? "Row A · Seat 12" : "Ряд A · Место 12"} align={rtl ? "right" : "left"} />
    </div>
  </>;

  return <section style={{ marginBottom: 24, border: "1px solid #dce3ec", borderRadius: 24, background: "#fff", overflow: "hidden", boxShadow: "0 18px 55px rgba(8,20,38,.08)" }}>
    <div style={{ padding: "26px 28px 22px", borderBottom: "1px solid #e6ebf2", background: "linear-gradient(135deg,#fff 0%,#f7f9fc 100%)" }}>
      <div className="row between" style={{ alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}><span className="eyebrow">Atlas Ticket Design System</span><h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>Единый дизайн билета</h1><p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Выберите основу и сразу посмотрите, как один билет будет выглядеть в PDF, Apple Wallet, на сайте и в письме. После выбора точная настройка элементов остаётся в редакторе ниже.</p></div>
        <div style={{ display: "flex", gap: 6, padding: 5, border: "1px solid #dce3ec", borderRadius: 12, background: "white" }}>{(["ru", "he", "en"] as Locale[]).map(item => <button key={item} onClick={() => setLocale(item)} style={{ border: 0, borderRadius: 8, padding: "8px 12px", cursor: "pointer", background: locale === item ? "#081426" : "transparent", color: locale === item ? "white" : "#667085", fontWeight: 900 }}>{item.toUpperCase()}</button>)}</div>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(250px,320px) minmax(0,1fr)" }} className="ticket-design-system-grid">
      <aside style={{ padding: 22, borderRight: "1px solid #e6ebf2", background: "#fbfcfe" }}>
        <h3 style={{ margin: "0 0 4px" }}>1. Выберите основу</h3>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>Выбор сохраняется для мероприятия.</p>
        <div style={{ display: "grid", gap: 9 }}>
          {classicTicketPresets.map(preset => {
            const active = design.name === preset.design.name;
            return <button key={preset.id} disabled={Boolean(busy)} onClick={() => void choose(preset.id, preset.design)} style={{ width: "100%", border: active ? `2px solid ${design.accentColor}` : "1px solid #dce3ec", borderRadius: 14, padding: 11, background: "white", cursor: "pointer", textAlign: "left", boxShadow: active ? `0 0 0 3px ${design.accentColor}20` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 58, height: 44, borderRadius: 8, background: preset.design.backgroundColor, border: "1px solid #dce3ec", position: "relative", flex: "0 0 auto" }}><i style={{ position: "absolute", left: 7, top: 8, width: 28, height: 4, borderRadius: 4, background: preset.design.textColor }}/><i style={{ position: "absolute", right: 6, bottom: 6, width: 14, height: 14, border: "3px solid white", background: "#081426" }}/></div><div style={{ flex: 1 }}><strong style={{ display: "block", color: "#081426" }}>{preset.label}</strong><small style={{ color: "#667085" }}>{busy === preset.id ? "Сохраняем…" : preset.description}</small></div>{active && <span style={{ width: 24, height: 24, borderRadius: 999, background: design.accentColor, color: "white", display: "grid", placeItems: "center" }}><Check size={15}/></span>}</div>
            </button>;
          })}
        </div>
      </aside>

      <div style={{ minWidth: 0, padding: 22 }}>
        <div className="row between" style={{ gap: 14, flexWrap: "wrap", marginBottom: 18 }}><div><h3 style={{ margin: "0 0 4px" }}>2. Проверьте все форматы</h3><p className="muted" style={{ margin: 0, fontSize: 13 }}>Это один билет и один набор данных, адаптированный под каждую платформу.</p></div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{modes.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setMode(item.id)} style={{ display: "flex", alignItems: "center", gap: 7, border: mode === item.id ? "1px solid #081426" : "1px solid #dce3ec", borderRadius: 11, padding: "9px 12px", background: mode === item.id ? "#081426" : "white", color: mode === item.id ? "white" : "#344054", cursor: "pointer", fontWeight: 800 }}><Icon size={16}/>{item.label}</button>})}</div></div>

        <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: 530, borderRadius: 20, padding: 24, background: "radial-gradient(circle at top,#eef3f9,#e6ebf2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
          {mode === "PDF" && <div style={{ width: "min(100%,390px)", minHeight: 500, borderRadius: 18, padding: 28, position: "relative", overflow: "hidden", background: design.backgroundColor, color: design.textColor, boxShadow: "0 28px 70px rgba(8,20,38,.24)" }}><div style={{ position: "absolute", inset: "0 0 auto", height: 7, background: design.accentColor }}/>{ticketBody}<div style={{ position: "absolute", left: 28, right: 28, bottom: 28, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18 }}><div><Field label={text.order} value="ATL-MS94QYR6-A350" align={rtl ? "right" : "left"}/><small style={{ display: "block", marginTop: 18, opacity: .55 }}>Powered by Atlas One</small></div><QrPreview size={120}/></div></div>}

          {mode === "WALLET" && <div style={{ width: "min(100%,390px)", borderRadius: 28, overflow: "hidden", background: design.backgroundColor, color: design.textColor, boxShadow: "0 28px 70px rgba(8,20,38,.28)" }}><div style={{ height: 145, padding: 22, background: `linear-gradient(135deg,${design.accentColor},${design.backgroundColor})`, color: "white" }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}><span>ATLAS ONE</span><span>{text.status.toUpperCase()}</span></div><h2 style={{ margin: "38px 0 0", color: "white", fontSize: 24 }}>{event.title}</h2></div><div style={{ padding: 22 }}>{ticketBody}<div style={{ marginTop: 24, display: "grid", placeItems: "center", padding: 18, background: "white", borderRadius: 18 }}><QrPreview size={160}/><small style={{ marginTop: 10, color: "#667085" }}>ATL-TKT-8F2K-92MA</small></div></div></div>}

          {mode === "WEB" && <div style={{ width: "min(100%,420px)", borderRadius: 30, padding: 12, background: "#111827", boxShadow: "0 28px 70px rgba(8,20,38,.28)" }}><div style={{ borderRadius: 22, overflow: "hidden", background: "#f7f9fc" }}><div style={{ padding: "16px 20px", background: "white", fontWeight: 950 }}>ATLAS <span style={{ color: design.accentColor }}>ONE</span></div><div style={{ margin: 14, borderRadius: 20, padding: 24, background: design.backgroundColor, color: design.textColor }}>{ticketBody}<div style={{ marginTop: 25, display: "grid", placeItems: "center" }}><QrPreview size={155}/></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, padding: "0 14px 16px" }}><button className="btn secondary">Скачать PDF</button><button className="btn" style={{ background: "#111", borderColor: "#111" }}>Apple Wallet</button></div></div></div>}

          {mode === "EMAIL" && <div style={{ width: "min(100%,620px)", borderRadius: 18, background: "white", overflow: "hidden", boxShadow: "0 28px 70px rgba(8,20,38,.2)" }}><div style={{ padding: "24px 28px", background: "#081426", color: "white", fontSize: 20, fontWeight: 950 }}>ATLAS <span style={{ color: design.accentColor }}>ONE</span></div><div style={{ padding: 28 }}><h2 style={{ margin: "0 0 8px" }}>{locale === "he" ? "הכרטיס שלך מוכן" : locale === "en" ? "Your ticket is ready" : "Ваш билет готов"}</h2><p className="muted" style={{ margin: "0 0 22px" }}>{event.title}</p><div style={{ borderRadius: 18, padding: 22, background: design.backgroundColor, color: design.textColor }}>{ticketBody}<div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><Field label={text.order} value="ATL-MS94QYR6-A350" align={rtl ? "right" : "left"}/><QrPreview size={105}/></div></div><div style={{ display: "flex", gap: 10, marginTop: 18 }}><button className="btn">Скачать PDF</button><button className="btn secondary">Добавить в Wallet</button></div></div></div>}
        </div>
        {message && <div className="toast" style={{ marginTop: 14 }}>{message}</div>}
      </div>
    </div>

    <style jsx>{`
      @media (max-width: 900px) {
        .ticket-design-system-grid { grid-template-columns: 1fr !important; }
        .ticket-design-system-grid > aside { border-right: 0 !important; border-bottom: 1px solid #e6ebf2; }
      }
    `}</style>
  </section>;
}
