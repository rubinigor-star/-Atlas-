"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ChevronLeft, ChevronRight, Loader2, Mic, Send, ShieldCheck, Sparkles, Square, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "./event-ai-assistant.module.css";

type EventContext = {
  id: string; title: string; status: string; salesMode: string; startsAt: string; venue: string;
  categories: Array<{ id: string; name: string; priceMinor: number; capacity: number; sold: number; pricingMode: string }>;
};
type PlanItem = { title: string; detail: string; risk: "safe" | "review" };
type AssistantPlan = { summary: string; notes: string[]; changes: PlanItem[]; mode: "demo" | "live" };

const copy = {
  ru: {
    level: "уровень мероприятия", title: "Настройте мероприятие обычными словами", description: "Помощник видит текущее мероприятие, категории и режим продаж. Сначала он показывает безопасный план изменений, и только после подтверждения настройки могут быть применены.",
    open: "Открыть помощника", event: "Мероприятие", categories: "Категорий", sale: "Продажа", automatic: "автоматическая", approval: "по одобрению", close: "Закрыть", context: "Контекст мероприятия загружен", noCategories: "Категории пока не созданы", question: "Что нужно настроить или проверить?", analyzing: "Анализирую настройки", analyzingHelp: "Формирую понятный план без изменения данных.", plan: "Предлагаемый план", demo: "Демо-режим", attention: "Обратите внимание", revise: "Изменить запрос", apply: "Применить после проверки", applyTitle: "Применение будет включено после финальной проверки исполнительного слоя", placeholder: "Например: создай две категории билетов и настрой обычную продажу…", hint: "Enter - отправить · Shift+Enter - новая строка. Никакие изменения не применяются без подтверждения.", error: "Не удалось подготовить план", places: "мест",
    mic: "Записать голосом", stop: "Остановить запись", cancel: "Отменить запись", listening: "Слушаю", transcribing: "Распознаю речь", transcribeError: "Не удалось распознать голос", micDenied: "Разрешите доступ к микрофону в настройках браузера", micUnavailable: "На этом устройстве запись голоса недоступна", maxRecording: "Максимум 2 минуты", transcriptReady: "Текст распознан. Проверьте его и отправьте.",
    examples: ["Создай обычную продажу: Dance Floor 400 билетов по 129 ₪ и VIP 80 билетов по 299 ₪. Максимум 6 билетов в заказе.", "Проверь настройки мероприятия и скажи, чего не хватает перед публикацией.", "Настрой обязательные поля покупателя: имя, телефон и email. Выбери шаблон Classic 1."],
  },
  he: {
    level: "ברמת האירוע", title: "הגדירו את האירוע במילים פשוטות", description: "העוזר מכיר את האירוע הנוכחי, קטגוריות הכרטיסים ומצב המכירה. תחילה הוא מציג תוכנית שינויים בטוחה, ורק לאחר אישור ניתן יהיה להחיל אותה.",
    open: "פתיחת העוזר", event: "אירוע", categories: "קטגוריות", sale: "מכירה", automatic: "אוטומטית", approval: "באישור", close: "סגירה", context: "הקשר האירוע נטען", noCategories: "טרם נוצרו קטגוריות", question: "מה תרצו להגדיר או לבדוק?", analyzing: "בודק את ההגדרות", analyzingHelp: "מכין תוכנית ברורה ללא שינוי נתונים.", plan: "תוכנית מוצעת", demo: "מצב הדגמה", attention: "חשוב לשים לב", revise: "שינוי הבקשה", apply: "החלה לאחר בדיקה", applyTitle: "החלת שינויים תופעל לאחר בדיקה סופית של מנגנון הביצוע", placeholder: "לדוגמה: צור שתי קטגוריות כרטיסים והגדר מכירה רגילה…", hint: "Enter לשליחה · Shift+Enter לשורה חדשה. לא יוחלו שינויים ללא אישור.", error: "לא ניתן להכין את התוכנית", places: "מקומות",
    mic: "הקלטה קולית", stop: "עצירת ההקלטה", cancel: "ביטול ההקלטה", listening: "מקשיב", transcribing: "מתמלל", transcribeError: "לא ניתן היה לתמלל את ההקלטה", micDenied: "יש לאפשר גישה למיקרופון בהגדרות הדפדפן", micUnavailable: "הקלטה קולית אינה זמינה במכשיר זה", maxRecording: "עד 2 דקות", transcriptReady: "הטקסט תומלל. בדקו ושלחו אותו.",
    examples: ["צור מכירה רגילה: Dance Floor עם 400 כרטיסים ב־129 ₪ ו־VIP עם 80 כרטיסים ב־299 ₪. עד 6 כרטיסים בהזמנה.", "בדוק את הגדרות האירוע ואמור לי מה חסר לפני הפרסום.", "הגדר שדות חובה לרוכש: שם, טלפון ואימייל. בחר בתבנית Classic 1."],
  },
  en: {
    level: "event level", title: "Configure your event in plain language", description: "The assistant understands the current event, ticket categories and sales mode. It first presents a safe change plan, and settings can only be applied after confirmation.",
    open: "Open assistant", event: "Event", categories: "Categories", sale: "Sales", automatic: "automatic", approval: "approval required", close: "Close", context: "Event context loaded", noCategories: "No categories have been created yet", question: "What would you like to configure or check?", analyzing: "Reviewing settings", analyzingHelp: "Preparing a clear plan without changing any data.", plan: "Proposed plan", demo: "Demo mode", attention: "Please note", revise: "Edit request", apply: "Apply after review", applyTitle: "Applying changes will be enabled after the execution layer passes final review", placeholder: "For example: create two ticket categories and configure standard sales…", hint: "Enter to send · Shift+Enter for a new line. No changes are applied without confirmation.", error: "Could not prepare the plan", places: "seats",
    mic: "Record voice", stop: "Stop recording", cancel: "Cancel recording", listening: "Listening", transcribing: "Transcribing", transcribeError: "Could not transcribe the recording", micDenied: "Allow microphone access in your browser settings", micUnavailable: "Voice recording is unavailable on this device", maxRecording: "Up to 2 minutes", transcriptReady: "Transcript ready. Review it and send.",
    examples: ["Create standard sales: 400 Dance Floor tickets at ₪129 and 80 VIP tickets at ₪299. Limit each order to 6 tickets.", "Review the event settings and tell me what is missing before publication.", "Make buyer name, phone and email required. Select the Classic 1 template."],
  },
} as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function EventAiAssistant({ event }: { event: EventContext }) {
  const { locale, dir } = useLocale();
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcribeAfterStopRef = useRef(true);
  const categorySummary = useMemo(() => event.categories.map((item) => `${item.name}: ${item.capacity} ${text.places}`).join(" · "), [event.categories, text.places]);
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((value) => {
      if (value >= 119) { stopRecording(true); return 120; }
      return value + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function ask() {
    const prompt = message.trim();
    if (!prompt) return;
    setBusy(true); setError(""); setPlan(null); setVoiceStatus("");
    try {
      const response = await fetch(`/api/admin/events/${event.id}/ai-assistant`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, locale }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || text.error);
      setPlan(data.plan);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  }

  async function transcribeAudio(blob: Blob) {
    setTranscribing(true); setError(""); setVoiceStatus("");
    try {
      const form = new FormData();
      form.append("audio", new File([blob], "atlas-voice.webm", { type: blob.type || "audio/webm" }));
      form.append("language", locale);
      const response = await fetch(`/api/admin/events/${event.id}/ai-assistant/transcribe`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || text.transcribeError);
      setMessage((current) => current.trim() ? `${current.trim()} ${data.text}` : data.text);
      setVoiceStatus(text.transcriptReady);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.transcribeError); }
    finally { setTranscribing(false); }
  }

  async function startRecording() {
    setError(""); setVoiceStatus(""); setPlan(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(text.micUnavailable); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorderRef.current = recorder; chunksRef.current = []; transcribeAfterStopRef.current = true;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; recorderRef.current = null;
        if (transcribeAfterStopRef.current && blob.size) void transcribeAudio(blob);
      };
      recorder.start(250); setRecordingSeconds(0); setRecording(true);
    } catch (cause) {
      const denied = cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError");
      setError(denied ? text.micDenied : text.micUnavailable);
    }
  }

  function stopRecording(transcribe: boolean) {
    transcribeAfterStopRef.current = transcribe;
    setRecording(false);
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    else streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  return <>
    <section className={styles.hero} dir={dir}>
      <div className={styles.main}><div className={styles.copy}><div className={styles.brandRow}><span className={styles.iconBox}><Sparkles size={22}/></span><span className={styles.brand}>Atlas AI</span><span className={styles.level}>{text.level}</span></div><h2 className={styles.title}>{text.title}</h2><p className={styles.description}>{text.description}</p></div><div className={styles.actionWrap}><button className={styles.openButton} type="button" onClick={() => setOpen(true)}><Sparkles size={20}/><span>{text.open}</span><Arrow size={18}/></button></div></div>
      <div className={styles.meta}><div className={styles.metaItem}>{text.event}:<b>{event.title}</b></div><div className={styles.metaItem}>{text.categories}:<b>{event.categories.length}</b></div><div className={styles.metaItem}>{text.sale}:<b>{event.salesMode === "INSTANT" ? text.automatic : text.approval}</b></div></div>
    </section>

    {open && <div role="dialog" aria-modal="true" className={styles.overlay} onMouseDown={(e) => { if (e.currentTarget === e.target && !recording) setOpen(false); }}>
      <aside className={styles.drawer} dir={dir}>
        <header className={styles.drawerHeader}><div className={styles.drawerBrand}><span className={styles.iconBox}><Bot size={22}/></span><div className={styles.drawerBrandText}><strong>Atlas AI</strong><small>{event.title}</small></div></div><button type="button" aria-label={text.close} onClick={() => { if (recording) stopRecording(false); setOpen(false); }} className={styles.closeButton}><X size={19}/></button></header>
        <div className={styles.drawerBody}>
          <div className="panel" style={{ background: "white", margin: 0 }}><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}><ShieldCheck size={18}/><strong>{text.context}</strong></div><p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{event.venue} · {new Date(event.startsAt).toLocaleString(locale === "he" ? "he-IL" : locale === "en" ? "en-IL" : "ru-IL")}<br/>{categorySummary || text.noCategories}</p></div>
          {!plan && <div><p style={{ marginTop: 0 }}><strong>{text.question}</strong></p><div style={{ display: "grid", gap: 8 }}>{text.examples.map((example) => <button key={example} type="button" onClick={() => setMessage(example)} style={{ textAlign: dir === "rtl" ? "right" : "left", padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe4f0", background: "white", cursor: "pointer", color: "#27364b", lineHeight: 1.45 }}>{example}</button>)}</div></div>}
          {busy && <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", background: "white" }}><Loader2 className="spin" size={20}/><div><strong>{text.analyzing}</strong><div className="muted">{text.analyzingHelp}</div></div></div>}
          {error && <div className="toast">{error}</div>}
          {plan && <div style={{ display: "grid", gap: 14 }}><div className="panel" style={{ background: "#eef6ff", borderColor: "#cfe4ff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><strong>{text.plan}</strong><span className="pill">{plan.mode === "live" ? "AI" : text.demo}</span></div><p style={{ marginBottom: 0, lineHeight: 1.55 }}>{plan.summary}</p></div>{plan.changes.map((item, index) => <div className="panel" key={`${item.title}-${index}`} style={{ background: "white", display: "grid", gridTemplateColumns: "32px minmax(0,1fr)", gap: 12, margin: 0 }}><span style={{ width: 32, height: 32, borderRadius: 10, background: item.risk === "safe" ? "#e9f9ef" : "#fff4df", color: item.risk === "safe" ? "#15713a" : "#9a5b00", display: "grid", placeItems: "center" }}><Check size={17}/></span><div><strong>{item.title}</strong><p className="muted" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>{item.detail}</p></div></div>)}{plan.notes.length > 0 && <div className="panel" style={{ background: "#fffaf0" }}><strong>{text.attention}</strong>{plan.notes.map((note) => <p className="muted" key={note} style={{ marginBottom: 0 }}>• {note}</p>)}</div>}<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><button className="btn" type="button" onClick={() => setPlan(null)}>{text.revise}</button><button className="btn dark" type="button" disabled title={text.applyTitle}>{text.apply}</button></div></div>}
        </div>
        <footer className={styles.drawerFooter}>
          {recording && <div className={styles.recordingBar}><span className={styles.recordingDot}/><strong>{text.listening}</strong><span className={styles.recordingTime}>{formatTime(recordingSeconds)} / 2:00</span><button type="button" className={styles.voiceSecondary} onClick={() => stopRecording(false)} title={text.cancel}><Trash2 size={17}/></button><button type="button" className={styles.stopButton} onClick={() => stopRecording(true)} title={text.stop}><Square size={16}/><span>{text.stop}</span></button></div>}
          <div className={styles.composer}><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} rows={3} placeholder={text.placeholder} className={styles.textarea} disabled={recording || transcribing}/><button className={styles.micButton} type="button" onClick={() => void startRecording()} disabled={busy || recording || transcribing} title={`${text.mic} · ${text.maxRecording}`}>{transcribing ? <Loader2 className="spin" size={19}/> : <Mic size={20}/>}</button><button className={`btn dark ${styles.sendButton}`} type="button" onClick={() => void ask()} disabled={busy || recording || transcribing || !message.trim()}>{busy ? <Loader2 className="spin" size={18}/> : <Send size={18}/>}</button></div>
          <small className="muted" style={{ display: "block", marginTop: 8 }}>{transcribing ? text.transcribing : voiceStatus || text.hint}</small>
        </footer>
      </aside>
    </div>}
  </>;
}
