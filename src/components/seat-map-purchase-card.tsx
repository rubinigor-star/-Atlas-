"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { LiveViewerPressure } from "@/components/live-viewer-pressure";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import type { TicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import styles from "./seat-map-purchase-card.module.css";

type Category = {
  id: string;
  capacity: number;
  sold: number;
  pricingPresentation: { stageLabel: string };
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy?: TicketSalesStrategy;
};

export function SeatMapPurchaseCard({ slug, categories, referralCode }: { slug: string; categories: Category[]; referralCode?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const [qty, setQty] = useState(2);
  const local = {
    ru: { tickets:"Билеты", early:"Купить раньше и сэкономить", selling:"Заканчиваются", onePlusOne:"1 + 1", pick:"Выбрать места", decrease:"Уменьшить количество", increase:"Увеличить количество" },
    en: { tickets:"Tickets", early:"Buy early & save", selling:"Selling out", onePlusOne:"1 + 1", pick:"Pick your seats", decrease:"Decrease quantity", increase:"Increase quantity" },
    he: { tickets:"כרטיסים", early:"קונים מוקדם וחוסכים", selling:"כמעט נגמר", onePlusOne:"1 + 1", pick:"בחירת מקומות", decrease:"הפחתת כמות", increase:"הגדלת כמות" },
  }[locale];

  const hasEarly = categories.some((item) => /early/i.test(item.pricingPresentation.stageLabel));
  const hasSellingOut = categories.some((item) => item.marketingStrategy.showStageRemaining || item.capacity - item.sold <= Math.max(10, Math.ceil(item.capacity * 0.1)));
  const hasOnePlusOne = categories.some((item) => item.salesStrategy === "BUY_ONE_GET_ONE");

  function openSeats() {
    const query = new URLSearchParams({ qty:String(qty) });
    if (referralCode) query.set("ref", referralCode);
    router.push(`/events/${slug}/seats?${query}`);
  }

  return <div className={styles.card}>
    <div className={styles.head}>
      <h2>{local.tickets}</h2>
      <div className={styles.quantity}>
        <button type="button" aria-label={local.decrease} onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
        <strong>{qty}</strong>
        <button type="button" aria-label={local.increase} onClick={() => setQty((value) => Math.min(8, value + 1))}>+</button>
      </div>
    </div>
    {(hasEarly || hasSellingOut || hasOnePlusOne) && <div className={styles.offers}>
      {hasEarly && <span className={styles.early}>🏷 {local.early}</span>}
      {hasSellingOut && <span className={styles.selling}>🔥 {local.selling}</span>}
      {hasOnePlusOne && <span className={styles.onePlusOne}>{local.onePlusOne}</span>}
    </div>}
    <LiveViewerPressure locale={locale} />
    <button type="button" className={styles.pick} onClick={openSeats}>{local.pick}</button>
  </div>;
}
