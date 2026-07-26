"use client";

import { useRef, useState } from "react";

export function FullscreenVenueEditor({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    if (!document.fullscreenElement) {
      await root.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  }

  return <div ref={rootRef} className={`fullscreen-venue-shell ${fullscreen ? "is-fullscreen" : ""}`}>
    <div className="fullscreen-venue-heading">
      <div><span className="eyebrow">Atlas venue builder</span><h2 className="section-title">Карта мероприятия</h2><p className="muted">Откройте полноэкранный режим, чтобы рабочая область и инструменты не перекрывали друг друга.</p></div>
      <button type="button" className="btn dark" onClick={() => void toggleFullscreen()}>{fullscreen ? "Выйти из полного экрана" : "Открыть на весь экран"}</button>
    </div>
    {children}
  </div>;
}
