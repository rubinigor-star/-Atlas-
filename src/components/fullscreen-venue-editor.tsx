"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./fullscreen-venue-editor.module.css";

export function FullscreenVenueEditor({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    if (!document.fullscreenElement) await root.requestFullscreen();
    else await document.exitFullscreen();
  }

  return <div ref={rootRef} className={styles.shell}>
    <div className={styles.heading}>
      <div><span className="eyebrow">Atlas venue builder</span><h2 className="section-title">Карта мероприятия</h2><p className="muted">Откройте полноэкранный режим, чтобы рабочая область и инструменты не перекрывали друг друга.</p></div>
      <button type="button" className="btn dark" onClick={() => void toggleFullscreen()}>{fullscreen ? "Выйти из полного экрана" : "Открыть на весь экран"}</button>
    </div>
    {children}
  </div>;
}
