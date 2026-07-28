"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, Check, ChevronLeft, ChevronRight, Loader2, Mic, Send, ShieldCheck, Sparkles, Square, Ticket, Trash2, TrendingUp, X } from "lucide-react";
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
    level: "ваш рабочий партнёр", greeting: "Atlas уже посмотрел мероприятие", description: "Я вижу настройки, билеты и режим продаж. Могу проверить мероприятие, предложить улучшения или подготовить безопасный план изменений.",
    open: "Поговорить с Atlas", event: "Мероприятие", categories: "Категорий", sale: "Продажа", automatic: "автоматическая", approval: "по одобрению", close: "Закрыть", context: "Контекст мероприятия загружен", noCategories: "Категории пока не созданы", question: "Что сделать для этого мероприятия?", analyzing: "Atlas изучает задачу", analyzingHelp: "Готовлю понятный план без изменения данных.", plan: "Atlas предлагает", demo: "Демо-режим", attention: "Обратите внимание", revise: "Изменить запрос", apply: "Применить после проверки", applyTitle: "Применение будет включено после финальной проверки исполнительного слоя", placeholder: "Напишите Atlas, что нужно сделать…", hint: "Enter — отправить · Shift+Enter — новая строка. Без подтверждения ничего не изменится.", error: "Не удалось подготовить план", places: "мест",
    mic: "Записать голосом", stop: "Остановить запись", cancel: "Отменить запись", listening: "Atlas слушает", transcribing: "Распознаю речь", transcribeError: "Не удалось распознать голос", micDenied: "Разрешите доступ к микрофону в настройках браузера", micUnavailable: "На этом устройстве запись голоса недоступна", maxRecording: "Максимум 2 минуты", transcriptReady: "Текст распознан. Проверьте его и отправьте.",
    sold: "Продано", remaining: "Осталось", readiness: "Готовность", ready: "Основные настройки заполнены", needsTickets: "Нужно создать категории билетов", lowStock: "В одной из категорий осталось менее 20% билетов", healthy: "Запас билетов выглядит нормально",
    examples: ["Проверь мероприятие перед публикацией", "Предложи оптимальные категории и цены", "Подготовь план продвижения на ближайшие 7 дней"],
  },
  he: {
    level: "השותף שלכם לעבודה", greeting: "Atlas כבר בדק את האירוע", description: "אני רואה את ההגדרות, הכרטיסים ומצב המכירה. אפשר לבדוק את האירוע, להציע שיפורים או להכין תוכנית שינויים בטוחה.",
    open: "לדבר עם Atlas", event: "אירוע", categories: "קטגוריות", sale: "מכירה", automatic: "אוטומטית", approval: "באישור", close: "סגירה", context: "הקשר האירוע נטען", noCategories: "טרם נוצרו קטגוריות", question: "מה לעשות עבור האירוע הזה?", analyzing: "Atlas בודק את המשימה", analyzingHelp: "מכין תוכנית ברורה ללא שינוי נתונים.", plan: "ההצעה של Atlas", demo: "מצב הדגמה", attention: "חשוב לשים לב", revise: "שינוי הבקשה", apply: "החלה לאחר בדיקה", applyTitle: "החלת שינויים תופעל לאחר בדיקה סופית", placeholder: "כתבו ל-Atlas מה צריך לעשות…", hint: "Enter לשליחה · Shift+Enter לשורה חדשה. דבר לא ישתנה ללא אישור.", error: "לא ניתן להכין את התוכנית", places: "מקומות",
    mic: "הקלטה קולית", stop: "עצירת ההקלטה", cancel: "ביטול ההקלטה", listening: "Atlas מקשיב", transcribing: "מתמלל", transcribeError: "לא ניתן היה לתמלל", micDenied: "יש לאפשר גישה למיקרופון", micUnavailable: "הקלטה קולית אינה זמינה", maxRecording: "עד 2 דקות", transcriptReady: "הטקסט מוכן. בדקו ושלחו.",
    sold: "נמכרו", remaining: "נותרו", readiness: "מוכנות", ready: "ההגדרות העיקריות הושלמו", needsTickets: "יש ליצור קטגוריות כרטיסים", lowStock: "באחת הקטגוריות נותרו פחות מ-20%", healthy: "מלאי הכרטיסים נראה תקין",
    examples: ["בדוק את האירוע לפני פרסום", "הצע קטגוריות ומחירים מתאימים", "הכן תוכנית קידום ל-7 הימים הקרובים"],
  },
  en: {
    level: "your working partner", greeting: "Atlas has reviewed this event", description: "I can see the settings, tickets and sales mode. I can review the event, suggest improvements or prepare a safe change plan.",
    open: "Talk to Atlas", event: "Event", categories: "Categories", sale: "Sales", automatic: "automatic", approval: "approval required", close: "Close", context: "Event context loaded", noCategories: "No categories yet", question: "What should I do for this event?", analyzing: "Atlas is reviewing the task", analyzingHelp: "Preparing a clear plan without changing data.", plan: "Atlas suggests", demo: "Demo mode", attention: "Please note", revise: "Edit request", apply: "Apply after review", applyTitle: "Applying changes will be enabled after final review", placeholder: "Tell Atlas what you need…", hint: "Enter to send · Shift+Enter for a new line. Nothing changes without confirmation.", error: "Could not prepare the plan", places: "seats",
    mic: "Record voice", stop: "Stop recording", cancel: "Cancel recording", listening: "Atlas is listening", transcribing: "Transcribing", transcribeError: "Could not transcribe", micDenied: "Allow microphone access", micUnavailable: "Voice recording is unavailable", maxRecording: "Up to 2 minutes", transcriptReady: "Transcript ready. Review and send.",
    sold: "Sold", remaining: "Remaining", readiness: "Readiness", ready: "Core settings are complete", needsTickets: "Ticket categories still need to be created", lowStock: "One category has less than 20% inventory left", healthy: "Ticket inventory looks healthy",
    examples: ["Review this event before publishing", "Suggest the best ticket categories and prices", "Prepare a 7-day promotion plan"],
  },
} as const;

function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

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
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const totals = useMemo(() => event.categories.reduce((a, c) => ({ capacity: a.capacity + c.capacity, sold: a.sold + c.sold }), { capacity: 0, sold: 0 }), [event.categories]);
  const remaining = Math.max(0, totals.capacity - totals.sold);
  const lowStock = event.categories.some((c) => c.capacity > 0 && (c.capacity - c.sold) / c.capacity < .2);
  const categorySummary = useMemo(() => event.categories.map((item) => `${item.name}: ${item.capacity} ${text.places}`).join(" · "), [event.categories, text.places]);

  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setRecordingSeconds((value) => { if (value >= 119) { stopRecording(true); return 120; } return value + 1; }), 1000); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function ask(promptOverride?: string) {
    const prompt = (promptOverride ?? message).trim(); if (!prompt) return;
    if (promptOverride) setMessage(promptOverride);
    setBusy(true); setError(""); setPlan(null); setVoiceStatus(""); setOpen(true);
    try { const response = await fetch(`/api/admin/events/${event.id}/ai-assistant`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, locale }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || text.error); setPlan(data.plan); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  }

  async function transcribeAudio(blob: Blob) {
    setTranscribing(true); setError(""); setVoiceStatus("");
    try { const form = new FormData(); form.append("audio", new File([blob], "atlas-voice.webm", { type: blob.type || "audio/webm" })); form.append("language", locale); const response = await fetch(`/api/admin/events/${event.id}/ai-assistant/transcribe`, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error || text.transcribeError); setMessage((current) => current.trim() ? `${current.trim()} ${data.text}` : data.text); setVoiceStatus(text.transcriptReady); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.transcribeError); }
    finally { setTranscribing(false); }
  }

  async function startRecording() {
    setError(""); setVoiceStatus(""); setPlan(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(text.micUnavailable); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)); const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream); recorderRef.current = recorder; chunksRef.current = []; transcribeAfterStopRef.current = true; recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); }; recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; recorderRef.current = null; if (transcribeAfterStopRef.current && blob.size) void transcribeAudio(blob); }; recorder.start(250); setRecordingSeconds(0); setRecording(true); }
    catch (cause) { const denied = cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError"); setError(denied ? text.micDenied : text.micUnavailable); }
  }
  function stopRecording(transcribe: boolean) { transcribeAfterStopRef.current = transcribe; setRecording(false); const recorder = recorderRef.current; if (recorder?.state === "recording") recorder.stop(); else streamRef.current?.getTracks().forEach((track) => track.stop()); }

  return <>
    <section className={styles.hero} dir={dir}>
      <div className={styles.topline}><div className={styles.brandMark}><Sparkles size={18}/><strong>Atlas</strong><span>{text.level}</span></div><button className={styles.openButton} type="button" onClick={() => setOpen(true)}><span>{text.open}</span><Arrow size={18}/></button></div>
      <div className={styles.main}><div><h2 className={styles.title}>{text.greeting}</h2><p className={styles.description}>{text.description}</p></div>
        <div className={styles.insights}>
          <button type="button" onClick={() => void ask(text.examples[0])} className={styles.insight}><span className={styles.insightIcon}><ShieldCheck size={18}/></span><span><small>{text.readiness}</small><strong>{event.categories.length ? text.ready : text.needsTickets}</strong></span><Arrow size={16}/></button>
          <button type="button" onClick={() => void ask(text.examples[1])} className={styles.insight}><span className={styles.insightIcon}><Ticket size={18}/></span><span><small>{text.sold}: {totals.sold} · {text.remaining}: {remaining}</small><strong>{lowStock ? text.lowStock : text.healthy}</strong></span><Arrow size={16}/></button>
        </div>
      </div>
      <div className={styles.quickRow}>{text.examples.map((example, index) => <button type="button" key={example} onClick={() => void ask(example)}><span>{index === 0 ? <ShieldCheck size={16}/> : index === 1 ? <TrendingUp size={16}/> : <Sparkles size={16}/>}</span>{example}</button>)}</div>
      <div className={styles.meta}><div>{text.event}<b>{event.title}</b></div><div>{text.categories}<b>{event.categories.length}</b></div><div>{text.sale}<b>{event.salesMode === "INSTANT" ? text.automatic : text.approval}</b></div></div>
    </section>

    {open && <div role="dialog" aria-modal="true" className={styles.overlay} onMouseDown={(e) => { if (e.currentTarget === e.target && !recording) setOpen(false); }}><aside className={styles.drawer} dir={dir}>
      <header className={styles.drawerHeader}><div className={styles.drawerBrand}><span className={styles.iconBox}><Bot size={22}/></span><div><strong>Atlas</strong><small>{event.title}</small></div></div><button type="button" aria-label={text.close} onClick={() => { if (recording) stopRecording(false); setOpen(false); }} className={styles.closeButton}><X size={19}/></button></header>
      <div className={styles.drawerBody}><div className={styles.context}><ShieldCheck size={18}/><div><strong>{text.context}</strong><p>{event.venue} · {new Date(event.startsAt).toLocaleString(locale === "he" ? "he-IL" : locale === "en" ? "en-IL" : "ru-IL")}<br/>{categorySummary || text.noCategories}</p></div></div>
        {!plan && !busy && <div><p className={styles.question}><strong>{text.question}</strong></p><div className={styles.examples}>{text.examples.map((example) => <button key={example} type="button" onClick={() => setMessage(example)}>{example}</button>)}</div></div>}
        {busy && <div className={styles.loading}><Loader2 className="spin" size={20}/><div><strong>{text.analyzing}</strong><span>{text.analyzingHelp}</span></div></div>}
        {error && <div className={styles.error}><AlertTriangle size={18}/>{error}</div>}
        {plan && <div className={styles.plan}><div className={styles.planIntro}><div><strong>{text.plan}</strong><p>{plan.summary}</p></div><span>{plan.mode === "live" ? "LIVE" : text.demo}</span></div>{plan.changes.map((item, index) => <div className={styles.change} key={`${item.title}-${index}`}><span data-risk={item.risk}><Check size={17}/></span><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>)}{plan.notes.length > 0 && <div className={styles.notes}><strong>{text.attention}</strong>{plan.notes.map((note) => <p key={note}>• {note}</p>)}</div>}<div className={styles.planActions}><button className="btn" type="button" onClick={() => setPlan(null)}>{text.revise}</button><button className="btn dark" type="button" disabled title={text.applyTitle}>{text.apply}</button></div></div>}
      </div>
      <footer className={styles.drawerFooter}>{recording && <div className={styles.recordingBar}><span className={styles.recordingDot}/><strong>{text.listening}</strong><span className={styles.recordingTime}>{formatTime(recordingSeconds)} / 2:00</span><button type="button" className={styles.voiceSecondary} onClick={() => stopRecording(false)} title={text.cancel}><Trash2 size={17}/></button><button type="button" className={styles.stopButton} onClick={() => stopRecording(true)} title={text.stop}><Square size={16}/><span>{text.stop}</span></button></div>}<div className={styles.composer}><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} rows={3} placeholder={text.placeholder} disabled={recording || transcribing}/><button className={styles.micButton} type="button" onClick={() => void startRecording()} disabled={busy || recording || transcribing} title={`${text.mic} · ${text.maxRecording}`}>{transcribing ? <Loader2 className="spin" size={19}/> : <Mic size={20}/>}</button><button className={styles.sendButton} type="button" onClick={() => void ask()} disabled={busy || recording || transcribing || !message.trim()}>{busy ? <Loader2 className="spin" size={18}/> : <Send size={18}/>}</button></div><small className={styles.hint}>{transcribing ? text.transcribing : voiceStatus || text.hint}</small></footer>
    </aside></div>}
  </>;
}
