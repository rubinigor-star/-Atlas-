"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { calculateServiceFee, type ServiceFeeTerms } from "@/lib/service-fee";

type PricingPresentation = { stageLabel: string; nextPriceMinor: number | null; nextAt: string | null };
type Category = { id: string; name: string; description: string | null; priceMinor: number; buyerPriceMinor: number; colorHex: string; capacity: number; sold: number; pricingPresentation: PricingPresentation; marketingStrategy: PricingMarketingStrategy };
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

export function EventPurchaseFinal({ eventId, categories, objects, referralCode, allocation, serviceFeeTerms }: { eventId: string; categories: Category[]; objects: MapObject[]; referralCode?: string; allocation?: Allocation; serviceFeeTerms: ServiceFeeTerms }) {
  const router = useRouter();
  const { locale, messages } = useLocale();
  const text = messages.purchase;
  const common = messages.common;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const availableCategories = allocation?.type === "CATEGORY" ? categories.filter((item) => item.id === allocation.categoryId) : categories;
  const availableObjects = allocation?.type === "TABLE" ? objects.filter((item) => item.id === allocation.tableId || !["TABLE", "ROUND_TABLE", "SOFA", "ROW"].includes(item.objectType)) : objects;
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id ?? categories[0]?.id ?? "");
  const [wholeObjectId, setWholeObjectId] = useState<string | null>(allocation?.type === "TABLE" ? allocation.tableId : null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
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
  const buyerTotal = useMemo(() => calculateServiceFee(subtotal, serviceFeeTerms).buyerTotalMinor, [subtotal, serviceFeeTerms]);
  const buyerPrice = (baseMinor: number) => calculateServiceFee(baseMinor, serviceFeeTerms).buyerTotalMinor;

  function clearMapSelection() {
    if (allocation?.type === "TABLE") return;
    setWholeObjectId(null);
    setSelectedSeatIds([]);
  }

  function chooseSeat(object: MapObject, seat: MapSeat) {
    if (seat.status !== "AVAILABLE" || allocation?.type === "TABLE") return;
    setWholeObjectId(null);
    if (!seat.categoryId) return;
    setCategoryId(seat.categoryId);
    setSelectedSeatIds((current) => current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id]);
  }

  function go() {
    if (!categoryId || (seatObject && selectedSeatIds.length === 0)) return;
    const quantity = wholeObject ? wholeObject.seats : seatObject ? selectedSeatIds.length : qty;
    const query = new URLSearchParams({ eventId, categoryId, quantity: String(quantity), locale });
    if (wholeObject) query.set("tableId", wholeObject.id);
    if (selectedSeatIds.length > 0) query.set("seatIds", selectedSeatIds.join(","));
    if (referralCode) query.set("ref", referralCode);
    router.push(`/checkout?${query}`);
  }

  return <div className="panel purchase-panel">
    <h2>{text.title}</h2>
    <div className="options">{availableCategories.map((item) => {
      const strategy = item.marketingStrategy;
      const timeLeft = strategy.showCountdown ? countdown(item.pricingPresentation.nextAt, now, text) : "";
      return <button type="button" key={item.id} className={`option ${categoryId === item.id && !selectionObject ? "selected" : ""}`} onClick={() => { setCategoryId(item.id); clearMapSelection(); }}>
        <span><strong>{item.name}</strong><br /><small className="muted">{item.description}</small>
          <span className="pricing-pressure">
            <b>{item.pricingPresentation.stageLabel}</b>
            {timeLeft && <small>⏰ {text.priceRisesIn} {timeLeft}</small>}
            {strategy.showNextPrice && item.pricingPresentation.nextPriceMinor !== null && <small>{text.next}: {money(buyerPrice(item.pricingPresentation.nextPriceMinor),"ILS",locale)}</small>}
            {strategy.showStageRemaining && <small>🔥 {text.endsSoon}</small>}
            {strategy.showTotalRemaining && <small>🎟 {text.remaining} {item.capacity - item.sold}</small>}
            {strategy.showSoldCount && <small>✓ {text.sold} {item.sold} {text.tickets}</small>}
          </span>
        </span><strong>{money(item.buyerPriceMinor,"ILS",locale)}</strong>
      </button>;
    })}</div>

    {availableObjects.length > 0 && <>
      <h3 className="map-purchase-title">{text.map}</h3>
      <div className="buyer-ticket-legend"><strong>{text.legend}</strong>{availableCategories.map((item) => <span key={item.id}><i style={{ background: item.colorHex }} />{item.name} · {money(item.buyerPriceMinor,"ILS",locale)}</span>)}</div>
      <div className="venue-canvas buyer-map">
        <div className="map-stage">{text.stage}</div>
        {availableObjects.map((object) => {
          const isSellable = ["TABLE", "ROUND_TABLE", "SOFA", "ROW"].includes(object.objectType);
          const soldWhole = object.reserved;
          const selectedWhole = wholeObjectId === object.id;
          return <div key={object.id} className={`map-object buyer-object object-${object.objectType.toLowerCase().replace("_", "-")} ${object.objectType.toLowerCase().replace("_", "-")} ${selectedWhole ? "selected" : ""} ${soldWhole ? "unavailable" : ""}`} style={{ left: `${object.x}%`, top: `${object.y}%`, width: object.width, height: object.height, transform: `translate(-50%, -50%) rotate(${object.rotation}deg)`, zIndex: object.objectType === "ZONE" ? 1 : 2 }}>
            {!isSellable ? <div className={`buyer-decoration decoration-${object.objectType.toLowerCase()}`}><strong>{object.label}</strong></div> : <>
            <button type="button" className="object-core" disabled={soldWhole || object.priceMode === "PER_SEAT" || allocation?.type === "TABLE"} onClick={() => { setSelectedSeatIds([]); setWholeObjectId(selectedWhole ? null : object.id); setCategoryId(object.categoryId ?? categoryId); }}><strong>{object.label}</strong><small>{object.objectType === "SOFA" ? text.sofa : object.objectType === "ROW" ? text.row : text.table}</small></button>
            <span className="buyer-seat-ring">{object.seatItems.map((seat) => <button type="button" key={seat.id} title={seat.status === "AVAILABLE" ? seat.label : text.unavailable} disabled={object.priceMode === "WHOLE_TABLE" || seat.status !== "AVAILABLE" || !seat.categoryId || allocation?.type === "TABLE"} className={`map-seat ${selectedSeatIds.includes(seat.id) ? "selected" : ""} ${seat.status.toLowerCase()}`} style={{ "--ticket-color": categories.find((item) => item.id === seat.categoryId)?.colorHex ?? "#CBD5E1" } as React.CSSProperties} onClick={() => chooseSeat(object, seat)}>{seat.position}</button>)}</span>
            <small className="object-price">{object.priceMode === "WHOLE_TABLE" ? `${money(buyerPrice(allocation?.type === "TABLE" && allocation.customPriceMinor !== null ? allocation.customPriceMinor : categories.find((item) => item.id === object.categoryId)?.priceMinor ?? 0),"ILS",locale)} ${text.whole}` : object.seatItems.some((seat) => seat.categoryId) ? text.perSeat : text.unassigned}</small>
            </>}
          </div>;
        })}
      </div>
      {selectedSeatIds.length > 0 && <div className="seat-selection-summary"><span>{text.selected}</span><strong>{selectedSeatIds.length}</strong></div>}
    </>}

    {!selectionObject && <div className="field" style={{ marginTop: 16 }}><label>{common.quantity}</label><select value={qty} onChange={(event) => setQty(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((number) => <option key={number}>{number}</option>)}</select></div>}
    <div className="row between" style={{ marginTop: 20 }}><div><small className="muted">{common.total}</small><br /><strong style={{ fontSize: 24 }}>{money(buyerTotal,"ILS",locale)}</strong></div><button className="btn" disabled={Boolean(seatObject) && selectedSeatIds.length === 0} onClick={go}>{common.continue}</button></div>
  </div>;
}
