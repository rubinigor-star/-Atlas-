"use client";

import { useMemo, useRef, useState } from "react";
import { Bot, Loader2, Mic, Send, Square, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
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

type PlanItem = { id: string; title: string; detail: string; selectable: boolean };
type Plan = { summary: string; changes: PlanItem[]; mode: "demo" | "live" };

export function EventAtlasAssistant({ event }: { event: EventContext }) {
  const { locale, dir } = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const categorySummary = useMemo(
    () => event.categories.map((item) => `${item.name}: ${item.capacity} мест`).join(" · "),
    [event.categories],
  );

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }

  async function ask() {
    const prompt = message.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setPlan(null);
    try {
      const response = await fetch(`/api/admin/events/${event.id}/ai-assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, locale }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Atlas не смог обработать запрос");
      setPlan(data.plan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Atlas не смог обработать запрос");
    } finally {
      setBusy(false);
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("audio", new File([blob], "atlas-voice.webm", { type: blob.type || "audio/webm" }));
      form.append("language", locale);
      const response = await fetch(`/api/admin/events/${event.id}/ai-assistant/transcribe`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось распознать голос");
      setMessage((current) => (current.trim() ? `${current.trim()} ${data.text}` : data.text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось распознать голос");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    if (recording || transcribing || busy) return;
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const supported = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => { releaseMicrophone(); setError("Не удалось начать запись. Попробуйте ещё раз."); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        releaseMicrophone();
        if (blob.size > 0) void transcribe(blob);
        else setError("Запись получилась пустой. Проверьте микрофон и попробуйте ещё раз.");
      };
      recorder.start(250);
      setRecording(true);
    } catch {
      releaseMicrophone();
      setError("Chrome не дал доступ к микрофону или запись не запустилась.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    else releaseMicrophone();
  }

  function close() {
    if (recording) stopRecording();
    else releaseMicrophone();
    setOpen(false);
  }

  return <>
    <section className={styles.hero} dir={dir}>
      <div className={styles.topline}>
        <div className={styles.brandMark}><strong>Atlas</strong><span>ваш рабочий партнёр</span></div>
        <button className={styles.openButton} type="button" onClick={() => setOpen(true)}>Поговорить с Atlas</button>
      </div>
      <div className={styles.main}>
        <div><h2 className={styles.title}>Atlas уже посмотрел мероприятие</h2><p className={styles.description}>Я вижу настройки, билеты и режим продаж.</p></div>
      </div>
    </section>

    {open && <div className={styles.overlay} role="dialog" aria-modal="true">
      <aside className={styles.drawer} dir={dir}>
        <header className={styles.drawerHeader}>
          <div className={styles.drawerBrand}><span className={styles.iconBox}><Bot size={22}/></span><div><strong>Atlas</strong><small>{event.title}</small></div></div>
          <button type="button" className={styles.closeButton} onClick={close}><X size={19}/></button>
        </header>

        <div className={styles.drawerBody}>
          <div className={styles.context}><div><strong>Контекст мероприятия загружен</strong><p>{event.venue} · {new Date(event.startsAt).toLocaleString("ru-IL")}<br/>{categorySummary}</p></div></div>
          {recording && <div className={styles.loading}><Loader2 className="spin" size={20}/><div><strong>Atlas слушает</strong><span>Говорите. Нажмите «Стоп», когда закончите.</span></div></div>}
          {transcribing && <div className={styles.loading}><Loader2 className="spin" size={20}/><div><strong>Распознаю голос</strong><span>Текст появится в поле ввода.</span></div></div>}
          {busy && <div className={styles.loading}><Loader2 className="spin" size={20}/><div><strong>Atlas работает над задачей</strong><span>Проверяю данные мероприятия и готовлю результат.</span></div></div>}
          {error && <div className={styles.error}>{error}</div>}
          {plan && <div className={styles.plan}><div className={styles.planIntro}><div><strong>Atlas предлагает</strong><p>{plan.summary}</p></div><span>{plan.mode === "live" ? "LIVE" : "DEMO"}</span></div>{plan.changes.map((item) => <div className={styles.change} key={item.id}><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>)}</div>}
        </div>

        <footer className={styles.drawerFooter}>
          <div className={styles.composer}>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Напишите Atlas, что нужно сделать…" disabled={busy || transcribing}/>
            <button className={styles.micButton} type="button" onClick={recording ? stopRecording : startRecording} disabled={busy || transcribing} title={recording ? "Остановить запись" : "Записать голосом"}>{recording ? <Square size={19}/> : <Mic size={20}/>}</button>
            <button className={styles.sendButton} type="button" onClick={() => void ask()} disabled={busy || transcribing || !message.trim()}>{busy ? <Loader2 className="spin" size={18}/> : <Send size={18}/>}</button>
          </div>
          <small className={styles.hint}>{recording ? "Идёт запись. При этом текстовое поле остаётся доступным." : "Enter — отправить · голос можно остановить той же кнопкой."}</small>
        </footer>
      </aside>
    </div>}
  </>;
}
