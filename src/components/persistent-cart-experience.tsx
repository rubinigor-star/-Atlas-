"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, Clock3, Ticket, AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

const STORAGE_KEY = "atlas-persistent-cart-v2";
const LEGACY_STORAGE_KEY = "atlas-persistent-cart-v1";
const HOLD_MS = 15 * 60 * 1000;

type PersistedCartItem = {
  title: string;
  description: string;
  price: string;
  quantity: number;
};

type PersistedCartGroup = {
  eventSlug: string;
  eventTitle: string;
  eventPath: string;
  posterUrl: string;
  items: PersistedCartItem[];
  totalCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  lastNoticeStage?: number;
};

type PersistedCart = {
  version: 2;
  groups: PersistedCartGroup[];
};

type LegacyCart = Omit<PersistedCartGroup, "posterUrl"> & { posterUrl?: string };

const copy = {
  ru: {
    cart: "Корзина",
    cartTitle: "Ваша корзина",
    empty: "Корзина пуста",
    back: "Вернуться к билетам",
    close: "Закрыть корзину",
    saved: (title: string) => `${title}: места сохранены на 15 минут. Завершите оформление, чтобы не потерять их.`,
    left: (title: string, minutes: number) => `${title}: осталось ${minutes} мин. Завершите оформление билетов.`,
    urgent: (title: string) => `${title}: последние 3 минуты. После окончания таймера эти места вернутся в продажу.`,
    expired: (title: string) => `${title}: время брони истекло. Эти билеты удалены из корзины и возвращены в продажу.`,
    holdTitle: "Места временно сохранены за вами",
    holdExplain: "Мы сохраняем выбранные места, пока вы оформляете заказ. Когда таймер закончится, они снова станут доступны другим покупателям.",
    remove: "Удалить билеты",
    removeTitle: "Удалить билеты из корзины?",
    removeExplain: "Вы собираетесь отказаться от выбранных билетов. После подтверждения бронь будет снята, и эти места снова станут доступны другим покупателям.",
    removeConfirm: "Да, вернуть билеты в продажу",
    removeCancel: "Оставить билеты",
  },
  en: {
    cart: "Cart",
    cartTitle: "Your cart",
    empty: "Your cart is empty",
    back: "Return to tickets",
    close: "Close cart",
    saved: (title: string) => `${title}: your seats are held for 15 minutes. Complete checkout to keep them.`,
    left: (title: string, minutes: number) => `${title}: ${minutes} minutes left. Complete checkout to keep your seats.`,
    urgent: (title: string) => `${title}: last 3 minutes. When the timer ends, these seats return to sale.`,
    expired: (title: string) => `${title}: the hold expired. These tickets were removed from your cart and returned to sale.`,
    holdTitle: "Your seats are temporarily held",
    holdExplain: "We keep your selected seats while you complete your order. When the timer ends, they become available to other customers again.",
    remove: "Remove tickets",
    removeTitle: "Remove these tickets?",
    removeExplain: "You are about to release these selected tickets. After confirmation, the hold will be removed and the seats will become available to other customers again.",
    removeConfirm: "Yes, release the tickets",
    removeCancel: "Keep my tickets",
  },
  he: {
    cart: "סל",
    cartTitle: "הסל שלכם",
    empty: "הסל ריק",
    back: "חזרה לכרטיסים",
    close: "סגירת הסל",
    saved: (title: string) => `${title}: המקומות נשמרים ל-15 דקות. השלימו את ההזמנה כדי לשמור אותם.`,
    left: (title: string, minutes: number) => `${title}: נותרו ${minutes} דקות. השלימו את ההזמנה.`,
    urgent: (title: string) => `${title}: 3 דקות אחרונות. כשהטיימר יסתיים המקומות יחזרו למכירה.`,
    expired: (title: string) => `${title}: זמן השמירה הסתיים. הכרטיסים הוסרו מהסל וחזרו למכירה.`,
    holdTitle: "המקומות נשמרים עבורכם זמנית",
    holdExplain: "אנחנו שומרים את המקומות שבחרתם בזמן השלמת ההזמנה. כשהטיימר יסתיים הם יהיו זמינים שוב לרוכשים אחרים.",
    remove: "הסרת כרטיסים",
    removeTitle: "להסיר את הכרטיסים מהסל?",
    removeExplain: "אישור הפעולה ישחרר את ההזמנה הזמנית והמקומות יהיו זמינים שוב לרוכשים אחרים.",
    removeConfirm: "כן, להחזיר למכירה",
    removeCancel: "להשאיר את הכרטיסים",
  },
} as const;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCart(value: unknown): PersistedCart | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistedCart>;
  if (candidate.version === 2 && Array.isArray(candidate.groups)) {
    return { version: 2, groups: candidate.groups.filter(group => group && Array.isArray(group.items) && Boolean(group.eventSlug)) };
  }
  const legacy = value as Partial<LegacyCart>;
  if (legacy.eventSlug && Array.isArray(legacy.items)) {
    return {
      version: 2,
      groups: [{
        eventSlug: legacy.eventSlug,
        eventTitle: legacy.eventTitle || legacy.eventSlug.replace(/-/g, " "),
        eventPath: legacy.eventPath || `/events/${legacy.eventSlug}/seats`,
        posterUrl: legacy.posterUrl || "",
        items: legacy.items,
        totalCount: legacy.totalCount || legacy.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
        createdAt: legacy.createdAt || Date.now(),
        updatedAt: legacy.updatedAt || Date.now(),
        expiresAt: legacy.expiresAt || Date.now() + HOLD_MS,
        lastNoticeStage: legacy.lastNoticeStage,
      }],
    };
  }
  return null;
}

function readCart(): PersistedCart | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeCart(JSON.parse(raw));
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return null;
    const migrated = normalizeCart(JSON.parse(legacyRaw));
    if (migrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return migrated;
  } catch {
    return null;
  }
}

function writeCart(value: PersistedCart | null) {
  if (!value || value.groups.length === 0) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("atlas-cart-change"));
}

function quantityFromTitle(title: string) {
  const match = title.match(/[×x]\s*(\d+)/i);
  const quantity = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function capturePosterUrl() {
  const image = document.querySelector<HTMLImageElement>("aside img[src]") || document.querySelector<HTMLImageElement>("main img[src]");
  return image?.currentSrc || image?.src || "";
}

function captureEventTitle(slug: string) {
  const heading = document.querySelector<HTMLElement>("aside h1")?.innerText.trim();
  return normalizeText(heading || document.title.split("|")[0]?.trim() || slug.replace(/-/g, " "));
}

function captureSeatPageCart(pathname: string, previous: PersistedCart | null): PersistedCart | null {
  const match = pathname.match(/^\/events\/([^/]+)\/seats/);
  if (!match) return previous;

  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".atlas-selected-ticket"));
  if (!nodes.length) return previous;

  const items = nodes.map(node => {
    const title = normalizeText(node.querySelector<HTMLElement>(".atlas-selected-title")?.innerText || "Билет");
    const description = normalizeText(node.querySelector<HTMLElement>(".atlas-selected-desc")?.innerText || "");
    const price = normalizeText(node.querySelector<HTMLElement>(".atlas-selected-price")?.innerText || "");
    return { title, description, price, quantity: quantityFromTitle(title) };
  });

  const now = Date.now();
  const eventSlug = match[1];
  const current = previous ?? { version: 2 as const, groups: [] };
  const existing = current.groups.find(group => group.eventSlug === eventSlug && group.expiresAt > now);
  const nextGroup: PersistedCartGroup = {
    eventSlug,
    eventTitle: existing?.eventTitle || captureEventTitle(eventSlug),
    eventPath: `/events/${eventSlug}/seats`,
    posterUrl: existing?.posterUrl || capturePosterUrl(),
    items,
    totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt: existing?.expiresAt || now + HOLD_MS,
    lastNoticeStage: existing?.lastNoticeStage,
  };

  return {
    version: 2,
    groups: [...current.groups.filter(group => group.eventSlug !== eventSlug && group.expiresAt > now), nextGroup],
  };
}

function stageFor(remainingMs: number) {
  if (remainingMs <= 0) return 0;
  if (remainingMs > 12 * 60 * 1000) return 15;
  if (remainingMs > 9 * 60 * 1000) return 12;
  if (remainingMs > 6 * 60 * 1000) return 9;
  if (remainingMs > 3 * 60 * 1000) return 6;
  return 3;
}

function countdownFor(expiresAt: number, now: number) {
  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function splitPrice(value: string) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(.+?₪)(?:\s+(.+))?$/);
  if (!match) return { main: normalized, detail: "" };
  return { main: match[1], detail: match[2] || "" };
}

export function PersistentCartExperience() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const text = copy[locale];
  const [cart, setCart] = useState<PersistedCart | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [headerMount, setHeaderMount] = useState<HTMLElement | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [removeTarget, setRemoveTarget] = useState<PersistedCartGroup | null>(null);
  const [removing, setRemoving] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener("atlas-cart-change", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("atlas-cart-change", sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const onServerHold = (event: Event) => {
      const custom = event as CustomEvent<{ expiresAt?: string | null }>;
      const match = pathname.match(/^\/events\/([^/]+)\/seats/);
      const expiresAt = custom.detail?.expiresAt ? new Date(custom.detail.expiresAt).getTime() : 0;
      if (!match || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
      const current = readCart();
      if (!current) return;
      const next = { ...current, groups: current.groups.map(group => group.eventSlug === match[1] ? { ...group, expiresAt } : group) };
      writeCart(next);
    };
    window.addEventListener("atlas-server-hold", onServerHold as EventListener);
    return () => window.removeEventListener("atlas-server-hold", onServerHold as EventListener);
  }, [pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const install = () => {
      const actions = document.querySelector<HTMLElement>(".atlas-header-actions");
      if (!actions) return false;
      let mount = actions.querySelector<HTMLElement>("[data-atlas-cart-mount]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.atlasCartMount = "true";
        mount.className = "atlas-cart-header-mount";
        const account = actions.querySelector(".atlas-account-wrap");
        actions.insertBefore(mount, account || null);
      }
      if (!cancelled) setHeaderMount(mount);
      return true;
    };
    if (install()) return () => { cancelled = true; };
    const observer = new MutationObserver(() => install());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelled = true; observer.disconnect(); };
  }, [pathname]);

  useEffect(() => {
    if (!/^\/events\/[^/]+\/seats/.test(pathname)) return;

    let frame = 0;
    const syncFromDom = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = captureSeatPageCart(pathname, readCart());
        if (next) writeCart(next);
      });
    };
    const syncImmediately = () => {
      const next = captureSeatPageCart(pathname, readCart());
      if (next) writeCart(next);
    };
    const syncAfterInteraction = () => {
      window.setTimeout(syncFromDom, 0);
      window.setTimeout(syncFromDom, 80);
      window.setTimeout(syncFromDom, 180);
    };

    const observer = new MutationObserver(syncFromDom);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("pointerup", syncAfterInteraction, true);
    document.addEventListener("click", syncAfterInteraction, true);
    window.addEventListener("pagehide", syncImmediately);
    window.addEventListener("beforeunload", syncImmediately);
    const onVisibility = () => { if (document.visibilityState === "hidden") syncImmediately(); };
    document.addEventListener("visibilitychange", onVisibility);
    const delayed = window.setTimeout(syncFromDom, 100);
    const poll = window.setInterval(syncFromDom, 250);

    return () => {
      syncImmediately();
      observer.disconnect();
      document.removeEventListener("pointerup", syncAfterInteraction, true);
      document.removeEventListener("click", syncAfterInteraction, true);
      window.removeEventListener("pagehide", syncImmediately);
      window.removeEventListener("beforeunload", syncImmediately);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(delayed);
      window.clearInterval(poll);
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    const show = (message: string) => {
      setNotice(message);
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(""), 9000);
    };

    const tick = () => {
      const current = readCart();
      if (!current?.groups.length) return;
      const now = Date.now();
      let changed = false;
      const survivors: PersistedCartGroup[] = [];

      for (const sourceGroup of current.groups) {
        let group = sourceGroup;
        const remaining = group.expiresAt - now;
        const stage = stageFor(remaining);
        if (stage === 0) {
          changed = true;
          show(text.expired(group.eventTitle));
          continue;
        }

        if (group.lastNoticeStage !== stage) {
          changed = true;
          group = { ...group, lastNoticeStage: stage };
          if (stage === 15) show(text.saved(group.eventTitle));
          else if (stage === 3) show(text.urgent(group.eventTitle));
          else show(text.left(group.eventTitle, stage));
        }
        survivors.push(group);
      }

      if (changed) writeCart(survivors.length ? { version: 2, groups: survivors } : null);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [text]);

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);

  const removeGroup = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      const response = await fetch("/api/cart/hold/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventSlug: removeTarget.eventSlug }),
      });
      if (!response.ok) throw new Error("release_failed");
      const current = readCart();
      const groups = current?.groups.filter(group => group.eventSlug !== removeTarget.eventSlug) ?? [];
      writeCart(groups.length ? { version: 2, groups } : null);
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  const totalCount = cart?.groups.reduce((sum, group) => sum + group.totalCount, 0) ?? 0;

  const headerButton = headerMount ? createPortal(
    <button
      type="button"
      className="atlas-header-icon-button atlas-cart-button"
      aria-label={text.cart}
      title={text.cart}
      onClick={() => setPanelOpen(true)}
    >
      <ShoppingCart size={23} strokeWidth={1.8} aria-hidden="true"/>
      {totalCount ? <span className="atlas-cart-badge">{totalCount > 99 ? "99+" : totalCount}</span> : null}
    </button>,
    headerMount,
  ) : null;

  return <>
    {headerButton}

    {panelOpen && <div className="atlas-cart-overlay" onMouseDown={(event) => {
      if (event.currentTarget === event.target) setPanelOpen(false);
    }}>
      <aside className="atlas-cart-panel" role="dialog" aria-modal="true" aria-label={text.cart}>
        <header className="atlas-cart-panel-head">
          <div className="atlas-cart-panel-brand">
            <span className="atlas-cart-panel-brand-icon"><ShoppingCart size={18} strokeWidth={2.2}/></span>
            <span>{text.cartTitle}</span>
          </div>
          <button type="button" aria-label={text.close} onClick={() => setPanelOpen(false)}><X size={22}/></button>
        </header>

        {!cart?.groups.length ? <div className="atlas-cart-empty">{text.empty}</div> : <div className="atlas-cart-groups">
          {cart.groups.map(group => {
            const countdown = countdownFor(group.expiresAt, clockNow);
            return <section className="atlas-cart-group" key={`${group.eventSlug}-${group.createdAt}`}>
              <div className="atlas-cart-group-head">
                <div className="atlas-cart-event-media">
                  {group.posterUrl ? <img src={group.posterUrl} alt=""/> : <span><Ticket size={22}/></span>}
                </div>
                <div className="atlas-cart-event-copy">
                  <h2>{group.eventTitle}</h2>
                </div>
                <button className="atlas-cart-group-remove" type="button" aria-label={text.remove} title={text.remove} onClick={() => setRemoveTarget(group)}><X size={18}/></button>
              </div>

              <div className="atlas-cart-hold-note">
                <div className="atlas-cart-hold-row">
                  <strong>{text.holdTitle}</strong>
                  <span className="atlas-cart-timer-pill"><Clock3 size={14}/><b>{countdown}</b></span>
                </div>
                <p>{text.holdExplain}</p>
              </div>

              <div className="atlas-cart-list">
                {group.items.map((item, index) => {
                  const price = splitPrice(item.price);
                  return <div className="atlas-cart-item" key={`${group.eventSlug}-${item.title}-${index}`}>
                    <div className="atlas-cart-item-copy">
                      <strong>{item.title}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                    </div>
                    {item.price ? <div className="atlas-cart-item-price"><b>{price.main}</b>{price.detail ? <small>{price.detail}</small> : null}</div> : null}
                  </div>;
                })}
              </div>

              <Link className="atlas-cart-group-link" href={group.eventPath} onClick={() => setPanelOpen(false)}>{text.back}</Link>
            </section>;
          })}
        </div>}
      </aside>
    </div>}

    {removeTarget ? <div className="atlas-cart-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !removing) setRemoveTarget(null); }}>
      <div className="atlas-cart-confirm" role="dialog" aria-modal="true" aria-labelledby="atlas-cart-remove-title">
        <button className="atlas-cart-confirm-close" type="button" aria-label={text.close} disabled={removing} onClick={() => setRemoveTarget(null)}><X size={20}/></button>
        <div className="atlas-cart-confirm-icon"><AlertTriangle size={22}/></div>
        <h3 id="atlas-cart-remove-title">{text.removeTitle}</h3>
        <p>{text.removeExplain}</p>
        <div className="atlas-cart-confirm-actions">
          <button type="button" className="atlas-cart-confirm-danger" disabled={removing} onClick={removeGroup}>{text.removeConfirm}</button>
          <button type="button" className="atlas-cart-confirm-cancel" disabled={removing} onClick={() => setRemoveTarget(null)}>{text.removeCancel}</button>
        </div>
      </div>
    </div> : null}

    {notice ? <div className="atlas-cart-notice" role="status" aria-live="polite">
      <Clock3 size={22} aria-hidden="true"/>
      <span>{notice}</span>
      <button type="button" aria-label="Close" onClick={() => setNotice("")}><X size={18}/></button>
    </div> : null}
  </>;
}
