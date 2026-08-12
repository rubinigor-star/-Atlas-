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
  name: string;
  colorHex: string;
  capacity: number;
  sold: number;
  pricingPresentation: { stageLabel: string };
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy?: TicketSalesStrategy;
};

type MapObject = {
  id: string;
  label: string;
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  categoryId: string | null;
  seatItems?: Array<{ id: string; position: number; categoryId: string | null }>;
};

const seatTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

function isInternalObject(object: MapObject) {
  return object.label.startsWith("__ATLAS_") || object.label.startsWith("READING_V3_");
}

function SeatMapPreview({ objects, categories }: { objects: MapObject[]; categories: Category[] }) {
  const visibleObjects = objects.filter((item) => !isInternalObject(item));
  return <div className={styles.mapPreview} aria-hidden="true">
    <div className={styles.mapWorld}>
      {visibleObjects.map((object) => {
        const category = categories.find((item) => item.id === object.categoryId);
        const isSeatObject = seatTypes.has(object.objectType);
        const style = {
          left: `${object.x}%`,
          top: `${object.y}%`,
          width: `${Math.max(18, object.width * .72)}px`,
          height: `${Math.max(10, object.height * .72)}px`,
          transform: `translate(-50%,-50%) rotate(${object.rotation}deg)`,
          background: object.objectType === "ZONE" ? (category?.colorHex ?? "#1c63f3") : undefined,
          borderColor: isSeatObject ? (category?.colorHex ?? "#cbd5e1") : undefined,
        } as React.CSSProperties;
        return <div key={object.id} className={`${styles.mapObject} ${styles[`map${object.objectType}`] ?? ""}`} style={style}>
          <span>{object.label}</span>
          {isSeatObject && (object.seatItems ?? []).slice(0, 10).map((seat, index) => <i key={seat.id} style={{ "--seat-index": index } as React.CSSProperties}/>) }
        </div>;
      })}
    </div>
  </div>;
}

export function SeatMapPurchaseCard({ slug, title, categories, objects, referralCode }: { slug: string; title: string; categories: Category[]; objects: MapObject[]; referralCode?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const [qty, setQty] = useState(2);
  const local = {
    ru: { ticketsOn:"Билеты на", offersTitle:"На данном мероприятии действуют следующие предложения:", early:"Купить раньше и сэкономить", onePlusOne:"При заказе 1+1 билетов цена снижается", tickets:"Tickets", pick:"Выбрать места", decrease:"Уменьшить количество", increase:"Увеличить количество" },
    en: { ticketsOn:"Tickets for", offersTitle:"The following offers are available for this event:", early:"Buy early and save", onePlusOne:"Order 1+1 tickets and pay less", tickets:"Tickets", pick:"Pick your seats", decrease:"Decrease quantity", increase:"Increase quantity" },
    he: { ticketsOn:"כרטיסים ל", offersTitle:"באירוע זה זמינות ההצעות הבאות:", early:"קונים מוקדם וחוסכים", onePlusOne:"בהזמנת 1+1 כרטיסים המחיר יורד", tickets:"כרטיסים", pick:"בחירת מקומות", decrease:"הפחתת כמות", increase:"הגדלת כמות" },
  }[locale];

  const hasEarly = categories.some((item) => /early/i.test(item.pricingPresentation.stageLabel));
  const hasOnePlusOne = categories.some((item) => item.salesStrategy === "BUY_ONE_GET_ONE");
  const hasOffers = hasEarly || hasOnePlusOne;

  function openSeats() {
    const query = new URLSearchParams({ qty:String(qty) });
    if (referralCode) query.set("ref", referralCode);
    router.push(`/events/${slug}/seats?${query}`);
  }

  return <div className={`${styles.card} ${hasOffers ? styles.withOffers : styles.noOffers}`}>
    <div className={styles.titleRow}><h2>{local.ticketsOn} {title}</h2></div>
    {hasOffers && <div className={styles.offersSection}>
      <p>{local.offersTitle}</p>
      <div className={styles.offers}>
        {hasEarly && <div className={styles.early}><span className={styles.offerIcon}>🏷</span><span>{local.early}</span></div>}
        {hasOnePlusOne && <div className={styles.onePlusOne}><span className={styles.offerIcon}>🔥</span><span>{local.onePlusOne}</span></div>}
      </div>
    </div>}
    <div className={styles.mapSection}><SeatMapPreview objects={objects} categories={categories}/></div>
    <div className={styles.quantityRow}>
      <strong>{local.tickets}</strong>
      <div className={styles.quantity}>
        <button type="button" aria-label={local.decrease} onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
        <span>{qty}</span>
        <button type="button" aria-label={local.increase} onClick={() => setQty((value) => Math.min(8, value + 1))}>+</button>
      </div>
    </div>
    <div className={styles.viewer}><LiveViewerPressure locale={locale}/></div>
    <button type="button" className={styles.pick} onClick={openSeats}>{local.pick}</button>
  </div>;
}
