"use client";

import { useEffect, useState } from "react";

type Locale = "ru" | "en" | "he";

type IsraelClock = {
  dateKey: string;
  secondsOfDay: number;
  milliseconds: number;
};

type ViewerBand = {
  min: number;
  max: number;
  maxDown: number;
};

const TIME_ZONE = "Asia/Jerusalem";
const INTERVALS_SECONDS = [5, 9, 4, 8, 10] as const;
const CYCLE_SECONDS = INTERVALS_SECONDS.reduce((sum, value) => sum + value, 0);
const CYCLE_BOUNDARIES = INTERVALS_SECONDS.reduce<number[]>((result, value) => {
  result.push((result.at(-1) ?? 0) + value);
  return result;
}, []);
const FALLBACK_VIEWERS = 3;

const israelFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function israelClock(now = new Date()): IsraelClock {
  const parts = Object.fromEntries(
    israelFormatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour ?? 0);
  const minute = Number(parts.minute ?? 0);
  const second = Number(parts.second ?? 0);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    secondsOfDay: hour * 3600 + minute * 60 + second,
    milliseconds: now.getMilliseconds(),
  };
}

function viewerBand(secondsOfDay: number): ViewerBand {
  const hour = Math.floor(secondsOfDay / 3600);
  if (hour < 6) return { min: 2, max: 4, maxDown: 2 };
  if (hour < 12) return { min: 2, max: 5, maxDown: 2 };
  if (hour < 17) return { min: 3, max: 6, maxDown: 2 };
  if (hour < 20) return { min: 4, max: 9, maxDown: 2 };
  if (hour < 22) return { min: 9, max: 17, maxDown: 2 };
  return { min: 3, max: 9, maxDown: 3 };
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function eventKey() {
  if (typeof window === "undefined") return "event";
  const match = window.location.pathname.match(/\/events\/([^/]+)/);
  return decodeURIComponent(match?.[1] ?? window.location.pathname);
}

function elapsedTicks(secondsOfDay: number) {
  const completeCycles = Math.floor(secondsOfDay / CYCLE_SECONDS);
  const remainder = secondsOfDay % CYCLE_SECONDS;
  const completedInCycle = CYCLE_BOUNDARIES.filter((boundary) => boundary <= remainder).length;
  return completeCycles * INTERVALS_SECONDS.length + completedInCycle;
}

function tickSecond(tickIndex: number) {
  const completeCycles = Math.floor(tickIndex / INTERVALS_SECONDS.length);
  const position = tickIndex % INTERVALS_SECONDS.length;
  const before = position === 0 ? 0 : CYCLE_BOUNDARIES[position - 1];
  return completeCycles * CYCLE_SECONDS + before;
}

function initialViewerCount(key: string, dateKey: string) {
  return 2 + (hash(`${key}|${dateKey}|start`) % 3);
}

function moveViewerCount(current: number, band: ViewerBand, seed: number, previousBand: ViewerBand) {
  // At 22:00 the evening ceiling changes immediately: the counter may no longer exceed 9.
  if (band.max === 9 && previousBand.max === 17 && current > band.max) return band.max;

  // Other band changes approach their new range without implausible jumps.
  if (current > band.max) return Math.max(band.max, current - Math.min(band.maxDown, 1 + (seed % band.maxDown)));
  if (current < band.min) return Math.min(band.min, current + 1 + (seed % 2));

  const direction = (seed & 1) === 0 ? 1 : -1;
  const maxStep = direction > 0 ? 2 : band.maxDown;
  const delta = 1 + ((seed >>> 1) % maxStep);
  let next = current + direction * delta;

  // Bounce at a boundary instead of freezing on it, so the counter keeps looking alive.
  if (next > band.max) next = current - Math.min(band.maxDown, delta);
  if (next < band.min) next = current + Math.min(2, delta);
  return Math.max(band.min, Math.min(band.max, next));
}

function synchronizedViewerCount(key: string, clock: IsraelClock) {
  const ticks = elapsedTicks(clock.secondsOfDay);
  let viewers = initialViewerCount(key, clock.dateKey);
  let previousBand = viewerBand(0);

  for (let tick = 1; tick <= ticks; tick += 1) {
    const seconds = Math.min(86399, tickSecond(tick));
    const band = viewerBand(seconds);
    const seed = hash(`${key}|${clock.dateKey}|${tick}`);
    viewers = moveViewerCount(viewers, band, seed, previousBand);
    previousBand = band;
  }
  return viewers;
}

function millisecondsUntilNextTick(clock: IsraelClock) {
  const remainder = clock.secondsOfDay % CYCLE_SECONDS;
  const nextBoundary = CYCLE_BOUNDARIES.find((boundary) => boundary > remainder) ?? CYCLE_SECONDS;
  const secondsUntil = nextBoundary - remainder;
  return Math.max(50, secondsUntil * 1000 - clock.milliseconds + 20);
}

export function LiveViewerPressure({ locale }: { locale: Locale }) {
  const [viewers, setViewers] = useState(FALLBACK_VIEWERS);

  useEffect(() => {
    let timer: number | null = null;
    const key = eventKey();

    const sync = () => {
      const clock = israelClock();
      setViewers(synchronizedViewerCount(key, clock));
      timer = window.setTimeout(sync, millisecondsUntilNextTick(clock));
    };

    sync();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  const copy = {
    ru: { before: "Сейчас это событие смотрят ", after: "" },
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
