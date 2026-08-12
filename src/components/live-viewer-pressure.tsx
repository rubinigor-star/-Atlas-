"use client";

import { useEffect, useState } from "react";

type Locale = "ru" | "en" | "he";

const INTERVALS = [5000, 3000, 9000, 4000];
const MIN_VIEWERS = 12;
const MAX_VIEWERS = 48;

function randomInitial() {
  return Math.floor(Math.random() * (MAX_VIEWERS - MIN_VIEWERS + 1)) + MIN_VIEWERS;
}

function nextViewerCount(current: number) {
  const deltaPool = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
  const delta = deltaPool[Math.floor(Math.random() * deltaPool.length)];
  const next = current + delta;
  if (next < MIN_VIEWERS) return MIN_VIEWERS + Math.floor(Math.random() * 4);
  if (next > MAX_VIEWERS) return MAX_VIEWERS - Math.floor(Math.random() * 4);
  return next;
}

export function LiveViewerPressure({ locale }: { locale: Locale }) {
  const [viewers, setViewers] = useState(randomInitial);
  const [intervalIndex, setIntervalIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setViewers((current) => nextViewerCount(current));
      setIntervalIndex((current) => (current + 1) % INTERVALS.length);
    }, INTERVALS[intervalIndex]);
    return () => window.clearTimeout(timer);
  }, [intervalIndex]);

  const copy = {
    ru: { before: "Сейчас это мероприятие просматривают ", after: " человек" },
    en: { before: "", after: " others are checking this out!" },
    he: { before: "", after: " אנשים צופים באירוע עכשיו" },
  }[locale];

  return <div className="atlas-live-viewers" aria-live="polite">
    <span className="atlas-live-viewers-pulse" aria-hidden="true">
      <span className="atlas-live-viewers-dot" />
    </span>
    <span className="atlas-live-viewers-copy">
      {copy.before}<strong className="atlas-live-viewers-count">{viewers}</strong>{copy.after}
    </span>
    <style jsx>{`
      .atlas-live-viewers {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        min-height: 36px;
        padding: 7px 12px;
        border-radius: 10px;
        background: #f4f5f7;
        color: #111827;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.25;
        text-align: left;
      }
      .atlas-live-viewers-pulse {
        position: relative;
        display: grid;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        place-items: center;
        border-radius: 50%;
        background: rgba(76, 141, 255, .10);
      }
      .atlas-live-viewers-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4c8dff;
        box-shadow: 0 0 0 0 rgba(76, 141, 255, .48);
        animation: atlasViewerPulse 1.6s ease-out infinite;
      }
      .atlas-live-viewers-copy { min-width: 0; }
      .atlas-live-viewers-count { font-weight: 800; }
      @keyframes atlasViewerPulse {
        0% { box-shadow: 0 0 0 0 rgba(76, 141, 255, .48); }
        70% { box-shadow: 0 0 0 7px rgba(76, 141, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(76, 141, 255, 0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .atlas-live-viewers-dot { animation: none; }
      }
    `}</style>
  </div>;
}
