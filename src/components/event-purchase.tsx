"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { calculateServiceFee, type ServiceFeeTerms } from "@/lib/service-fee";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import type { TicketSalesStrategy } from "@/lib/ticket-sales-strategy";

type PricingPresentation = { stageLabel: string; nextPriceMinor: number | null; nextAt: string | null };
type Category = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  colorHex: string;
  capacity: number;
  sold: number;
  pricingPresentation: PricingPresentation;
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy?: TicketSalesStrategy;
};
type MapSeat = { id: string; label: string; position: number; status: "AVAILABLE" | "RESERVED" | "BLOCKED"; categoryId: string | null };
type MapObject = {
  id: string;
  label: string;
  seats: number;
  priceMinor: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  reserved: boolean;
  categoryId: string | null;
  category: { name: string; colorHex: string } | null;
  zone: { name: string };
  seatItems: MapSeat[];
};

type Allocation = { type: "EVENT" | "CATEGORY" | "TABLE"; categoryId: string | null; tableId: string | null; customPriceMinor: number | null };
type OfferFilter = "ALL" | "BUY_ONE_GET_ONE";

const sellableTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

function countdown(nextAt: string | null, now: number, units: { days: string; hours: string; minutes: string }) {
  if (!nextAt) return "";
  const diff = new Date(nextAt).getTime() - now;
  if (diff <= 0) return "";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.max(1, Math.floor((diff % 3600000) / 60000));
  if (days > 0) return `${days} ${units.days} ${hours} ${units.hours}`;
  if (hours > 0) return `${hours} ${units.hours} ${minutes} ${units.minutes}`;
  return `${minutes} ${units.minutes}`;
}

function contiguousSeatIds(object: MapObject, quantity: number, allowedCategoryIds: Set<string>, minPrice: number, maxPrice: number, categoryPrice: Map<string, number>) {
  if (object.priceMode !== "PER_SEAT") return new Set<string>();
  const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
  const eligible = new Set<string>();
  for (let start = 0; start <= seats.length - quantity; start += 1) {
    const windowSeats = seats.slice(start, start + quantity);
    const firstPosition = windowSeats[0]?.position ?? 0;
    const consecutive = windowSeats.every((seat, index) => seat.position === firstPosition + index);
    const available = windowSeats.every((seat) => {
      if (seat.status !== "AVAILABLE" || !seat.categoryId || !allowedCategoryIds.has(seat.categoryId)) return false;
      const price = categoryPrice.get(seat.categoryId) ?? -1;
      return price >= minPrice && price <= maxPrice;
    });
    if (consecutive && available) windowSeats.forEach((seat) => eligible.add(seat.id));
  }
  return eligible;
}

export function EventPurchase({ eventId, categories, objects, referralCode, allocation, feeTerms }: { eventId: string; categories: Category[]; objects: MapObject[]; referralCode?: string; allocation?: Allocation; feeTerms: ServiceFeeTerms }) {
  const router = useRouter();
  const { locale, messages } = useLocale();
  const text = messages.purchase;
  const common = messages.common;
  const local = {
    ru: { tickets: "Билеты", specialOffers: "Специальные предложения", allOffers: "Все предложения", onePlusOne: "1 + 1", earlySave: "Купить раньше и сэкономить", sellingOut: "Заканчиваются", pickSeats: "Выбрать места", back: "Назад", priceFilter: "Цена билета", seatsTogether: "Показываем только варианты, где выбранное количество мест можно купить рядом", selectExact: "Выберите мест", selectedOf: "Выбрано", from: "от" },
    en: { tickets: "Tickets", specialOffers: "Special offers", allOffers: "All offers", onePlusOne: "1 + 1", earlySave: "Buy early & save", sellingOut: "Selling out", pickSeats: "Pick your seats", back: "Back", priceFilter: "Ticket price", seatsTogether: "Only options with the selected number of adjacent seats are shown", selectExact: "Select seats", selectedOf: "Selected", from: "from" },
    he: { tickets: "כרטיסים", specialOffers: "הצעות מיוחדות", allOffers: "כל ההצעות", onePlusOne: "1 + 1", earlySave: "קונים מוקדם וחוסכים", sellingOut: "כמעט נגמר", pickSeats: "בחירת מקומות", back: "חזרה", priceFilter: "מחיר כרטיס", seatsTogether: "מוצגים רק מקומות שבהם ניתן לשבת יחד לפי הכמות שנבחרה", selectExact: "בחרו מקומות", selectedOf: "נבחרו", from: "החל מ־" },
  }[locale];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  const availableCategories = allocation?.type === "CATEGORY" ? categories.filter((item) => item.id === allocation.categoryId) : categories;
  const availableObjects = allocation?.type === "TABLE" ? objects.filter((item) => item.id === allocation.tableId || !sellableTypes.has(item.objectType)) : objects;
  const hasSeatMap = availableObjects.some((item) => sellableTypes.has(item.objectType));
  const hasOnePlusOne = availableCategories.some((item) => item.salesStrategy === "BUY_ONE_GET_ONE");
  const hasEarly = availableCategories.some((item) => /early/i.test(item.pricingPresentation.stageLabel));
  const hasSellingOut = availableCategories.some((item) => item.marketingStrategy.showStageRemaining || item.capacity - item.sold <= Math.max(10, Math.ceil(item.capacity * 0.1)));

  const buyerPrice = (subtotalMinor: number) => calculateServiceFee(subtotalMinor, feeTerms).buyerTotalMinor;
  const categoryPrice = useMemo(() => new Map(availableCategories.map((item) => [item.id, buyerPrice(item.priceMinor)])), [availableCategories, feeTerms]);
  const priceValues = useMemo(() => [...new Set(availableCategories.map((item) => buyerPrice(item.priceMinor)))].sort((a, b) => a - b), [availableCategories, feeTerms]);
  const absoluteMinPrice = priceValues[0] ?? 0;
  const absoluteMaxPrice = priceValues.at(-1) ?? 0;

  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id ?? categories[0]?.id ?? "");
  const [wholeObjectId, setWholeObjectId] = useState<string | null>(allocation?.type === "TABLE" ? allocation.tableId : null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [qty, setQty] = useState(2);
  const [mapOpen, setMapOpen] = useState(Boolean(allocation?.type === "TABLE"));
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("ALL");
  const [minPrice, setMinPrice] = useState(absoluteMinPrice);
  const [maxPrice, setMaxPrice] = useState(absoluteMaxPrice);

  useEffect(() => { setMinPrice(absoluteMinPrice); setMaxPrice(absoluteMaxPrice); }, [absoluteMinPrice, absoluteMaxPrice]);

  const allowedCategoryIds = useMemo(() => new Set(availableCategories.filter((item) => offerFilter === "ALL" || item.salesStrategy === offerFilter).map((item) => item.id)), [availableCategories, offerFilter]);
  const eligibleSeatIds = useMemo(() => {
    const result = new Set<string>();
    for (const object of availableObjects) {
      for (const id of contiguousSeatIds(object, qty, allowedCategoryIds, minPrice, maxPrice, categoryPrice)) result.add(id);
    }
    return result;
  }, [availableObjects, qty, allowedCategoryIds, minPrice, maxPrice, categoryPrice]);

  const category = categories.find((item) => item.id === categoryId);
  const wholeObject = objects.find((item) => item.id === wholeObjectId);
  const selectedSeats = objects.flatMap((item) => item.seatItems).filter((seat) => selectedSeatIds.includes(seat.id));
  const seatObject = objects.find((item) => item.seatItems.some((seat) => selectedSeatIds.includes(seat.id)));
  const selectionObject = wholeObject ?? seatObject;

  const subtotal = useMemo(() => {
    if (allocation?.customPriceMinor !== null && allocation?.customPriceMinor !== undefined && allocation.type === "TABLE" && wholeObject) return allocation.customPriceMinor;
    if (wholeObject) return categories.find((item) => item.id === wholeObject.categoryId)?.priceMinor ?? wholeObject.priceMinor;
    if (selectedSeats.length) return selectedSeats.reduce((sum, seat) => sum + (categories.find((item) => item.id === seat.categoryId)?.priceMinor ?? 0), 0);
    return (category?.priceMinor ?? 0) * qty;
  }, [wholeObject, selectedSeats, categories, category, qty, allocation]);
  const total = buyerPrice(subtotal);

  function clearMapSelection() {
    if (allocation?.type === "TABLE") return;
    setWholeObjectId(null);
    setSelectedSeatIds([]);
  }

  function chooseSeat(object: MapObject, seat: MapSeat) {
    if (seat.status !== "AVAILABLE" || allocation?.type === "TABLE" || !eligibleSeatIds.has(seat.id)) return;
    setWholeObjectId(null);
    if (!seat.categoryId) return;
    setCategoryId(seat.categoryId);
    setSelectedSeatIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      const sameObject = current.every((id) => object.seatItems.some((item) => item.id === id));
      const base = sameObject ? current : [];
      if (base.length >= qty) return base;
      return [...base, seat.id];
    });
  }

  function go() {
    const effectiveCategoryId = selectedSeats.find((seat) => seat.categoryId)?.categoryId ?? categoryId;
    if (!effectiveCategoryId || (hasSeatMap && !wholeObject && selectedSeatIds.length !== qty)) return;
    const quantity = wholeObject ? wholeObject.seats : selectedSeats.length || qty;
    const query = new URLSearchParams({ eventId, categoryId: effectiveCategoryId, quantity: String(quantity), locale });
    if (wholeObject) query.set("tableId", wholeObject.id);
    if (selectedSeatIds.length > 0) query.set("seatIds", selectedSeatIds.join(","));
    if (referralCode) query.set("ref", referralCode);
    router.push(`/checkout?${query}`);
  }

  if (hasSeatMap && !mapOpen) {
    return <div className="panel purchase-panel" style={{ display: "grid", gap: 18 }}>
      <div className="row between" style={{ alignItems: "center" }}><h2 style={{ margin: 0 }}>{local.tickets}</h2><div style={{ display: "flex", alignItems: "center", gap: 16 }}><button type="button" aria-label="decrease" onClick={() => setQty((value) => Math.max(1, value - 1))} style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid #d7dce5", background: "white", fontSize: 24, cursor: "pointer" }}>−</button><strong style={{ fontSize: 20 }}>{qty}</strong><button type="button" aria-label="increase" onClick={() => setQty((value) => Math.min(10, value + 1))} style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid #d7dce5", background: "white", fontSize: 24, cursor: "pointer" }}>+</button></div></div>
      {(hasEarly || hasSellingOut || hasOnePlusOne) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid #e5e7eb" }}>
        {hasEarly && <span style={{ padding: "7px 10px", borderRadius: 6, background: "#dff0ff", color: "#0d5c9f", fontSize: 13, fontWeight: 700 }}>🏷 {local.earlySave}</span>}
        {hasSellingOut && <span style={{ padding: "7px 10px", borderRadius: 6, background: "#ffe4c7", color: "#b45309", fontSize: 13, fontWeight: 700 }}>🔥 {local.sellingOut}</span>}
        {hasOnePlusOne && <span style={{ padding: "7px 10px", borderRadius: 6, background: "#ede9fe", color: "#6d28d9", fontSize: 13, fontWeight: 700 }}>1 + 1</span>}
      </div>}
      <button type="button" className="btn" onClick={() => { clearMapSelection(); setMapOpen(true); }} style={{ width: "100%", minHeight: 52, fontSize: 17 }}>{local.pickSeats}</button>
    </div>;
  }

  return <div className="panel purchase-panel">
    {hasSeatMap ? <>
      <div className="row between" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn secondary" onClick={() => { clearMapSelection(); setMapOpen(false); }}>{local.back}</button>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontWeight: 700 }}>{local.specialOffers}</label>
          <select value={offerFilter} onChange={(event) => { setOfferFilter(event.target.value as OfferFilter); clearMapSelection(); }} style={{ minWidth: 170 }}>
            <option value="ALL">{local.allOffers}</option>
            {hasOnePlusOne && <option value="BUY_ONE_GET_ONE">{local.onePlusOne}</option>}
          </select>
          <button type="button" aria-label="decrease" onClick={() => { setQty((value) => Math.max(1, value - 1)); clearMapSelection(); }} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid #d7dce5", background: "white", fontSize: 22 }}>−</button>
          <strong>{qty}</strong>
          <button type="button" aria-label="increase" onClick={() => { setQty((value) => Math.min(10, value + 1)); clearMapSelection(); }} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid #d7dce5", background: "white", fontSize: 22 }}>+</button>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 14, background: "#f7f8fa", border: "1px solid #e4e7ec" }}>
        <div className="row between" style={{ gap: 12 }}><strong>{local.priceFilter}</strong><span>{money(minPrice,"ILS",locale)} - {money(maxPrice,"ILS",locale)}</span></div>
        <div style={{ position: "relative", height: 38, marginTop: 8 }}>
          <input aria-label="minimum price" type="range" min={absoluteMinPrice} max={absoluteMaxPrice || absoluteMinPrice + 1} step={100} value={minPrice} onChange={(event) => { const value = Math.min(Number(event.target.value), maxPrice); setMinPrice(value); clearMapSelection(); }} style={{ position: "absolute", inset: "6px 0 0", width: "100%", accentColor: "#1e88ff" }} />
          <input aria-label="maximum price" type="range" min={absoluteMinPrice} max={absoluteMaxPrice || absoluteMinPrice + 1} step={100} value={maxPrice} onChange={(event) => { const value = Math.max(Number(event.target.value), minPrice); setMaxPrice(value); clearMapSelection(); }} style={{ position: "absolute", inset: "6px 0 0", width: "100%", accentColor: "#20b15a", pointerEvents: "none" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>{availableCategories.map((item) => <span key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, opacity: allowedCategoryIds.has(item.id) && (categoryPrice.get(item.id) ?? 0) >= minPrice && (categoryPrice.get(item.id) ?? 0) <= maxPrice ? 1 : .32 }}><i style={{ width: 10, height: 10, borderRadius: 999, background: item.colorHex }} />{money(categoryPrice.get(item.id) ?? 0,"ILS",locale)}</span>)}</div>
      </div>

      <p className="muted" style={{ margin: "12px 0 0" }}>{local.seatsTogether}</p>
      <h3 className="map-purchase-title">{text.map}</h3>
      <div className="venue-canvas buyer-map">
        <div className="map-stage">{text.stage}</div>
        {availableObjects.map((object) => {
          const isSellable = sellableTypes.has(object.objectType);
          const soldWhole = object.reserved;
          const selectedWhole = wholeObjectId === object.id;
          const objectCategoryPrice = object.categoryId ? categoryPrice.get(object.categoryId) ?? 0 : 0;
          const wholeVisible = object.priceMode !== "WHOLE_TABLE" || (Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId)) && objectCategoryPrice >= minPrice && objectCategoryPrice <= maxPrice && object.seats >= qty);
          const objectSubtotal = allocation?.type === "TABLE" && allocation.customPriceMinor !== null ? allocation.customPriceMinor : categories.find((item) => item.id === object.categoryId)?.priceMinor ?? 0;
          return <div key={object.id} className={`map-object buyer-object object-${object.objectType.toLowerCase().replace("_", "-")} ${object.objectType.toLowerCase().replace("_", "-")} ${selectedWhole ? "selected" : ""} ${soldWhole ? "unavailable" : ""}`} style={{ left: `${object.x}%`, top: `${object.y}%`, width: object.width, height: object.height, transform: `translate(-50%, -50%) rotate(${object.rotation}deg)`, zIndex: object.objectType === "ZONE" ? 1 : 2, opacity: isSellable && !wholeVisible ? .16 : 1, pointerEvents: isSellable && !wholeVisible ? "none" : undefined }}>
            {!isSellable ? <div className={`buyer-decoration decoration-${object.objectType.toLowerCase()}`}><strong>{object.label}</strong></div> : <>
              <button type="button" className="object-core" disabled={soldWhole || object.priceMode === "PER_SEAT" || allocation?.type === "TABLE" || !wholeVisible} onClick={() => { setSelectedSeatIds([]); setWholeObjectId(selectedWhole ? null : object.id); setCategoryId(object.categoryId ?? categoryId); }}><strong>{object.label}</strong><small>{object.objectType === "SOFA" ? text.sofa : object.objectType === "ROW" ? text.row : text.table}</small></button>
              <span className="buyer-seat-ring">{object.seatItems.map((seat) => {
                const visible = seat.status !== "AVAILABLE" || selectedSeatIds.includes(seat.id) || eligibleSeatIds.has(seat.id);
                return <button type="button" key={seat.id} title={seat.status === "AVAILABLE" ? seat.label : text.unavailable} disabled={object.priceMode === "WHOLE_TABLE" || seat.status !== "AVAILABLE" || !seat.categoryId || allocation?.type === "TABLE" || !eligibleSeatIds.has(seat.id)} className={`map-seat ${selectedSeatIds.includes(seat.id) ? "selected" : ""} ${seat.status.toLowerCase()}`} style={{ "--ticket-color": categories.find((item) => item.id === seat.categoryId)?.colorHex ?? "#CBD5E1", visibility: visible ? "visible" : "hidden", opacity: seat.status === "AVAILABLE" && !eligibleSeatIds.has(seat.id) ? .15 : 1 } as React.CSSProperties} onClick={() => chooseSeat(object, seat)}>{seat.position}</button>;
              })}</span>
              <small className="object-price">{object.priceMode === "WHOLE_TABLE" ? `${money(buyerPrice(objectSubtotal),"ILS",locale)} ${text.whole}` : object.seatItems.some((seat) => seat.categoryId) ? text.perSeat : text.unassigned}</small>
            </>}
          </div>;
        })}
      </div>
      <div className="seat-selection-summary" style={{ marginTop: 14 }}><span>{local.selectedOf}</span><strong>{selectedSeatIds.length} / {qty}</strong></div>
      <div className="row between" style={{ marginTop: 18, gap: 16 }}><div>{selectedSeatIds.length > 0 && <><small className="muted">{common.total}</small><br /><strong style={{ fontSize: 24 }}>{money(total,"ILS",locale)}</strong></>}</div><button className="btn" disabled={!wholeObject && selectedSeatIds.length !== qty} onClick={go}>{common.continue}</button></div>
    </> : <>
      <h2>{text.title}</h2>
      <div className="options">{availableCategories.map((item) => {
        const strategy = item.marketingStrategy;
        const timeLeft = strategy.showCountdown ? countdown(item.pricingPresentation.nextAt, now, text) : "";
        const finalUnitPrice = buyerPrice(item.priceMinor);
        const nextFinalPrice = item.pricingPresentation.nextPriceMinor === null ? null : buyerPrice(item.pricingPresentation.nextPriceMinor);
        return <button type="button" key={item.id} className={`option ${categoryId === item.id && !selectionObject ? "selected" : ""}`} onClick={() => { setCategoryId(item.id); clearMapSelection(); }}>
          <span><strong>{item.name}</strong><br /><small className="muted">{item.description}</small><span className="pricing-pressure"><b>{item.pricingPresentation.stageLabel}</b>{timeLeft && <small>⏰ {text.priceRisesIn} {timeLeft}</small>}{strategy.showNextPrice && nextFinalPrice !== null && <small>{text.next}: {money(nextFinalPrice,"ILS",locale)}</small>}{strategy.showStageRemaining && <small>🔥 {text.endsSoon}</small>}{strategy.showTotalRemaining && <small>🎟 {text.remaining} {item.capacity - item.sold}</small>}{strategy.showSoldCount && <small>✓ {text.sold} {item.sold} {text.tickets}</small>}</span></span><strong>{money(finalUnitPrice,"ILS",locale)}</strong>
        </button>;
      })}</div>
      {!selectionObject && <div className="field" style={{ marginTop: 16 }}><label>{common.quantity}</label><select value={qty} onChange={(event) => setQty(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((number) => <option key={number}>{number}</option>)}</select></div>}
      <div className="row between" style={{ marginTop: 20 }}><div><small className="muted">{common.total}</small><br /><strong style={{ fontSize: 24 }}>{money(total,"ILS",locale)}</strong></div><button className="btn" onClick={go}>{common.continue}</button></div>
    </>}
  </div>;
}
