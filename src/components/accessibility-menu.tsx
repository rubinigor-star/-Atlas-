"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Accessibility, Check, RotateCcw, X } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";

type Settings = {
  fontScale: 0 | 1 | 2;
  underlineLinks: boolean;
  readableSpacing: boolean;
  reduceMotion: boolean;
  focusHighlight: boolean;
};

const STORAGE_KEY = "atlas-accessibility-settings";
const DEFAULT_SETTINGS: Settings = {
  fontScale: 0,
  underlineLinks: false,
  readableSpacing: false,
  reduceMotion: false,
  focusHighlight: true,
};

const copy: Record<Locale, {
  open: string;
  title: string;
  close: string;
  textSize: string;
  normal: string;
  large: string;
  extraLarge: string;
  underlineLinks: string;
  readableSpacing: string;
  reduceMotion: string;
  focusHighlight: string;
  skip: string;
  statement: string;
  reset: string;
  saved: string;
}> = {
  ru: {
    open: "Настройки доступности",
    title: "Доступность",
    close: "Закрыть настройки доступности",
    textSize: "Размер текста",
    normal: "100%",
    large: "115%",
    extraLarge: "130%",
    underlineLinks: "Подчёркивать ссылки",
    readableSpacing: "Увеличить интервалы текста",
    reduceMotion: "Уменьшить анимацию",
    focusHighlight: "Усилить фокус клавиатуры",
    skip: "Перейти к основному содержимому",
    statement: "Заявление о доступности",
    reset: "Сбросить настройки",
    saved: "Настройки доступности применены",
  },
  he: {
    open: "הגדרות נגישות",
    title: "נגישות",
    close: "סגירת הגדרות נגישות",
    textSize: "גודל טקסט",
    normal: "100%",
    large: "115%",
    extraLarge: "130%",
    underlineLinks: "הדגשת קישורים בקו",
    readableSpacing: "ריווח טקסט מוגדל",
    reduceMotion: "הפחתת אנימציות",
    focusHighlight: "הדגשת מיקוד מקלדת",
    skip: "דילוג לתוכן הראשי",
    statement: "הצהרת נגישות",
    reset: "איפוס הגדרות",
    saved: "הגדרות הנגישות הוחלו",
  },
  en: {
    open: "Accessibility settings",
    title: "Accessibility",
    close: "Close accessibility settings",
    textSize: "Text size",
    normal: "100%",
    large: "115%",
    extraLarge: "130%",
    underlineLinks: "Underline links",
    readableSpacing: "Increase text spacing",
    reduceMotion: "Reduce motion",
    focusHighlight: "Enhance keyboard focus",
    skip: "Skip to main content",
    statement: "Accessibility statement",
    reset: "Reset settings",
    saved: "Accessibility settings applied",
  },
};

function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Settings>;
  return (candidate.fontScale === 0 || candidate.fontScale === 1 || candidate.fontScale === 2)
    && typeof candidate.underlineLinks === "boolean"
    && typeof candidate.readableSpacing === "boolean"
    && typeof candidate.reduceMotion === "boolean"
    && typeof candidate.focusHighlight === "boolean";
}

function applySettings(settings: Settings) {
  const root = document.documentElement;
  root.classList.toggle("atlas-a11y-font-large", settings.fontScale === 1);
  root.classList.toggle("atlas-a11y-font-xlarge", settings.fontScale === 2);
  root.classList.toggle("atlas-a11y-links", settings.underlineLinks);
  root.classList.toggle("atlas-a11y-spacing", settings.readableSpacing);
  root.classList.toggle("atlas-a11y-reduce-motion", settings.reduceMotion);
  root.classList.toggle("atlas-a11y-focus", settings.focusHighlight);
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <button
    type="button"
    className="atlas-a11y-toggle-row"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
  >
    <span>{label}</span>
    <span className="atlas-a11y-switch" aria-hidden="true">
      <span>{checked ? <Check size={13} strokeWidth={3}/> : null}</span>
    </span>
  </button>;
}

export function AccessibilityMenu() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        applySettings(DEFAULT_SETTINGS);
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (isSettings(parsed)) {
        setSettings(parsed);
        applySettings(parsed);
      }
    } catch {
      applySettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    applySettings(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const update = (patch: Partial<Settings>) => setSettings(current => ({ ...current, ...patch }));

  const skipToMain = () => {
    const main = document.querySelector<HTMLElement>("main, [role='main']");
    if (!main) return;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: settings.reduceMotion ? "auto" : "smooth", block: "start" });
    setOpen(false);
  };

  const reset = () => setSettings(DEFAULT_SETTINGS);

  return <div className="atlas-accessibility-root">
    <button type="button" className="atlas-a11y-skip-link" onClick={skipToMain}>{t.skip}</button>

    <button
      ref={triggerRef}
      type="button"
      className="atlas-a11y-trigger"
      aria-label={t.open}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="atlas-accessibility-panel"
      onClick={() => setOpen(value => !value)}
    >
      <Accessibility size={28} strokeWidth={2.25} aria-hidden="true"/>
    </button>

    {open ? <div
      ref={panelRef}
      id="atlas-accessibility-panel"
      className="atlas-a11y-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="atlas-accessibility-title"
    >
      <div className="atlas-a11y-panel-head">
        <div className="atlas-a11y-title-wrap">
          <span className="atlas-a11y-title-icon" aria-hidden="true"><Accessibility size={20} strokeWidth={2.2}/></span>
          <h2 id="atlas-accessibility-title">{t.title}</h2>
        </div>
        <button type="button" className="atlas-a11y-close" aria-label={t.close} onClick={() => setOpen(false)}>
          <X size={20} strokeWidth={2}/>
        </button>
      </div>

      <div className="atlas-a11y-body">
        <section className="atlas-a11y-section" aria-labelledby="atlas-a11y-text-size">
          <h3 id="atlas-a11y-text-size">{t.textSize}</h3>
          <div className="atlas-a11y-size-group" role="group" aria-label={t.textSize}>
            {[t.normal, t.large, t.extraLarge].map((label, index) => <button
              key={label}
              type="button"
              aria-pressed={settings.fontScale === index}
              className={settings.fontScale === index ? "is-active" : ""}
              onClick={() => update({ fontScale: index as 0 | 1 | 2 })}
            >{label}</button>)}
          </div>
        </section>

        <div className="atlas-a11y-controls">
          <Toggle checked={settings.underlineLinks} label={t.underlineLinks} onChange={() => update({ underlineLinks: !settings.underlineLinks })}/>
          <Toggle checked={settings.readableSpacing} label={t.readableSpacing} onChange={() => update({ readableSpacing: !settings.readableSpacing })}/>
          <Toggle checked={settings.reduceMotion} label={t.reduceMotion} onChange={() => update({ reduceMotion: !settings.reduceMotion })}/>
          <Toggle checked={settings.focusHighlight} label={t.focusHighlight} onChange={() => update({ focusHighlight: !settings.focusHighlight })}/>
        </div>

        <button type="button" className="atlas-a11y-skip" onClick={skipToMain}>{t.skip}</button>
        <Link className="atlas-a11y-statement" href="/accessibility" onClick={() => setOpen(false)}>{t.statement}</Link>

        <button type="button" className="atlas-a11y-reset" onClick={reset}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden="true"/>
          <span>{t.reset}</span>
        </button>
        <span className="atlas-a11y-live" aria-live="polite">{t.saved}</span>
      </div>
    </div> : null}
  </div>;
}
