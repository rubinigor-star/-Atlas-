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

  const text = {
    ru: `Сейчас это мероприятие просматривают ${viewers} человек`,
    en: `${viewers} people are viewing this event now`,
    he: `${viewers} אנשים צופים באירוע עכשיו`,
  }[locale];

  return <div className="atlas-live-viewers" aria-live="polite">
    <span className="atlas-live-viewers-dot" aria-hidden="true" />
    <span>{text}</span>
    <style jsx>{`
      .atlas-live-viewers {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 34px;
        padding: 6px 10px;
        border-radius: 10px;
        background: #f5f6f8;
        color: #1d2737;
        font-size: 13px;
        font-weight: 650;
        text-align: center;
      }
      .atlas-live-viewers-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        border-radius: 50%;
        background: #4c8dff;
        box-shadow: 0 0 0 0 rgba(76, 141, 255, .45);
        animation: atlasViewerPulse 1.6s ease-out infinite;
      }
      @keyframes atlasViewerPulse {
        0% { box-shadow: 0 0 0 0 rgba(76, 141, 255, .45); }
        70% { box-shadow: 0 0 0 7px rgba(76, 141, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(76, 141, 255, 0); }
      }
    `}</style>
  </div>;
}
