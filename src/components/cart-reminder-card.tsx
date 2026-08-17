"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ShoppingCart, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const STORAGE_KEY = "atlas-persistent-cart-v2";

type CartGroup = {
  eventSlug: string;
  eventTitle: string;
  totalCount: number;
  expiresAt: number;
};

type CartStore = {
  version: 2;
  groups: CartGroup[];
};

type Reminder = {
  group: CartGroup;
  stage: number;
};

const copy = {
  ru: {
    eyebrow: "БИЛЕТЫ В КОРЗИНЕ",
    title: "Вас ждут билеты в корзине",
    body: (title: string, minutes: number) => `${title}: осталось ${minutes} мин. Завершите оформление, пока выбранные места ещё сохранены за вами.`,
    urgent: (title: string) => `${title}: осталось меньше 3 минут. В 00:00 места вернутся в продажу.`,
    button: "Открыть корзину",
    close: "Закрыть напоминание",
  },
  en: {
    eyebrow: "TICKETS IN YOUR CART",
    title: "Your tickets are waiting in the cart",
    body: (title: string, minutes: number) => `${title}: ${minutes} min left. Complete checkout while your selected seats are still held.`,
    urgent: (title: string) => `${title}: less than 3 minutes left. At 00:00 the seats return to sale.`,
    button: "Open cart",
    close: "Close reminder",
  },
  he: {
    eyebrow: "כרטיסים בסל",
    title: "הכרטיסים שלכם מחכים בסל",
    body: (title: string, minutes: number) => `${title}: נותרו ${minutes} דקות. השלימו את ההזמנה כל עוד המקומות שמורים עבורכם.`,
    urgent: (title: string) => `${title}: נותרו פחות מ-3 דקות. ב-00:00 המקומות יחזרו למכירה.`,
    button: "פתיחת הסל",
    close: "סגירת התזכורת",
  },
} as const;

function readGroups(): CartGroup[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartStore;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.groups)) return [];
    return parsed.groups.filter(group => group && group.eventSlug && group.expiresAt > Date.now());
  } catch {
    return [];
  }
}

function reminderStage(remainingMs: number) {
  if (remainingMs <= 0) return 0;
  if (remainingMs <= 3 * 60 * 1000) return 3;
  if (remainingMs <= 6 * 60 * 1000) return 6;
  if (remainingMs <= 9 * 60 * 1000) return 9;
  if (remainingMs <= 12 * 60 * 1000) return 12;
  return 15;
}

function countdown(expiresAt: number, now: number) {
  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CartReminderCard() {
  const { locale } = useLocale();
  const text = copy[locale];
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set<string>());
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const currentNow = Date.now();
      setNow(currentNow);
      const groups = readGroups();

      for (const group of groups) {
        const stage = reminderStage(group.expiresAt - currentNow);
        if (stage === 15 || stage === 0) continue;
        const key = `${group.eventSlug}:${group.expiresAt}:${stage}`;
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        setClosing(false);
        setReminder({ group, stage });
        break;
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    window.addEventListener("atlas-cart-change", tick as EventListener);
    window.addEventListener("storage", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("atlas-cart-change", tick as EventListener);
      window.removeEventListener("storage", tick);
    };
  }, []);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const remaining = useMemo(() => reminder ? countdown(reminder.group.expiresAt, now) : "00:00", [reminder, now]);

  const close = () => {
    if (!reminder || closing) return;
    setClosing(true);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setReminder(null);
      setClosing(false);
    }, 360);
  };

  const openCart = () => {
    const cartButton = document.querySelector<HTMLButtonElement>(".atlas-cart-button");
    cartButton?.click();
    close();
  };

  if (!reminder) return null;

  return <aside className={`atlas-cart-reminder${closing ? " is-closing" : ""}`} role="status" aria-live="polite">
    <button type="button" className="atlas-cart-reminder-close" aria-label={text.close} onClick={close}><X size={18}/></button>
    <div className="atlas-cart-reminder-topline">
      <span className="atlas-cart-reminder-icon"><ShoppingCart size={19}/></span>
      <span>{text.eyebrow}</span>
      <strong><Clock3 size={14}/>{remaining}</strong>
    </div>
    <h3>{text.title}</h3>
    <p>{reminder.stage === 3 ? text.urgent(reminder.group.eventTitle) : text.body(reminder.group.eventTitle, reminder.stage)}</p>
    <button type="button" className="atlas-cart-reminder-action" onClick={openCart}>{text.button}</button>
  </aside>;
}
