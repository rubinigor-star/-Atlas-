"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function resultLabel(status?: Status) {
  if (status === "VALID") return "Вход разрешён";
  if (status === "USED") return "Уже использован";
  if (status === "CANCELLED") return "Билет отменён";
  if (status === "WRONG_EVENT") return "Другое мероприятие";
  if (status === "TOO_EARLY") return "Вход ещё закрыт";
  if (status === "NOT_FOUND") return "Билет не найден";
  return "Готов к сканированию";
}

function tone(status: Status, soundEnabled: boolean) {
  if (!soundEnabled || typeof window === "undefined") return;
  try {
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
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  } catch {
    // Sound feedback must never break a successful ticket check-in.
  }
}

export function ScannerClient({ initialEntered, events }: { initialEntered: number; events: EventOption[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const selectedEventIdRef = useRef(events[0]?.id || "");
  const soundEnabledRef = useRef(true);

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
      label: device.label || `Камера ${index + 1}`,
    }));
    setCameraDevices(cameras);
    if (cameras.length) {
      const rear = cameras.find((item) => /back|rear|environment|зад/i.test(item.label));
      setCameraId((current) => current || (rear || cameras[cameras.length - 1]).deviceId);
    }
  }, []);

  const submitCode = useCallback(async (rawValue: string, source: "CAMERA" | "MANUAL") => {
    const value = rawValue.trim();
    if (!value || processingRef.current) return;
    const now = Date.now();
    if (source === "CAMERA" && lastScanRef.current.code === value && now - lastScanRef.current.at < REPEAT_BLOCK_MS) return;
    if (!navigator.onLine) {
      setCameraError("Нет соединения с интернетом. Билет не отмечен как использованный.");
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
        body: JSON.stringify({ code: value, eventId: selectedEventIdRef.current || undefined, source }),
      });
      const data = await response.json() as Result;
      if (!response.ok && !data.message) throw new Error("Сервер не смог проверить билет");
      if (!mountedRef.current) return;
      setResult(data);
      setEntered(data.entered);
      setCode("");
      setRecent((items) => [{ ...data, code: value }, ...items].slice(0, 12));
      tone(data.status, soundEnabledRef.current);
      try {
        if (navigator.vibrate) navigator.vibrate(data.status === "VALID" ? 80 : [120, 60, 120]);
      } catch {
        // Haptics are optional and must not affect scanner continuity.
      }
    } catch (error) {
      if (mountedRef.current) setCameraError(error instanceof Error ? error.message : "Ошибка сети. Повторите проверку.");
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, []);

  const searchGuests = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError("Введите минимум 2 символа");
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ q: query });
      if (selectedEventId) params.set("eventId", selectedEventId);
      const response = await fetch(`/api/checkin/search?${params.toString()}`);
      const data = await response.json() as { results?: SearchResult[]; message?: string };
      if (!response.ok) throw new Error(data.message || "Ошибка поиска");
      setSearchResults(data.results || []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Ошибка поиска");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedEventId]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 700 });
    let cancelled = false;
    controlsRef.current?.stop();
    controlsRef.current = null;

    void (async () => {
      try {
        if (!video.current) return;
        setCameraError("");
        const controls = cameraId
          ? await reader.decodeFromVideoDevice(cameraId, video.current, (decoded) => {
            if (decoded) void submitCode(decoded.getText(), "CAMERA");
          })
          : await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current, (decoded) => {
            if (decoded) void submitCode(decoded.getText(), "CAMERA");
          });
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
        await refreshCameras();
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите камеру в настройках браузера и повторите."
          : "Камера недоступна. Проверьте разрешение или используйте ручной ввод.");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraId, refreshCameras, submitCode]);

  const dashboardCard = (label: string, value: number | string, hint?: string) => <div className="stat" style={{ color: "#0b1220", minWidth: 0 }}>
    <span className="muted">{label}</span><strong>{value}</strong>{hint && <small className="muted">{hint}</small>}
  </div>;

  return <div style={{ display: "grid", gap: 18 }}>
    <style>{`@keyframes atlasScannerLaser{0%{top:10%;opacity:.45}50%{opacity:1}100%{top:88%;opacity:.45}}`}</style>
    <section className="panel" style={{ color: "#0b1220" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div><small className="muted">Текущее мероприятие</small><h2 style={{ margin: "4px 0" }}>{selectedEvent?.title || "Нет доступных мероприятий"}</h2></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`pill ${online ? "" : "danger"}`}>{online ? "Онлайн" : "Нет сети"}</span>
          <button className="btn secondary" type="button" onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? "Звук включён" : "Звук выключен"}</button>
        </div>
      </div>
      {events.length > 1 && <select className="input" style={{ marginTop: 12 }} value={selectedEventId} onChange={(event) => {
        selectedEventIdRef.current = event.target.value;
        setSelectedEventId(event.target.value);
        const next = events.find((item) => item.id === event.target.value);
        setEntered(next?.entered || 0);
        setResult(null);
        setRecent([]);
        setSearchResults([]);
      }}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 14 }}>
        {dashboardCard("Продано", selectedEvent?.sold || 0, selectedEvent?.capacity ? `Вместимость ${selectedEvent.capacity}` : undefined)}
        {dashboardCard("Вошли", eventEntered)}
        {dashboardCard("Осталось", remaining)}
        {dashboardCard("Прошли вход", `${fillPercent}%`)}
      </div>
    </section>

    <div className="scanner-grid">
      <section>
        {cameraDevices.length > 1 && <select className="input" style={{ marginBottom: 10 }} value={cameraId} onChange={(event) => setCameraId(event.target.value)}>{cameraDevices.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}</select>}
        <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#020617", minHeight: 300 }}>
          <video ref={video} muted playsInline style={{ width: "100%", minHeight: 300, objectFit: "cover", display: "block" }}/>
          <div aria-hidden="true" style={{ position: "absolute", inset: "18% 12%", border: "3px solid rgba(255,255,255,.9)", borderRadius: 18, boxShadow: "0 0 0 999px rgba(2,6,23,.3)", overflow: "hidden" }}>
            {!processing && !cameraError && <div style={{ position: "absolute", left: "5%", right: "5%", top: "10%", height: 2, borderRadius: 999, background: "rgba(34,197,94,.98)", boxShadow: "0 0 8px rgba(34,197,94,.95), 0 0 18px rgba(34,197,94,.72)", animation: "atlasScannerLaser 1.55s ease-in-out infinite alternate" }}/>} 
          </div>
          {processing && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,6,23,.55)", color: "white", fontWeight: 800, fontSize: 20 }}>Проверяем билет...</div>}
        </div>
        {cameraError && <div className="toast" style={{ marginTop: 10 }}><p>{cameraError}</p><button className="btn secondary" type="button" onClick={() => window.location.reload()}>Повторить</button></div>}
        <div className="panel form" style={{ marginTop: 14, color: "#0b1220" }}>
          <label><strong>Ручной ввод кода</strong></label>
          <div className="row"><input className="input" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitCode(code, "MANUAL"); }} placeholder="ATLAS_... или ссылка" disabled={processing}/><button className="btn" disabled={processing || !code.trim()} onClick={() => void submitCode(code, "MANUAL")}>{processing ? "Проверяем" : "Проверить"}</button></div>
        </div>
      </section>

      <aside>
        <div className={`result ${result?.status.toLowerCase() ?? ""}`} style={{ minHeight: 260, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <small>Последняя проверка</small><h2 style={{ fontSize: "clamp(28px,6vw,48px)" }}>{resultLabel(result?.status)}</h2>
          <p>{result?.message ?? "Наведите камеру на QR-код билета"}</p>
          {result?.holderName && <p><strong style={{ fontSize: 22 }}>{result.holderName}</strong></p>}
          {result?.categoryName && <p>Категория: {result.categoryName}</p>}
          {result?.orderPublicId && <p>Заказ: {result.orderPublicId}</p>}
          {result?.warning && <p className="toast">{result.warning}</p>}
        </div>
        {recent.length > 0 && <div className="panel" style={{ marginTop: 16, color: "#0b1220" }}><strong>Последние проверки</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{recent.map((item, index) => <div key={`${item.scannedAt}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{item.holderName || item.code.slice(0, 12)}</span><span className="pill">{resultLabel(item.status)}</span></div>)}</div></div>}
      </aside>
    </div>

    <section className="panel" style={{ color: "#0b1220" }}>
      <h2 style={{ marginTop: 0 }}>Поиск гостя</h2><p className="muted">Имя, телефон, email или номер заказа</p>
      <div className="row"><input className="input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchGuests(); }} placeholder="Начните вводить данные гостя"/><button className="btn" onClick={() => void searchGuests()} disabled={searching}>{searching ? "Ищем" : "Найти"}</button></div>
      {searchError && <p className="toast">{searchError}</p>}
      {searchResults.length > 0 && <div style={{ display: "grid", gap: 10, marginTop: 14 }}>{searchResults.map((item) => <div key={item.ticketId} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.holderName}</strong><div className="muted">{item.phone} · {item.categoryName}</div><small>{item.orderPublicId} · {item.ticketStatus}</small></div><button className="btn secondary" type="button" disabled={processing || item.ticketStatus !== "VALID"} onClick={() => void submitCode(item.publicCode, "MANUAL")}>{item.ticketStatus === "VALID" ? "Отметить вход" : "Недоступен"}</button></div>)}</div>}
      {!searching && searchQuery.trim().length >= 2 && !searchError && searchResults.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Совпадений не найдено</p>}
    </section>
  </div>;
}
