"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";

type EventOption = { id: string; title: string; startsAt: string };
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

const REPEAT_BLOCK_MS = 2200;

function resultLabel(status?: Status) {
  if (status === "VALID") return "Действителен";
  if (status === "USED") return "Уже использован";
  if (status === "CANCELLED") return "Отменён";
  if (status === "WRONG_EVENT") return "Другое мероприятие";
  if (status === "TOO_EARLY") return "Вход ещё закрыт";
  if (status === "NOT_FOUND") return "Не найден";
  return "Ожидание";
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

export function ScannerClient({
  initialEntered,
  events,
}: {
  initialEntered: number;
  events: EventOption[];
}) {
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
  const [selectedEventId, setSelectedEventId] = useState(events.length === 1 ? events[0].id : "");
  const [recent, setRecent] = useState<RecentScan[]>([]);

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Камера ${index + 1}` }));
    setCameraDevices(cameras);
    if (!cameraId && cameras.length) {
      const rear = cameras.find((item) => /back|rear|environment|зад/i.test(item.label));
      setCameraId((rear || cameras[cameras.length - 1]).deviceId);
    }
  }, [cameraId]);

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
        body: JSON.stringify({ code: value, eventId: selectedEventId || undefined, source }),
      });
      const data = await response.json() as Result;
      if (!response.ok && !data.message) throw new Error("Сервер не смог проверить билет");
      if (!mountedRef.current) return;
      setResult(data);
      setEntered(data.entered);
      setCode("");
      setRecent((items) => [{ ...data, code: value }, ...items].slice(0, 12));
      tone(data.status, soundEnabled);
      if (navigator.vibrate) navigator.vibrate(data.status === "VALID" ? 80 : [120, 60, 120]);
    } catch (error) {
      if (!mountedRef.current) return;
      setCameraError(error instanceof Error ? error.message : "Ошибка сети. Повторите проверку.");
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, [selectedEventId, soundEnabled]);

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

    (async () => {
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
          ? "Доступ к камере запрещён. Разрешите камеру в настройках браузера и нажмите «Повторить»."
          : "Камера недоступна. Проверьте разрешение или используйте ручной ввод.");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraId, refreshCameras, submitCode]);

  const restartCamera = () => {
    controlsRef.current?.stop();
    setCameraId((value) => `${value}`);
    void refreshCameras();
    window.location.reload();
  };

  return <div className="scanner-grid">
    <section>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span className={`pill ${online ? "" : "danger"}`}>{online ? "Онлайн" : "Нет сети"}</span>
        <button className="btn secondary" type="button" onClick={() => setSoundEnabled((value) => !value)}>
          {soundEnabled ? "Звук включён" : "Звук выключен"}
        </button>
      </div>

      {events.length > 1 && <label className="form" style={{ display: "block", marginBottom: 12 }}>
        <strong>Мероприятие</strong>
        <select className="input" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
          <option value="">Все доступные мероприятия</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
      </label>}

      {cameraDevices.length > 1 && <label className="form" style={{ display: "block", marginBottom: 12 }}>
        <strong>Камера</strong>
        <select className="input" value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
          {cameraDevices.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}
        </select>
      </label>}

      <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#020617", minHeight: 280 }}>
        <video ref={video} muted playsInline style={{ width: "100%", minHeight: 280, objectFit: "cover", display: "block" }}/>
        <div aria-hidden="true" style={{ position: "absolute", inset: "18% 12%", border: "3px solid rgba(255,255,255,.9)", borderRadius: 18, boxShadow: "0 0 0 999px rgba(2,6,23,.3)" }}/>
        {processing && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,6,23,.45)", color: "white", fontWeight: 700 }}>Проверяем билет...</div>}
      </div>

      {cameraError && <div className="toast" style={{ marginTop: 10 }}>
        <p>{cameraError}</p>
        <button className="btn secondary" type="button" onClick={restartCamera}>Повторить</button>
      </div>}

      <div className="panel form" style={{ marginTop: 14, color: "#0b1220" }}>
        <label><strong>Ручной ввод кода</strong></label>
        <div className="row">
          <input className="input" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") void submitCode(code, "MANUAL");
          }} placeholder="ATLAS_... или ссылка на билет" disabled={processing}/>
          <button className="btn" disabled={processing || !code.trim()} onClick={() => void submitCode(code, "MANUAL")}>
            {processing ? "Проверяем" : "Проверить"}
          </button>
        </div>
      </div>
    </section>

    <aside>
      <div className="stat" style={{ color: "#0b1220", marginBottom: 16 }}>
        <span className="muted">Гостей вошло</span><strong>{entered}</strong>
      </div>
      <div className={`result ${result?.status.toLowerCase() ?? ""}`}>
        <small>Последняя проверка</small>
        <h2>{resultLabel(result?.status)}</h2>
        <p>{result?.message ?? "Наведите камеру на QR-код билета"}</p>
        {result?.holderName && <p><strong>{result.holderName}</strong></p>}
        {result?.categoryName && <p>Категория: {result.categoryName}</p>}
        {result?.eventTitle && <p>Мероприятие: {result.eventTitle}</p>}
        {result?.orderPublicId && <p>Заказ: {result.orderPublicId}</p>}
        {result?.warning && <p className="toast">{result.warning}</p>}
        {result && <small>{new Date(result.scannedAt).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem" })}</small>}
      </div>

      {recent.length > 0 && <div className="panel" style={{ marginTop: 16, color: "#0b1220" }}>
        <strong>Текущая сессия</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {recent.map((item, index) => <div key={`${item.scannedAt}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{item.holderName || item.code.slice(0, 12)}</span>
            <span className="pill">{resultLabel(item.status)}</span>
          </div>)}
        </div>
      </div>}
    </aside>
  </div>;
}
