"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { LiveViewerPressure } from "@/components/live-viewer-pressure";
import { calculateServiceFee, type ServiceFeeTerms } from "@/lib/service-fee";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import type { TicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import styles from "./general-admission-purchase.module.css";

const CART_STORAGE_KEY = "atlas-persistent-cart-v2";
const HOLD_MS = 15 * 60 * 1000;

type PricingPresentation = { stageLabel: string; nextPriceMinor: number | null; nextAt: string | null };
type Category = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  capacity: number;
  sold: number;
  maxPerOrder?: number | null;
  pricingPresentation: PricingPresentation;
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy?: TicketSalesStrategy;
};

type CartItem = { categoryId: string; quantity: number; tableId: null; seatIds: string[] };
type PersistedItem = { title: string; description: string; price: string; quantity: number };
type PersistedGroup = {
  eventSlug: string;
  eventTitle: string;
  eventPath: string;
  posterUrl: string;
  items: PersistedItem[];
  totalCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  lastNoticeStage?: number;
};
type PersistedCart = { version: 2; groups: PersistedGroup[] };

type Props = {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  posterUrl: string;
  categories: Category[];
  feeTerms: ServiceFeeTerms;
  referralCode?: string;
  allocationCategoryId?: string | null;
};

function readCart(): PersistedCart | null {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCart>;
    if (parsed.version !== 2 || !Array.isArray(parsed.groups)) return null;
    return { version: 2, groups: parsed.groups.filter(Boolean) as PersistedGroup[] };
  } catch {
    return null;
  }
}

function writeCart(cart: PersistedCart) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("atlas-cart-change"));
}

export function GeneralAdmissionPurchase({ eventId, eventSlug, eventTitle, posterUrl, categories, feeTerms, referralCode, allocationCategoryId }: Props) {
  const router = useRouter();
  const { locale, messages } = useLocale();
  const purchase = messages.purchase;
  const local = {
    ru: { eyebrow: "Билеты на", checkout: "Перейти к оплате", busy: "Добавляем билеты…", fee: "включая сервисный сбор" },
    en: { eyebrow: "Tickets for", checkout: "Continue to checkout", busy: "Adding tickets…", fee: "including service fee" },
    he: { eyebrow: "כרטיסים ל", checkout: "מעבר לתשלום", busy: "מוסיפים כרטיסים…", fee: "כולל דמי שירות" },
  }[locale];

  const availableCategories = allocationCategoryId ? categories.filter(item => item.id === allocationCategoryId) : categories;
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const buyerUnitPrice = (minor: number) => calculateServiceFee(minor, feeTerms).buyerTotalMinor;
  const selected = useMemo(() => availableCategories.flatMap(category => {
    const quantity = quantities[category.id] ?? 0;
    return quantity > 0 ? [{ category, quantity }] : [];
  }), [availableCategories, quantities]);
  const totalCount = selected.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selected.reduce((sum, item) => sum + item.category.priceMinor * item.quantity, 0);
  const total = subtotal > 0 ? calculateServiceFee(subtotal, feeTerms).buyerTotalMinor : 0;

  function maxFor(category: Category) {
    const available = Math.max(0, category.capacity - category.sold);
    const categoryMax = Math.max(1, category.maxPerOrder ?? 10);
    return Math.min(20, categoryMax, available);
  }

  function change(category: Category, delta: number) {
    setQuantities(current => {
      const next = Math.max(0, Math.min(maxFor(category), (current[category.id] ?? 0) + delta));
      return { ...current, [category.id]: next };
    });
  }

  function clear(category: Category) {
    setQuantities(current => ({ ...current, [category.id]: 0 }));
  }

  async function checkout() {
    if (!selected.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const items: CartItem[] = selected.map(({ category, quantity }) => ({ categoryId: category.id, quantity, tableId: null, seatIds: [] }));
      const holdResponse = await fetch("/api/cart/hold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, items }),
      });
      const holdData = await holdResponse.json();
      if (!holdResponse.ok) throw new Error(holdData.error || purchase.unavailable);

      const query = new URLSearchParams({ eventId, cart: JSON.stringify(items), locale });
      if (referralCode) query.set("ref", referralCode);
      const checkoutPath = `/checkout?${query.toString()}`;
      const now = Date.now();
      const expiresAt = holdData.expiresAt ? new Date(holdData.expiresAt).getTime() : now + HOLD_MS;
      const current = readCart() ?? { version: 2 as const, groups: [] };
      const previous = current.groups.find(group => group.eventSlug === eventSlug);
      const cartItems: PersistedItem[] = selected.map(({ category, quantity }) => ({
        title: `${category.name} × ${quantity}`,
        description: category.description || "",
        price: money(buyerUnitPrice(category.priceMinor), "ILS", locale),
        quantity,
      }));
      const group: PersistedGroup = {
        eventSlug,
        eventTitle,
        eventPath: checkoutPath,
        posterUrl,
        items: cartItems,
        totalCount,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
        expiresAt,
      };
      writeCart({ version: 2, groups: [...current.groups.filter(item => item.eventSlug !== eventSlug && item.expiresAt > now), group] });
      router.push(checkoutPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : purchase.unavailable);
      setBusy(false);
    }
  }

  return <div className={styles.card}>
    <div className={styles.header}>
      <span className={styles.eyebrow}>{local.eyebrow}</span>
      <h2 className={styles.title}>{eventTitle}</h2>
    </div>

    <div className={styles.list}>{availableCategories.map(category => {
      const quantity = quantities[category.id] ?? 0;
      const strategy = category.marketingStrategy;
      const promotion = category.salesStrategy === "BUY_ONE_GET_ONE" ? "1 + 1" : category.pricingPresentation.stageLabel || "";
      const priceBreakdown = calculateServiceFee(category.priceMinor, feeTerms);
      const finalUnitPrice = priceBreakdown.buyerTotalMinor;
      const buyerFee = Math.max(0, finalUnitPrice - category.priceMinor);
      const nextPrice = category.pricingPresentation.nextPriceMinor === null ? null : buyerUnitPrice(category.pricingPresentation.nextPriceMinor);
      return <div className={styles.ticket} key={category.id}>
        {promotion ? <div className={styles.promo}>{promotion}</div> : null}
        <div className={styles.ticketGrid}>
          <div className={styles.ticketCopy}>
            <div className={styles.name}>{category.name}</div>
            {category.description ? <div className={styles.description}>{category.description}</div> : null}
            <div className={styles.pressure}>
              {strategy.showNextPrice && nextPrice !== null ? <small>{purchase.next}: {money(nextPrice, "ILS", locale)}</small> : null}
              {strategy.showStageRemaining ? <small>🔥 {purchase.endsSoon}</small> : null}
              {strategy.showTotalRemaining ? <small>🎟 {purchase.remaining} {Math.max(0, category.capacity - category.sold)}</small> : null}
              {strategy.showSoldCount ? <small>✓ {purchase.sold} {category.sold} {purchase.tickets}</small> : null}
            </div>
          </div>

          <div className={styles.ticketControls}>
            <button type="button" className={styles.clearButton} aria-label="remove ticket" disabled={quantity === 0 || busy} onClick={() => clear(category)}><X size={17}/></button>
            <div className={styles.price}>{money(finalUnitPrice, "ILS", locale)}</div>
            {buyerFee > 0 ? <div className={styles.fee}>{local.fee} {money(buyerFee, "ILS", locale)}</div> : <div className={styles.feePlaceholder}> </div>}
            <div className={styles.stepper}>
              <button type="button" aria-label="decrease" disabled={quantity === 0 || busy} onClick={() => change(category, -1)}>−</button>
              <span className={styles.qty}>{quantity}</span>
              <button type="button" aria-label="increase" disabled={quantity >= maxFor(category) || busy} onClick={() => change(category, 1)}>+</button>
            </div>
          </div>
        </div>
      </div>;
    })}</div>

    <div className={styles.footer}>
      <div className={styles.viewer}><LiveViewerPressure locale={locale}/></div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <button type="button" className={styles.cta} disabled={totalCount === 0 || busy} onClick={checkout}>
        <span>{busy ? local.busy : local.checkout}</span>
        {totalCount > 0 && !busy ? <strong>{money(total, "ILS", locale)}</strong> : null}
      </button>
    </div>
  </div>;
}
