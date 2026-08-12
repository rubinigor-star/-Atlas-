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

type MapSeat = { id: string; position: number; categoryId: string | null };
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
  seatItems?: MapSeat[];
};

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const seatTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

function isInternalObject(object: MapObject) {
  return object.label.startsWith("__ATLAS_") || object.label.startsWith("READING_V3_");
}

function tableSeatPosition(object: MapObject, index: number): React.CSSProperties {
  const position = index + 1;
  const seats = object.seatItems?.length ?? 0;
  const horizontal = object.width >= object.height;
  if (seats === 2) return horizontal
    ? { left: position === 1 ? "12%" : "88%", top: "50%" }
    : { left: "50%", top: position === 1 ? "12%" : "88%" };
  if (seats === 6 && horizontal) {
    const top = index < 3;
    return { left: `${[18, 50, 82][index % 3]}%`, top: top ? "14%" : "86%" };
  }
  if (seats === 8 && !horizontal) {
    const left = index < 4;
    return { left: left ? "15%" : "85%", top: `${[14, 38, 62, 86][index % 4]}%` };
  }
  const half = Math.ceil(seats / 2);
  const first = index < half;
  const slot = first ? index : index - half;
  const count = first ? half : Math.floor(seats / 2);
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  return horizontal ? { left: offset, top: first ? "14%" : "86%" } : { left: first ? "15%" : "85%", top: offset };
}

function seatPosition(object: MapObject, seat: MapSeat, index: number): React.CSSProperties {
  if (object.objectType === "ROUND_TABLE") {
    const total = Math.max(1, object.seatItems?.length ?? 1);
    const angle = index / total * Math.PI * 2 - Math.PI / 2;
    return { left: `${50 + Math.cos(angle) * 39}%`, top: `${50 + Math.sin(angle) * 39}%` };
  }
  if (object.objectType === "ROW") {
    const total = Math.max(1, object.seatItems?.length ?? 1);
    return { left: `${((index + .5) / total) * 100}%`, top: "50%" };
  }
  return tableSeatPosition(object, index);
}

function SeatMapPreview({ objects, categories }: { objects: MapObject[]; categories: Category[] }) {
  const visibleObjects = objects.filter((item) => !isInternalObject(item));
  return <div className={styles.mapPreview} aria-hidden="true">
    <div className={styles.mapViewportFit}>
      <div className={styles.mapWorld}>
        {visibleObjects.map((object) => {
          const category = categories.find((item) => item.id === object.categoryId);
          const isSeatObject = seatTypes.has(object.objectType);
          const style = {
            left: `${object.x}%`,
            top: `${object.y}%`,
            width: `${object.width}px`,
            height: `${object.height}px`,
            transform: `translate(-50%,-50%) rotate(${object.rotation}deg)`,
            background: object.objectType === "ZONE" ? (category?.colorHex ?? "#145dff") : undefined,
            borderColor: isSeatObject ? (category?.colorHex ?? "#cfd6df") : undefined,
          } as React.CSSProperties;
          return <div key={object.id} className={`${styles.mapObject} ${styles[`map${object.objectType}`] ?? ""}`} style={style}>
            <span>{object.label}</span>
            {isSeatObject && (object.seatItems ?? []).map((seat, index) => {
              const seatCategory = categories.find((item) => item.id === (seat.categoryId ?? object.categoryId));
              return <i key={seat.id} style={{ ...seatPosition(object, seat, index), background: seatCategory?.colorHex ?? "#eef2f7" }}/>;
            })}
          </div>;
        })}
      </div>
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
