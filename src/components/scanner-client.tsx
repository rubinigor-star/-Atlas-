"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type EventOption = { id: string; title: string; startsAt: string; capacity: number; sold: number; entered: number };
type Status = "VALID" | "USED" | "CANCELLED" | "NOT_FOUND" | "WRONG_EVENT" | "TOO_EARLY";
type Result = {
  status: Status;
  message: string;
  scannedAt: string;
  entered: number;
  eventId?: string;
  eventTitle?: string;
  holderName?: string;
  categoryName?: string;
  orderPublicId?: string;
  warning?: string;
};
type RecentScan = Result & { code: string };
type CameraDevice = { deviceId: string; label: string };
type SearchResult = {
  ticketId: string;
  publicCode: string;
  ticketStatus: string;
  holderName: string;
  categoryName: string;
  orderPublicId: string;
  phone: string;
  email: string;
  eventId: string;
  eventTitle: string;
};

const REPEAT_BLOCK_MS = 2200;

const scannerCopy={
  ru:{valid:"Вход разрешён",used:"Уже использован",cancelled:"Билет отменён",wrong:"Другое мероприятие",early:"Вход ещё закрыт",notFound:"Билет не найден",ready:"Готов к сканированию",camera:"Камера",offlineError:"Нет соединения с интернетом. Билет не отмечен как использованный.",serverError:"Сервер не смог проверить билет",networkError:"Ошибка сети. Повторите проверку.",minSearch:"Введите минимум 2 символа",searchError:"Ошибка поиска",current:"Текущее мероприятие",noEvents:"Нет доступных мероприятий",online:"Онлайн",offline:"Нет сети",soundOn:"Звук включён",soundOff:"Звук выключен",sold:"Продано",capacity:"Вместимость",entered:"Вошли",remaining:"Осталось",progress:"Прошли вход",checking:"Проверяем билет...",cameraDenied:"Доступ к камере запрещён. Разрешите камеру в настройках браузера и повторите.",cameraUnavailable:"Камера недоступна. Проверьте разрешение или используйте ручной ввод.",retry:"Повторить",manual:"Ручной ввод кода",codePlaceholder:"ATLAS_... или ссылка",check:"Проверить",checkingShort:"Проверяем",last:"Последняя проверка",scanHint:"Наведите камеру на QR-код билета",category:"Категория",order:"Заказ",recent:"Последние проверки",guestSearch:"Поиск гостя",guestHint:"Имя, телефон, email или номер заказа",guestPlaceholder:"Начните вводить данные гостя",searching:"Ищем",find:"Найти",admit:"Отметить вход",unavailable:"Недоступен",noMatches:"Совпадений не найдено"},
  he:{valid:"אפשר להיכנס",used:"הכרטיס כבר מומש",cancelled:"הכרטיס בוטל",wrong:"הכרטיס שייך לאירוע אחר",early:"הכניסה עדיין סגורה",notFound:"הכרטיס לא נמצא",ready:"מוכן לסריקה",camera:"מצלמה",offlineError:"אין חיבור לאינטרנט. הכרטיס לא סומן כמומש.",serverError:"לא ניתן לבדוק את הכרטיס בשרת",networkError:"שגיאת רשת. נסו שוב.",minSearch:"יש להזין לפחות 2 תווים",searchError:"שגיאה בחיפוש",current:"האירוע הנוכחי",noEvents:"אין אירועים זמינים",online:"מחובר",offline:"אין חיבור",soundOn:"הצליל פעיל",soundOff:"הצליל כבוי",sold:"נמכרו",capacity:"תפוסה מרבית",entered:"נכנסו",remaining:"נותרו",progress:"אחוז שנכנסו",checking:"בודקים את הכרטיס...",cameraDenied:"הגישה למצלמה נחסמה. אשרו גישה בהגדרות הדפדפן ונסו שוב.",cameraUnavailable:"המצלמה אינה זמינה. בדקו את ההרשאה או הזינו את הקוד ידנית.",retry:"ניסיון נוסף",manual:"הזנת קוד ידנית",codePlaceholder:"ATLAS_... או קישור",check:"בדיקה",checkingShort:"בודקים",last:"הבדיקה האחרונה",scanHint:"כוונו את המצלמה אל קוד ה-QR של הכרטיס",category:"קטגוריה",order:"הזמנה",recent:"בדיקות אחרונות",guestSearch:"חיפוש אורח",guestHint:"שם, טלפון, אימייל או מספר הזמנה",guestPlaceholder:"התחילו להקליד את פרטי האורח",searching:"מחפשים",find:"חיפוש",admit:"אישור כניסה",unavailable:"לא זמין",noMatches:"לא נמצאו תוצאות"},
  en:{valid:"Entry allowed",used:"Already used",cancelled:"Ticket cancelled",wrong:"Different event",early:"Entry is not open yet",notFound:"Ticket not found",ready:"Ready to scan",camera:"Camera",offlineError:"No internet connection. The ticket was not marked as used.",serverError:"The server could not verify the ticket",networkError:"Network error. Try again.",minSearch:"Enter at least 2 characters",searchError:"Search error",current:"Current event",noEvents:"No available events",online:"Online",offline:"Offline",soundOn:"Sound on",soundOff:"Sound off",sold:"Sold",capacity:"Capacity",entered:"Entered",remaining:"Remaining",progress:"Admitted",checking:"Checking ticket...",cameraDenied:"Camera access was denied. Allow camera access in browser settings and try again.",cameraUnavailable:"Camera unavailable. Check permission or use manual entry.",retry:"Try again",manual:"Enter code manually",codePlaceholder:"ATLAS_... or link",check:"Check",checkingShort:"Checking",last:"Last check",scanHint:"Point the camera at the ticket QR code",category:"Category",order:"Order",recent:"Recent checks",guestSearch:"Find guest",guestHint:"Name, phone, email or order number",guestPlaceholder:"Start typing guest details",searching:"Searching",find:"Find",admit:"Admit guest",unavailable:"Unavailable",noMatches:"No matches found"},
} as const;
type ScannerText=(typeof scannerCopy)[keyof typeof scannerCopy];

function resultLabel(status: Status|undefined,t:ScannerText) {
  if (status === "VALID") return t.valid;
  if (status === "USED") return t.used;
  if (status === "CANCELLED") return t.cancelled;
  if (status === "WRONG_EVENT") return t.wrong;
  if (status === "TOO_EARLY") return t.early;
  if (status === "NOT_FOUND") return t.notFound;
  return t.ready;
}

function tone(status: Status, soundEnabled: boolean) {
  if (!soundEnabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.value = status === "VALID" ? 880 : status === "USED" ? 320 : 180;
  gain.gain.setValueAtTime(0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.22);
  oscillator.addEventListener("ended", () => void context.close());
}

export function ScannerClient({ initialEntered, events }: { initialEntered: number; events: EventOption[] }) {
  const {locale}=useLocale();const t=scannerCopy[locale];
  const video = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [entered, setEntered] = useState(initialEntered);
  const [cameraError, setCameraError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [online, setOnline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || "");
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || events[0], [events, selectedEventId]);
  const eventEntered = selectedEvent ? (selectedEvent.id === result?.eventId ? entered : selectedEvent.entered) : entered;
  const remaining = selectedEvent ? Math.max(0, selectedEvent.sold - eventEntered) : 0;
  const fillPercent = selectedEvent?.sold ? Math.min(100, Math.round((eventEntered / selectedEvent.sold) * 100)) : 0;

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput").map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${t.camera} ${index + 1}`,
    }));
    setCameraDevices(cameras);
    if (!cameraId && cameras.length) {
      const rear = cameras.find((item) => /back|rear|environment|зад/i.test(item.label));
      setCameraId((rear || cameras[cameras.length - 1]).deviceId);
    }
  }, [cameraId,t]);

  const submitCode = useCallback(async (rawValue: string, source: "CAMERA" | "MANUAL") => {
    const value = rawValue.trim();
    if (!value || processingRef.current) return;
    const now = Date.now();
    if (source === "CAMERA" && lastScanRef.current.code === value && now - lastScanRef.current.at < REPEAT_BLOCK_MS) return;
    if (!navigator.onLine) {
      setCameraError(t.offlineError);
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setCameraError("");
    lastScanRef.current = { code: value, at: now };

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value, eventId: selectedEventId || undefined, source }),
      });
      const data = await response.json() as Result;
      if (!response.ok && !data.message) throw new Error(t.serverError);
      if (!mountedRef.current) return;
      setResult(data);
      setEntered(data.entered);
      setCode("");
      setRecent((items) => [{ ...data, code: value }, ...items].slice(0, 12));
      tone(data.status, soundEnabled);
      if (navigator.vibrate) navigator.vibrate(data.status === "VALID" ? 80 : [120, 60, 120]);
    } catch (error) {
      if (mountedRef.current) setCameraError(error instanceof Error ? error.message : t.networkError);
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, [selectedEventId, soundEnabled,t]);

  const searchGuests = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(t.minSearch);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ q: query });
      if (selectedEventId) params.set("eventId", selectedEventId);
      const response = await fetch(`/api/checkin/search?${params.toString()}`);
      const data = await response.json() as { results?: SearchResult[]; message?: string };
      if (!response.ok) throw new Error(data.message || t.searchError);
      setSearchResults(data.results || []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t.searchError);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedEventId,t]);

  useEffect(() => {
    mountedRef.current = true;
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 700 });
    let cancelled = false;
    controlsRef.current?.stop();
    controlsRef.current = null;

    void (async () => {
      try {
        if (!video.current) return;
        setCameraError("");
        const controls = await reader.decodeFromVideoDevice(cameraId || undefined, video.current, (decoded) => {
          if (decoded) void submitCode(decoded.getText(), "CAMERA");
        });
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
        await refreshCameras();
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(name === "NotAllowedError"
          ? t.cameraDenied
          : t.cameraUnavailable);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraId, refreshCameras, submitCode,t]);

  const dashboardCard = (label: string, value: number | string, hint?: string) => <div className="stat" style={{ color: "#0b1220", minWidth: 0 }}>
    <span className="muted">{label}</span><strong>{value}</strong>{hint && <small className="muted">{hint}</small>}
  </div>;

  return <div style={{ display: "grid", gap: 18 }}>
    <section className="panel" style={{ color: "#0b1220" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div><small className="muted">{t.current}</small><h2 style={{ margin: "4px 0" }}>{selectedEvent?.title || t.noEvents}</h2></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`pill ${online ? "" : "danger"}`}>{online ? t.online : t.offline}</span>
          <button className="btn secondary" type="button" onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? t.soundOn : t.soundOff}</button>
        </div>
      </div>
      {events.length > 1 && <select className="input" style={{ marginTop: 12 }} value={selectedEventId} onChange={(event) => {
        setSelectedEventId(event.target.value);
        const next = events.find((item) => item.id === event.target.value);
        setEntered(next?.entered || 0);
        setResult(null);
        setRecent([]);
        setSearchResults([]);
      }}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 14 }}>
        {dashboardCard(t.sold, selectedEvent?.sold || 0, selectedEvent?.capacity ? `${t.capacity} ${selectedEvent.capacity}` : undefined)}
        {dashboardCard(t.entered, eventEntered)}
        {dashboardCard(t.remaining, remaining)}
        {dashboardCard(t.progress, `${fillPercent}%`)}
      </div>
    </section>

    <div className="scanner-grid">
      <section>
        {cameraDevices.length > 1 && <select className="input" style={{ marginBottom: 10 }} value={cameraId} onChange={(event) => setCameraId(event.target.value)}>{cameraDevices.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}</select>}
        <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#020617", minHeight: 300 }}>
          <video ref={video} muted playsInline style={{ width: "100%", minHeight: 300, objectFit: "cover", display: "block" }}/>
          <div aria-hidden="true" style={{ position: "absolute", inset: "18% 12%", border: "3px solid rgba(255,255,255,.9)", borderRadius: 18, boxShadow: "0 0 0 999px rgba(2,6,23,.3)" }}/>
          {processing && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,6,23,.55)", color: "white", fontWeight: 800, fontSize: 20 }}>{t.checking}</div>}
        </div>
        {cameraError && <div className="toast" style={{ marginTop: 10 }}><p>{cameraError}</p><button className="btn secondary" type="button" onClick={() => window.location.reload()}>{t.retry}</button></div>}
        <div className="panel form" style={{ marginTop: 14, color: "#0b1220" }}>
          <label><strong>{t.manual}</strong></label>
          <div className="row"><input className="input" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitCode(code, "MANUAL"); }} placeholder={t.codePlaceholder} disabled={processing}/><button className="btn" disabled={processing || !code.trim()} onClick={() => void submitCode(code, "MANUAL")}>{processing ? t.checkingShort : t.check}</button></div>
        </div>
      </section>

      <aside>
        <div className={`result ${result?.status.toLowerCase() ?? ""}`} style={{ minHeight: 260, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <small>{t.last}</small><h2 style={{ fontSize: "clamp(28px,6vw,48px)" }}>{resultLabel(result?.status,t)}</h2>
          <p>{result ? resultLabel(result.status,t) : t.scanHint}</p>
          {result?.holderName && <p><strong style={{ fontSize: 22 }}>{result.holderName}</strong></p>}
          {result?.categoryName && <p>{t.category}: {result.categoryName}</p>}
          {result?.orderPublicId && <p>{t.order}: {result.orderPublicId}</p>}
          {result?.warning && <p className="toast">{result.warning}</p>}
        </div>
        {recent.length > 0 && <div className="panel" style={{ marginTop: 16, color: "#0b1220" }}><strong>{t.recent}</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{recent.map((item, index) => <div key={`${item.scannedAt}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{item.holderName || item.code.slice(0, 12)}</span><span className="pill">{resultLabel(item.status,t)}</span></div>)}</div></div>}
      </aside>
    </div>

    <section className="panel" style={{ color: "#0b1220" }}>
      <h2 style={{ marginTop: 0 }}>{t.guestSearch}</h2><p className="muted">{t.guestHint}</p>
      <div className="row"><input className="input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchGuests(); }} placeholder={t.guestPlaceholder}/><button className="btn" onClick={() => void searchGuests()} disabled={searching}>{searching ? t.searching : t.find}</button></div>
      {searchError && <p className="toast">{searchError}</p>}
      {searchResults.length > 0 && <div style={{ display: "grid", gap: 10, marginTop: 14 }}>{searchResults.map((item) => <div key={item.ticketId} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.holderName}</strong><div className="muted">{item.phone} · {item.categoryName}</div><small>{item.orderPublicId} · {item.ticketStatus}</small></div><button className="btn secondary" type="button" disabled={processing || item.ticketStatus !== "VALID"} onClick={() => void submitCode(item.publicCode, "MANUAL")}>{item.ticketStatus === "VALID" ? t.admit : t.unavailable}</button></div>)}</div>}
      {!searching && searchQuery.trim().length >= 2 && !searchError && searchResults.length === 0 && <p className="muted" style={{ marginTop: 12 }}>{t.noMatches}</p>}
    </section>
  </div>;
}
