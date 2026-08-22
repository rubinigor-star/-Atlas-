"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Accessibility, Brain, Check, Eye, Focus, RotateCcw, Sparkles, X, ZapOff } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import styles from "./accessibility-menu.module.css";

type FontScale = 100 | 110 | 125 | 150;
type LineHeight = 100 | 125 | 150 | 175;
type ColorMode = "default" | "grayscale" | "invert" | "highContrast" | "darkContrast" | "saturation";
type Tab = "settings" | "profiles";
type Profile = "lowVision" | "cognitive" | "seizureSafe" | "adhd" | "dyslexia";

type Settings = {
  fontScale: FontScale;
  lineHeight: LineHeight;
  underlineLinks: boolean;
  underlineHeadings: boolean;
  readableFont: boolean;
  readableSpacing: boolean;
  reduceMotion: boolean;
  focusHighlight: boolean;
  bigCursor: boolean;
  readingGuide: boolean;
  readingMask: boolean;
  hideImages: boolean;
  colorMode: ColorMode;
};

const STORAGE_KEY = "atlas-accessibility-settings-v2";
const DEFAULT_SETTINGS: Settings = {
  fontScale: 100,
  lineHeight: 100,
  underlineLinks: false,
  underlineHeadings: false,
  readableFont: false,
  readableSpacing: false,
  reduceMotion: false,
  focusHighlight: true,
  bigCursor: false,
  readingGuide: false,
  readingMask: false,
  hideImages: false,
  colorMode: "default",
};

const colorModes: Array<{ key: ColorMode; swatch: string }> = [
  { key: "default", swatch: "#ffffff" },
  { key: "highContrast", swatch: "#0d47a1" },
  { key: "invert", swatch: "#111827" },
  { key: "darkContrast", swatch: "#000000" },
  { key: "grayscale", swatch: "#94a3b8" },
  { key: "saturation", swatch: "#10b981" },
];

const copy = {
  ru: {
    open: "Настройки доступности", title: "Помощник по доступности", close: "Закрыть", settings: "Настройки", profiles: "Профили",
    content: "Контент", navigation: "Навигация", colors: "Цвет и контраст", textSize: "Размер текста", lineHeight: "Межстрочный интервал",
    links: "Подчеркнуть ссылки", headings: "Подчеркнуть заголовки", readableFont: "Читаемый шрифт", spacing: "Увеличить интервалы текста",
    reduceMotion: "Остановить и уменьшить анимации", focus: "Усилить фокус клавиатуры", cursor: "Большой курсор", guide: "Линия для чтения",
    mask: "Маска для чтения", hideImages: "Скрыть изображения и видео", skip: "Перейти к основному содержимому", statement: "Заявление", reset: "Сбросить",
    profileTitle: "Готовые профили", lowVision: "Слабовидящие", lowVisionD: "Крупнее текст, контраст и фокус", cognitive: "Когнитивный", cognitiveD: "Меньше отвлечений, ясная навигация",
    seizureSafe: "Эпилепсия", seizureSafeD: "Без анимаций и яркой насыщенности", adhd: "СДВГ", adhdD: "Фокус, чтение и меньше отвлечений", dyslexia: "Дислексия", dyslexiaD: "Шрифт, интервалы и линия чтения",
    colorDefault: "Обычный", highContrast: "Высокий контраст", invert: "Обратный контраст", darkContrast: "Тёмный контраст", grayscale: "Чёрно-белый", saturation: "Высокая насыщенность", saved: "Настройки доступности применены",
  },
  he: {
    open: "הגדרות נגישות", title: "תפריט נגישות", close: "סגירה", settings: "הגדרות", profiles: "פרופילים",
    content: "תוכן", navigation: "ניווט", colors: "צבע וניגודיות", textSize: "גודל טקסט", lineHeight: "ריווח בין שורות",
    links: "הדגשת קישורים", headings: "הדגשת כותרות", readableFont: "גופן קריא", spacing: "ריווח טקסט מוגדל",
    reduceMotion: "הפחתת תנועה ואנימציות", focus: "הדגשת מיקוד במקלדת", cursor: "סמן עכבר גדול", guide: "קו עזר לקריאה",
    mask: "מסכת קריאה", hideImages: "הסתרת תמונות ווידאו", skip: "דילוג לתוכן הראשי", statement: "הצהרת נגישות", reset: "איפוס",
    profileTitle: "פרופילים מוכנים", lowVision: "לקות ראייה", lowVisionD: "טקסט גדול יותר, ניגודיות ומיקוד", cognitive: "סיוע קוגניטיבי", cognitiveD: "פחות הסחות וניווט ברור",
    seizureSafe: "התאמה לרגישות לתנועה", seizureSafeD: "ללא אנימציות וללא רוויה גבוהה", adhd: "קשב וריכוז", adhdD: "מיקוד בקריאה והפחתת הסחות", dyslexia: "דיסלקציה", dyslexiaD: "גופן, ריווח וקו עזר לקריאה",
    colorDefault: "רגיל", highContrast: "ניגודיות גבוהה", invert: "ניגודיות הפוכה", darkContrast: "ניגודיות כהה", grayscale: "שחור-לבן", saturation: "רוויה גבוהה", saved: "הגדרות הנגישות הוחלו",
  },
  en: {
    open: "Accessibility settings", title: "Accessibility assistant", close: "Close", settings: "Settings", profiles: "Profiles",
    content: "Content", navigation: "Navigation", colors: "Color and contrast", textSize: "Text size", lineHeight: "Line height",
    links: "Underline links", headings: "Underline headings", readableFont: "Readable font", spacing: "Increase text spacing",
    reduceMotion: "Reduce motion and animations", focus: "Enhance keyboard focus", cursor: "Large cursor", guide: "Reading guide",
    mask: "Reading mask", hideImages: "Hide images and video", skip: "Skip to main content", statement: "Statement", reset: "Reset",
    profileTitle: "Ready-made profiles", lowVision: "Low vision", lowVisionD: "Larger text, contrast and focus", cognitive: "Cognitive assistance", cognitiveD: "Fewer distractions and clear navigation",
    seizureSafe: "Seizure safe", seizureSafeD: "No animation or high saturation", adhd: "ADHD friendly", adhdD: "Reading focus and fewer distractions", dyslexia: "Dyslexia friendly", dyslexiaD: "Font, spacing and reading guide",
    colorDefault: "Default", highContrast: "High contrast", invert: "Invert contrast", darkContrast: "Dark contrast", grayscale: "Grayscale", saturation: "High saturation", saved: "Accessibility settings applied",
  },
} satisfies Record<Locale, Record<string, string>>;

function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Settings>;
  return [100,110,125,150].includes(c.fontScale as number)
    && [100,125,150,175].includes(c.lineHeight as number)
    && ["default","grayscale","invert","highContrast","darkContrast","saturation"].includes(c.colorMode as string)
    && ["underlineLinks","underlineHeadings","readableFont","readableSpacing","reduceMotion","focusHighlight","bigCursor","readingGuide","readingMask","hideImages"].every(k => typeof c[k as keyof Settings] === "boolean");
}

function applySettings(s: Settings) {
  const root = document.documentElement;
  const classes = ["atlas-a11y-links","atlas-a11y-headings","atlas-a11y-readable-font","atlas-a11y-spacing","atlas-a11y-reduce-motion","atlas-a11y-focus","atlas-a11y-big-cursor","atlas-a11y-reading-guide","atlas-a11y-reading-mask","atlas-a11y-hide-images","atlas-a11y-grayscale","atlas-a11y-invert","atlas-a11y-high-contrast","atlas-a11y-dark-contrast","atlas-a11y-saturation","atlas-a11y-font-110","atlas-a11y-font-125","atlas-a11y-font-150","atlas-a11y-line-125","atlas-a11y-line-150","atlas-a11y-line-175"];
  root.classList.remove(...classes);
  root.classList.toggle("atlas-a11y-links", s.underlineLinks);
  root.classList.toggle("atlas-a11y-headings", s.underlineHeadings);
  root.classList.toggle("atlas-a11y-readable-font", s.readableFont);
  root.classList.toggle("atlas-a11y-spacing", s.readableSpacing);
  root.classList.toggle("atlas-a11y-reduce-motion", s.reduceMotion);
  root.classList.toggle("atlas-a11y-focus", s.focusHighlight);
  root.classList.toggle("atlas-a11y-big-cursor", s.bigCursor);
  root.classList.toggle("atlas-a11y-reading-guide", s.readingGuide);
  root.classList.toggle("atlas-a11y-reading-mask", s.readingMask);
  root.classList.toggle("atlas-a11y-hide-images", s.hideImages);
  if (s.fontScale !== 100) root.classList.add(`atlas-a11y-font-${s.fontScale}`);
  if (s.lineHeight !== 100) root.classList.add(`atlas-a11y-line-${s.lineHeight}`);
  if (s.colorMode !== "default") root.classList.add(`atlas-a11y-${s.colorMode === "highContrast" ? "high-contrast" : s.colorMode === "darkContrast" ? "dark-contrast" : s.colorMode}`);
}

function profileSettings(profile: Profile): Settings {
  if (profile === "lowVision") return { ...DEFAULT_SETTINGS, fontScale: 150, lineHeight: 150, underlineLinks: true, focusHighlight: true, colorMode: "highContrast", bigCursor: true };
  if (profile === "cognitive") return { ...DEFAULT_SETTINGS, fontScale: 110, lineHeight: 150, readableFont: true, readableSpacing: true, underlineLinks: true, focusHighlight: true, reduceMotion: true };
  if (profile === "seizureSafe") return { ...DEFAULT_SETTINGS, reduceMotion: true, colorMode: "grayscale" };
  if (profile === "adhd") return { ...DEFAULT_SETTINGS, lineHeight: 150, readableSpacing: true, focusHighlight: true, readingMask: true, reduceMotion: true };
  return { ...DEFAULT_SETTINGS, fontScale: 110, lineHeight: 175, readableFont: true, readableSpacing: true, readingGuide: true, underlineLinks: true };
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <div className={styles.controlRow}><span className={styles.controlLabel}>{label}</span><button type="button" className={`${styles.switch} ${checked ? styles.switchOn : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span>{checked ? <Check size={13} strokeWidth={3}/> : null}</span></button></div>;
}

export function AccessibilityMenu() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (validSettings(parsed)) { setSettings(parsed); applySettings(parsed); return; }
      }
    } catch {}
    applySettings(DEFAULT_SETTINGS);
  }, []);

  useEffect(() => {
    applySettings(settings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  useEffect(() => {
    if (!settings.readingGuide) return;
    const move = (event: PointerEvent) => document.documentElement.style.setProperty("--atlas-reading-y", `${event.clientY}px`);
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [settings.readingGuide]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  const update = (patch: Partial<Settings>) => { setActiveProfile(null); setSettings(current => ({ ...current, ...patch })); };
  const applyProfile = (profile: Profile) => { setActiveProfile(profile); setSettings(profileSettings(profile)); };
  const reset = () => { setActiveProfile(null); setSettings(DEFAULT_SETTINGS); };
  const skipToMain = () => {
    const main = document.querySelector<HTMLElement>("main, [role='main']");
    if (!main) return;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: settings.reduceMotion ? "auto" : "smooth", block: "start" });
    setOpen(false);
  };
  const colorLabel = (mode: ColorMode) => mode === "default" ? t.colorDefault : mode === "highContrast" ? t.highContrast : mode === "invert" ? t.invert : mode === "darkContrast" ? t.darkContrast : mode === "grayscale" ? t.grayscale : t.saturation;

  return <div className={styles.root}>
    <button type="button" className={styles.skipLink} onClick={skipToMain}>{t.skip}</button>
    <button ref={triggerRef} type="button" className={styles.trigger} aria-label={t.open} aria-haspopup="dialog" aria-expanded={open} aria-controls="atlas-accessibility-panel" onClick={() => setOpen(v => !v)}><Accessibility size={28} aria-hidden="true"/></button>

    {open ? <div ref={panelRef} id="atlas-accessibility-panel" className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="atlas-accessibility-title">
      <div className={styles.head}><h2 id="atlas-accessibility-title">{t.title}</h2><div className={styles.headActions}><button type="button" className={styles.iconButton} aria-label={t.close} onClick={() => setOpen(false)}><X size={22}/></button></div></div>
      <div className={styles.tabs} role="tablist"><button type="button" role="tab" aria-selected={tab === "settings"} className={`${styles.tab} ${tab === "settings" ? styles.tabActive : ""}`} onClick={() => setTab("settings")}>{t.settings}</button><button type="button" role="tab" aria-selected={tab === "profiles"} className={`${styles.tab} ${tab === "profiles" ? styles.tabActive : ""}`} onClick={() => setTab("profiles")}>{t.profiles}</button></div>

      <div className={styles.body}>
        {tab === "profiles" ? <section className={styles.section}><h3 className={styles.sectionTitle}>{t.profileTitle}</h3><div className={styles.profiles}>
          {([
            ["lowVision", Eye, t.lowVision, t.lowVisionD], ["cognitive", Brain, t.cognitive, t.cognitiveD], ["seizureSafe", ZapOff, t.seizureSafe, t.seizureSafeD], ["adhd", Focus, t.adhd, t.adhdD], ["dyslexia", Sparkles, t.dyslexia, t.dyslexiaD],
          ] as const).map(([key, Icon, title, desc]) => <button key={key} type="button" aria-pressed={activeProfile === key} className={`${styles.profile} ${activeProfile === key ? styles.profileActive : ""}`} onClick={() => applyProfile(key)}><Icon size={20}/><span><strong>{title}</strong><small>{desc}</small></span></button>)}
        </div></section> : <>
          <section className={styles.section}><h3 className={styles.sectionTitle}>{t.content}</h3>
            <div className={styles.sliderRow}><div className={styles.sliderTop}><strong>{t.textSize}</strong><span>{settings.fontScale}%</span></div><input className={styles.slider} aria-label={t.textSize} type="range" min="0" max="3" step="1" value={[100,110,125,150].indexOf(settings.fontScale)} onChange={e => update({ fontScale: ([100,110,125,150] as FontScale[])[Number(e.target.value)] })}/></div>
            <div className={styles.sliderRow}><div className={styles.sliderTop}><strong>{t.lineHeight}</strong><span>{settings.lineHeight}%</span></div><input className={styles.slider} aria-label={t.lineHeight} type="range" min="0" max="3" step="1" value={[100,125,150,175].indexOf(settings.lineHeight)} onChange={e => update({ lineHeight: ([100,125,150,175] as LineHeight[])[Number(e.target.value)] })}/></div>
            <Toggle checked={settings.underlineLinks} label={t.links} onChange={() => update({ underlineLinks: !settings.underlineLinks })}/><Toggle checked={settings.underlineHeadings} label={t.headings} onChange={() => update({ underlineHeadings: !settings.underlineHeadings })}/><Toggle checked={settings.readableFont} label={t.readableFont} onChange={() => update({ readableFont: !settings.readableFont })}/><Toggle checked={settings.readableSpacing} label={t.spacing} onChange={() => update({ readableSpacing: !settings.readableSpacing })}/>
          </section>
          <section className={styles.section}><h3 className={styles.sectionTitle}>{t.navigation}</h3><Toggle checked={settings.focusHighlight} label={t.focus} onChange={() => update({ focusHighlight: !settings.focusHighlight })}/><Toggle checked={settings.bigCursor} label={t.cursor} onChange={() => update({ bigCursor: !settings.bigCursor })}/><Toggle checked={settings.readingGuide} label={t.guide} onChange={() => update({ readingGuide: !settings.readingGuide, readingMask: false })}/><Toggle checked={settings.readingMask} label={t.mask} onChange={() => update({ readingMask: !settings.readingMask, readingGuide: false })}/><Toggle checked={settings.reduceMotion} label={t.reduceMotion} onChange={() => update({ reduceMotion: !settings.reduceMotion })}/><Toggle checked={settings.hideImages} label={t.hideImages} onChange={() => update({ hideImages: !settings.hideImages })}/><button className={styles.rowButton} type="button" onClick={skipToMain}>{t.skip}<span aria-hidden="true">→</span></button></section>
          <section className={styles.section}><h3 className={styles.sectionTitle}>{t.colors}</h3><div className={styles.controlRow}><span className={styles.controlLabel}>{colorLabel(settings.colorMode)}</span><div className={styles.colorGrid}>{colorModes.map(mode => <button key={mode.key} type="button" className={`${styles.colorButton} ${settings.colorMode === mode.key ? styles.colorSelected : ""}`} style={{ background: mode.swatch }} aria-label={colorLabel(mode.key)} aria-pressed={settings.colorMode === mode.key} onClick={() => update({ colorMode: mode.key })}/>)}</div></div></section>
        </>}
      </div>
      <div className={styles.footer}><Link className={styles.statement} href="/accessibility" onClick={() => setOpen(false)}><Check size={17}/>{t.statement}</Link><button type="button" className={styles.reset} onClick={reset}><RotateCcw size={17}/>{t.reset}</button></div>
      <span className={styles.live} aria-live="polite">{t.saved}</span>
    </div> : null}
  </div>;
}
