"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, Clock3 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

const STORAGE_KEY = "atlas-persistent-cart-v1";
const HOLD_MS = 15 * 60 * 1000;

type PersistedCartItem = {
  title: string;
  description: string;
  price: string;
  quantity: number;
};

type PersistedCart = {
  eventSlug: string;
  eventTitle: string;
  eventPath: string;
  items: PersistedCartItem[];
  totalCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  lastNoticeStage?: number;
};

const copy = {
  ru: {
    cart: "Корзина",
    empty: "Корзина пуста",
    back: "Вернуться к билетам",
    close: "Закрыть корзину",
    saved: "Выбранные билеты сохранены на 15 минут. Завершите оформление, чтобы не потерять выбранные места.",
    left: (minutes: number) => `Осталось ${minutes} мин. Завершите оформление билетов, чтобы сохранить выбранные места.`,
    urgent: "Последние 3 минуты. Завершите оформление сейчас, иначе выбранные билеты будут удалены из корзины.",
    expired: "Время сохранения билетов истекло. Корзина очищена. Выберите билеты заново.",
    event: "Мероприятие",
    holdTitle: "Места зарезервированы за вами",
    holdExplain: "Таймер показывает, сколько времени выбранные билеты остаются в вашей корзине. После 00:00 бронь снимается, и места возвращаются в продажу.",
  },
  en: {
    cart: "Cart",
    empty: "Your cart is empty",
    back: "Return to tickets",
    close: "Close cart",
    saved: "Your selected tickets are saved for 15 minutes. Complete checkout to keep your seats.",
    left: (minutes: number) => `${minutes} minutes left. Complete checkout to keep your selected seats.`,
    urgent: "Last 3 minutes. Complete checkout now or the selected tickets will be removed from your cart.",
    expired: "Your ticket hold has expired. The cart was cleared. Please select tickets again.",
    event: "Event",
    holdTitle: "Your seats are reserved",
    holdExplain: "The timer shows how long the selected tickets remain in your cart. At 00:00 the hold ends and the seats return to sale.",
  },
  he: {
    cart: "סל",
    empty: "הסל ריק",
    back: "חזרה לכרטיסים",
    close: "סגירת הסל",
    saved: "הכרטיסים שבחרתם נשמרים ל-15 דקות. השלימו את ההזמנה כדי לא לאבד את המקומות.",
    left: (minutes: number) => `נותרו ${minutes} דקות. השלימו את ההזמנה כדי לשמור את המקומות שבחרתם.`,
    urgent: "3 דקות אחרונות. השלימו את ההזמנה עכשיו, אחרת הכרטיסים יוסרו מהסל.",
    expired: "זמן שמירת הכרטיסים הסתיים. הסל נוקה. בחרו כרטיסים מחדש.",
    event: "אירוע",
    holdTitle: "המקומות שמורים עבורכם",
    holdExplain: "הטיימר מציג כמה זמן הכרטיסים שבחרתם נשארים בסל. כשהוא מגיע ל-00:00 השמירה מסתיימת והמקומות חוזרים למכירה.",
  },
} as const;

function readCart(): PersistedCart | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PersistedCart;
    if (!value || !Array.isArray(value.items) || !value.eventSlug) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCart(value: PersistedCart | null) {
  if (!value) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("atlas-cart-change"));
}

function quantityFromTitle(title: string) {
  const match = title.match(/[×x]\s*(\d+)/i);
  const quantity = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function captureSeatPageCart(pathname: string, previous: PersistedCart | null): PersistedCart | null {
  const match = pathname.match(/^\/events\/([^/]+)\/seats/);
  if (!match) return previous;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".atlas-selected-ticket"));
  if (!nodes.length) return null;

  const items = nodes.map(node => {
    const title = node.querySelector<HTMLElement>(".atlas-selected-title")?.innerText.trim() || "Билет";
    const description = node.querySelector<HTMLElement>(".atlas-selected-desc")?.innerText.trim() || "";
    const price = node.querySelector<HTMLElement>(".atlas-selected-price")?.innerText.trim() || "";
    return { title, description, price, quantity: quantityFromTitle(title) };
  });

  const now = Date.now();
  const sameActiveCart = previous && previous.eventSlug === match[1] && previous.expiresAt > now;
  const title = document.title.split("|")[0]?.trim() || match[1].replace(/-/g, " ");

  return {
    eventSlug: match[1],
    eventTitle: sameActiveCart ? previous.eventTitle : title,
    eventPath: `/events/${match[1]}/seats`,
    items,
    totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: sameActiveCart ? previous.createdAt : now,
    updatedAt: now,
    expiresAt: sameActiveCart ? previous.expiresAt : now + HOLD_MS,
    lastNoticeStage: sameActiveCart ? previous.lastNoticeStage : undefined,
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

export function PersistentCartExperience() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const text = copy[locale];
  const [cart, setCart] = useState<PersistedCart | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [headerMount, setHeaderMount] = useState<HTMLElement | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
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
    const isSeatPage = /^\/events\/[^/]+\/seats/.test(pathname);
    if (!isSeatPage) return;

    let frame = 0;
    const syncFromDom = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const previous = readCart();
        const next = captureSeatPageCart(pathname, previous);
        if (next) writeCart(next);
      });
    };
    const syncImmediately = () => {
      const previous = readCart();
      const next = captureSeatPageCart(pathname, previous);
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
      if (!current) return;
      const remaining = current.expiresAt - Date.now();
      const stage = stageFor(remaining);

      if (stage === 0) {
        writeCart(null);
        setPanelOpen(false);
        show(text.expired);
        if (/^\/events\/[^/]+\/seats/.test(pathname)) window.setTimeout(() => window.location.reload(), 900);
        return;
      }

      const suppressNotice = pathname.startsWith("/checkout") || /^\/events\/[^/]+\/seats/.test(pathname);
      if (suppressNotice || current.lastNoticeStage === stage) return;

      const next = { ...current, lastNoticeStage: stage };
      writeCart(next);
      if (stage === 15) show(text.saved);
      else if (stage === 3) show(text.urgent);
      else show(text.left(stage));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [pathname, text]);

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);

  const remainingMs = cart ? Math.max(0, cart.expiresAt - clockNow) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const countdown = `${String(remainingMinutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

  const headerButton = headerMount ? createPortal(
    <button
      type="button"
      className="atlas-header-icon-button atlas-cart-button"
      aria-label={text.cart}
      title={text.cart}
      onClick={() => setPanelOpen(true)}
    >
      <ShoppingCart size={23} strokeWidth={1.8} aria-hidden="true"/>
      {cart?.totalCount ? <span className="atlas-cart-badge">{cart.totalCount > 99 ? "99+" : cart.totalCount}</span> : null}
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
          <div>
            <span>{text.cart}</span>
            {cart ? <small><Clock3 size={14}/> {countdown}</small> : null}
          </div>
          <button type="button" aria-label={text.close} onClick={() => setPanelOpen(false)}><X size={22}/></button>
        </header>

        {!cart ? <div className="atlas-cart-empty">{text.empty}</div> : <>
          <div style={{margin:"16px 0 18px",padding:"14px 16px",borderRadius:14,background:"rgba(255,122,0,.08)",border:"1px solid rgba(255,122,0,.18)"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,fontWeight:800,fontSize:14,color:"#111827"}}>
              <Clock3 size={18} aria-hidden="true"/>
              <span>{text.holdTitle}</span>
              <strong style={{marginLeft:"auto",fontSize:18,fontVariantNumeric:"tabular-nums",letterSpacing:".04em"}}>{countdown}</strong>
            </div>
            <p style={{margin:"8px 0 0",fontSize:12.5,lineHeight:1.45,color:"#667085"}}>{text.holdExplain}</p>
          </div>
          <div className="atlas-cart-event-label">{text.event}</div>
          <h2 className="atlas-cart-event-title">{cart.eventTitle}</h2>
          <div className="atlas-cart-list">
            {cart.items.map((item, index) => <div className="atlas-cart-item" key={`${item.title}-${index}`}>
              <div>
                <strong>{item.title}</strong>
                {item.description ? <span>{item.description}</span> : null}
              </div>
              {item.price ? <b>{item.price}</b> : null}
            </div>)}
          </div>
          <Link className="atlas-cart-return" href={cart.eventPath} onClick={() => setPanelOpen(false)}>{text.back}</Link>
        </>}
      </aside>
    </div>}

    {notice ? <div className="atlas-cart-notice" role="status" aria-live="polite">
      <Clock3 size={22} aria-hidden="true"/>
      <span>{notice}</span>
      <button type="button" aria-label="Close" onClick={() => setNotice("")}><X size={18}/></button>
    </div> : null}
  </>;
}
