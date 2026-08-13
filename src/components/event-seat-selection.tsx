"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Menu, Minus, Plus, RotateCcw, UsersRound, X } from "lucide-react";
import { money } from "@/lib/format";
import { calculateServiceFee, type ServiceFeeTerms } from "@/lib/service-fee";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import type { TicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { useLocale } from "@/components/locale-provider";
import styles from "./event-seat-selection.module.css";
import polish from "./event-seat-selection-polish.module.css";

type Category = {
  id: string;
  name: string;
  priceMinor: number;
  colorHex: string;
  capacity: number;
  sold: number;
  pricingPresentation: { stageLabel: string };
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy: TicketSalesStrategy;
};

type MapSeat = {
  id: string;
  label: string;
  position: number;
  status: "AVAILABLE" | "RESERVED" | "BLOCKED";
  categoryId: string | null;
};

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
  seatItems: MapSeat[];
};

type Allocation = {
  type: "EVENT" | "CATEGORY" | "TABLE";
  categoryId: string | null;
  tableId: string | null;
  customPriceMinor: number | null;
};

type OfferFilter = "ALL" | "BUY_ONE_GET_ONE";
type SeatStyle = React.CSSProperties & { "--seat-color": string };
type HoveredSeat = { object: MapObject; seat: MapSeat; x: number; y: number } | null;

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const DEFAULT_ZOOM = 75;
const PRICE_SLIDER_RESOLUTION = 1000;
const seatTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

function isInternalObject(object: MapObject) {
  return object.label.startsWith("__ATLAS_") || object.label.startsWith("READING_V3_");
}

function readableEventTitle(value: string) {
  return value.split(/\s+/).map((word) => {
    if (word.length <= 2 || word !== word.toLocaleUpperCase()) return word;
    return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`;
  }).join(" ");
}

function tableSeatPosition(item: MapObject, index: number): React.CSSProperties {
  const position = index + 1;
  const horizontal = item.width >= item.height;
  if (item.seats === 2) return horizontal
    ? { left: position === 1 ? "12%" : "88%", top: "50%" }
    : { left: "50%", top: position === 1 ? "12%" : "88%" };
  if (item.seats === 6 && horizontal) {
    const top = index < 3;
    return { left: `${[18, 50, 82][index % 3]}%`, top: top ? "14%" : "86%" };
  }
  if (item.seats === 8 && !horizontal) {
    const left = index < 4;
    return { left: left ? "15%" : "85%", top: `${[14, 38, 62, 86][index % 4]}%` };
  }
  const half = Math.ceil(item.seats / 2);
  const first = index < half;
  const slot = first ? index : index - half;
  const count = first ? half : Math.floor(item.seats / 2);
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  return horizontal ? { left: offset, top: first ? "14%" : "86%" } : { left: first ? "15%" : "85%", top: offset };
}

function seatSequences(object: MapObject): MapSeat[][] {
  const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
  if (object.objectType === "TABLE") {
    const horizontal = object.width >= object.height;
    if (object.seats === 6 && horizontal) return [seats.slice(0, 3), seats.slice(3, 6)];
    if (object.seats === 8 && !horizontal) return [seats.slice(0, 4), seats.slice(4, 8)];
    if (object.seats === 2) return [seats];
  }
  return [seats];
}

function validGroups(object: MapObject, quantity: number, seatAllowed: (seat: MapSeat) => boolean) {
  if (object.priceMode !== "PER_SEAT" || quantity < 1) return [] as string[][];
  const output: string[][] = [];
  if (object.objectType === "ROUND_TABLE") {
    const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
    if (quantity > seats.length) return output;
    for (let start = 0; start < seats.length; start += 1) {
      const group = Array.from({ length: quantity }, (_, offset) => seats[(start + offset) % seats.length]);
      if (new Set(group.map(item => item.id)).size === quantity && group.every(seatAllowed)) output.push(group.map(item => item.id));
    }
    return output;
  }
  for (const sequence of seatSequences(object)) {
    if (quantity > sequence.length) continue;
    for (let start = 0; start <= sequence.length - quantity; start += 1) {
      const group = sequence.slice(start, start + quantity);
      const first = group[0]?.position ?? 0;
      if (group.every((seat, index) => seat.position === first + index && seatAllowed(seat))) output.push(group.map(item => item.id));
    }
  }
  return output;
}

function SeatDot({ seat, object, color, selected, eligible, disabled, onClick, onHover, onLeave }: {
  seat: MapSeat;
  object: MapObject;
  color: string;
  selected: boolean;
  eligible: boolean;
  disabled: boolean;
  onClick: () => void;
  onHover: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const style = object.objectType === "TABLE"
    ? tableSeatPosition(object, seat.position - 1)
    : object.objectType === "ROUND_TABLE"
      ? (() => {
          const angle = (seat.position - 1) / Math.max(1, object.seats) * Math.PI * 2 - Math.PI / 2;
          return { left: `${50 + Math.cos(angle) * 39}%`, top: `${50 + Math.sin(angle) * 39}%` };
        })()
      : undefined;
  const seatStyle: SeatStyle = { ...style, "--seat-color": color };
  return <button
    type="button"
    aria-label={seat.label}
    className={`${styles.seat} ${selected ? styles.selected : ""} ${!eligible ? styles.filtered : ""}`}
    style={seatStyle}
    disabled={disabled}
    onMouseEnter={onHover}
    onMouseMove={onHover}
    onMouseLeave={onLeave}
    onClick={(event) => { event.stopPropagation(); onClick(); }}
  ><span>{seat.position}</span></button>;
}

export function EventSeatSelection({ eventId, slug, title, posterUrl, venueName, categories, objects, feeTerms, referralCode, allocation, initialQty }: {
  eventId: string;
  slug: string;
  title: string;
  posterUrl: string;
  venueName: string;
  categories: Category[];
  objects: MapObject[];
  feeTerms: ServiceFeeTerms;
  referralCode?: string;
  allocation?: Allocation;
  initialQty: number;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const viewportRef = useRef<HTMLDivElement>(null);
  const priceTrackRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ pointerId: -1, x: 0, y: 0, left: 0, top: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [draftQty, setDraftQty] = useState(Math.max(1, Math.min(8, initialQty)));
  const [hoveredSeat, setHoveredSeat] = useState<HoveredSeat>(null);

  const local = {
    ru: {
      back: "Вернуться к мероприятию", offers: "Предложения", all: "Все билеты", onePlusOne: "1 + 1",
      people: "Количество гостей", peopleHint: "Покажем только места, где вся группа сможет сидеть рядом", tickets: "билетов",
      confirm: "Подтвердить", selected: "Выбрано", continue: "Перейти к оплате", emptyCheckout: "Выберите билет", price: "Цена", feeIncluded: "включая сервисный сбор", noSeats: "В выбранном диапазоне нет подходящих мест рядом",
      zoomReset: "Сбросить масштаб", row: "Ряд", seat: "место", seats: "места", table: "Стол", zone: "Зона", section: "Категория"
    },
    en: {
      back: "Back to event", offers: "Offers", all: "All tickets", onePlusOne: "1 + 1",
      people: "Guests", peopleHint: "We only show places where the whole group can sit together", tickets: "tickets",
      confirm: "Confirm", selected: "Selected", continue: "Go to checkout", emptyCheckout: "Select a ticket", price: "Price", feeIncluded: "incl. service fee", noSeats: "No adjacent seats match this price range",
      zoomReset: "Reset zoom", row: "Row", seat: "seat", seats: "seats", table: "Table", zone: "Zone", section: "Category"
    },
    he: {
      back: "חזרה לאירוע", offers: "הצעות", all: "כל הכרטיסים", onePlusOne: "1 + 1",
      people: "מספר אורחים", peopleHint: "נציג רק מקומות שבהם כל הקבוצה יכולה לשבת יחד", tickets: "כרטיסים",
      confirm: "אישור", selected: "נבחרו", continue: "המשך לתשלום", emptyCheckout: "בחרו כרטיס", price: "מחיר", feeIncluded: "כולל דמי שירות", noSeats: "אין מקומות צמודים בטווח המחירים שנבחר",
      zoomReset: "איפוס זום", row: "שורה", seat: "מקום", seats: "מקומות", table: "שולחן", zone: "אזור", section: "קטגוריה"
    },
  }[locale];

  useEffect(() => {
    document.body.classList.add("atlas-seat-selection-active");
    return () => document.body.classList.remove("atlas-seat-selection-active");
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,select,textarea,button,a")) return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const availableObjects = (allocation?.type === "TABLE" ? objects.filter(item => item.id === allocation.tableId || !seatTypes.has(item.objectType)) : objects).filter(item => !isInternalObject(item));
  const assignedCategoryIds = useMemo(() => new Set(availableObjects.flatMap(object => [object.categoryId, ...object.seatItems.map(seat => seat.categoryId)].filter((id): id is string => Boolean(id)))), [availableObjects]);
  const availableCategories = (allocation?.type === "CATEGORY" ? categories.filter(item => item.id === allocation.categoryId) : categories).filter(item => assignedCategoryIds.has(item.id));
  const categoryPrice = useMemo(() => new Map(availableCategories.map(item => [item.id, item.priceMinor])), [availableCategories]);
  const sortedPrices = useMemo(() => [...new Set(availableCategories.map(item => categoryPrice.get(item.id) ?? 0))].sort((a, b) => a - b), [availableCategories, categoryPrice]);

  const [minIndex, setMinIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(Math.max(0, sortedPrices.length - 1));
  const [minSliderValue, setMinSliderValue] = useState(0);
  const [maxSliderValue, setMaxSliderValue] = useState(PRICE_SLIDER_RESOLUTION);
  const [qty, setQty] = useState(Math.max(1, Math.min(8, initialQty)));
  const [offer, setOffer] = useState<OfferFilter>("ALL");
  const [offerOpen, setOfferOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [wholeObjectId, setWholeObjectId] = useState<string | null>(allocation?.type === "TABLE" ? allocation.tableId : null);
  const [zoneObjectId, setZoneObjectId] = useState<string | null>(null);

  useEffect(() => {
    const lastIndex = Math.max(0, sortedPrices.length - 1);
    const onlyStop = sortedPrices.length <= 1 ? PRICE_SLIDER_RESOLUTION / 2 : PRICE_SLIDER_RESOLUTION;
    setMinIndex(0);
    setMaxIndex(lastIndex);
    setMinSliderValue(sortedPrices.length <= 1 ? onlyStop : 0);
    setMaxSliderValue(onlyStop);
  }, [sortedPrices.length]);

  const hasOnePlusOne = availableCategories.some(item => item.salesStrategy === "BUY_ONE_GET_ONE");
  const sliderValueForIndex = (index: number) => sortedPrices.length <= 1
    ? PRICE_SLIDER_RESOLUTION / 2
    : Math.round(index / (sortedPrices.length - 1) * PRICE_SLIDER_RESOLUTION);
  const indexForSliderValue = (value: number) => sortedPrices.length <= 1
    ? 0
    : Math.round(value / PRICE_SLIDER_RESOLUTION * (sortedPrices.length - 1));
  const minPrice = sortedPrices[minIndex] ?? 0;
  const maxPrice = sortedPrices[maxIndex] ?? minPrice;
  const minCategory = availableCategories.find(item => (categoryPrice.get(item.id) ?? 0) === minPrice);
  const maxCategory = availableCategories.find(item => (categoryPrice.get(item.id) ?? 0) === maxPrice);
  const allowedCategoryIds = useMemo(() => new Set(
    availableCategories
      .filter(item => item.salesStrategy === offer || offer === "ALL")
      .filter(item => { const price = categoryPrice.get(item.id) ?? -1; return price >= minPrice && price <= maxPrice; })
      .map(item => item.id)
  ), [availableCategories, offer, categoryPrice, minPrice, maxPrice]);

  const groupsByObject = useMemo(() => {
    const map = new Map<string, string[][]>();
    for (const object of availableObjects) {
      if (!seatTypes.has(object.objectType) || object.reserved) continue;
      const groups = validGroups(object, qty, (seat) => {
        const categoryId = seat.categoryId ?? object.categoryId;
        return seat.status === "AVAILABLE" && Boolean(categoryId && allowedCategoryIds.has(categoryId));
      });
      if (groups.length) map.set(object.id, groups);
    }
    return map;
  }, [availableObjects, qty, allowedCategoryIds]);

  const eligibleSeatIds = useMemo(() => new Set([...groupsByObject.values()].flat(2)), [groupsByObject]);
  const selectedSeats = objects.flatMap(item => item.seatItems).filter(seat => selectedSeatIds.includes(seat.id));
  const wholeObject = objects.find(item => item.id === wholeObjectId);
  const zoneObject = objects.find(item => item.id === zoneObjectId);
  const selectedObject = wholeObject ?? zoneObject ?? objects.find(item => item.seatItems.some(seat => selectedSeatIds.includes(seat.id)));
  const selectionComplete = Boolean(wholeObject) || Boolean(zoneObject) || selectedSeatIds.length === qty;

  const rawSubtotal = zoneObject
    ? (categories.find(item => item.id === zoneObject.categoryId)?.priceMinor ?? zoneObject.priceMinor) * qty
    : wholeObject
      ? (allocation?.type === "TABLE" && allocation.customPriceMinor !== null
          ? allocation.customPriceMinor
          : (categories.find(item => item.id === wholeObject.categoryId)?.priceMinor ?? wholeObject.priceMinor))
      : selectedSeats.reduce((sum, seat) => sum + (categories.find(item => item.id === seat.categoryId)?.priceMinor ?? 0), 0);
  const feeBreakdown = calculateServiceFee(rawSubtotal, feeTerms);
  const currentTotal = feeBreakdown.buyerTotalMinor;
  const includedBuyerFee = feeTerms.serviceFeePayer === "BUYER" ? feeBreakdown.serviceFeeMinor : 0;
  const scale = zoom / 100;
  const displayTitle = readableEventTitle(title);

  function clearSelection() {
    if (allocation?.type === "TABLE") return;
    setSelectedSeatIds([]);
    setWholeObjectId(null);
    setZoneObjectId(null);
  }

  function removeSelection() {
    setSelectedSeatIds([]);
    setWholeObjectId(null);
    setZoneObjectId(null);
  }

  function confirmPeople() {
    setQty(Math.max(1, Math.min(8, draftQty)));
    setPeopleOpen(false);
    clearSelection();
  }

  function chooseOffer(next: OfferFilter) {
    setOffer(next);
    setOfferOpen(false);
    if (next === "BUY_ONE_GET_ONE") setQty(value => value < 2 ? 2 : value % 2 === 0 ? value : Math.min(8, value + 1));
    clearSelection();
  }

  function chooseSeat(object: MapObject, seat: MapSeat) {
    if (!eligibleSeatIds.has(seat.id) || seat.status !== "AVAILABLE") return;
    setWholeObjectId(null);
    setZoneObjectId(null);
    setSelectedSeatIds(current => {
      if (current.includes(seat.id)) return current.filter(id => id !== seat.id);
      const sameObject = current.every(id => object.seatItems.some(item => item.id === id));
      const base = sameObject ? current : [];
      const candidate = [...base, seat.id];
      if (candidate.length > qty) return base;
      const possible = (groupsByObject.get(object.id) ?? []).some(group => candidate.every(id => group.includes(id)));
      return possible ? candidate : base.length ? base : [seat.id];
    });
  }

  function chooseZone(object: MapObject) {
    if (object.objectType !== "ZONE" || !object.categoryId || !allowedCategoryIds.has(object.categoryId)) return;
    setSelectedSeatIds([]);
    setWholeObjectId(null);
    setZoneObjectId(current => current === object.id ? null : object.id);
  }

  function go() {
    if (!selectionComplete) return;
    const categoryId = zoneObject?.categoryId ?? wholeObject?.categoryId ?? selectedSeats.find(seat => seat.categoryId)?.categoryId;
    if (!categoryId) return;
    const quantity = zoneObject ? qty : wholeObject ? wholeObject.seats : selectedSeatIds.length;
    const query = new URLSearchParams({ eventId, categoryId, quantity: String(quantity), locale });
    if (wholeObject) query.set("tableId", wholeObject.id);
    if (selectedSeatIds.length) query.set("seatIds", selectedSeatIds.join(","));
    if (referralCode) query.set("ref", referralCode);
    router.push(`/checkout?${query}`);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!spaceHeld && target.closest('button,input,select,a,[data-seatmap-selectable="true"]')) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
    setPanning(true);
    event.preventDefault();
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    if (!panning || panRef.current.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
    viewport.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    panRef.current.pointerId = -1;
    setPanning(false);
  }

  function categoryFor(object: MapObject, seat?: MapSeat) {
    const categoryId = seat?.categoryId ?? object.categoryId;
    return categories.find(item => item.id === categoryId);
  }

  function objectDescription(object: MapObject, seats: MapSeat[]) {
    const sorted = [...seats].sort((a, b) => a.position - b.position);
    if (object.objectType === "ROW") {
      if (sorted.length <= 1) return `${local.row} ${object.label}, ${local.seat} ${sorted[0]?.position ?? ""}`;
      return `${local.row} ${object.label}, ${local.seats} ${sorted[0].position}-${sorted[sorted.length - 1].position}`;
    }
    if (object.objectType === "TABLE" || object.objectType === "ROUND_TABLE") {
      if (!sorted.length) return `${local.table} ${object.label}`;
      if (sorted.length === 1) return `${local.table} ${object.label}, ${local.seat} ${sorted[0].position}`;
      return `${local.table} ${object.label}, ${local.seats} ${sorted[0].position}-${sorted[sorted.length - 1].position}`;
    }
    if (object.objectType === "ZONE") return `${local.zone}: ${object.label}`;
    if (!sorted.length) return object.label;
    return `${object.label}, ${local.seat} ${sorted[0].position}`;
  }

  const activeLeft = minSliderValue / PRICE_SLIDER_RESOLUTION * 100;
  const activeWidth = (maxSliderValue - minSliderValue) / PRICE_SLIDER_RESOLUTION * 100;
  function snapMinimumHandle(value = minSliderValue) {
    const index = Math.min(indexForSliderValue(value), maxIndex);
    setMinIndex(index);
    setMinSliderValue(sliderValueForIndex(index));
  }
  function snapMaximumHandle(value = maxSliderValue) {
    const index = Math.max(indexForSliderValue(value), minIndex);
    setMaxIndex(index);
    setMaxSliderValue(sliderValueForIndex(index));
  }
  function selectPriceStop(index: number) {
    const distanceToMin = Math.abs(index - minIndex);
    const distanceToMax = Math.abs(index - maxIndex);
    const moveMinimum = index <= minIndex || (index < maxIndex && distanceToMin <= distanceToMax);
    if (moveMinimum) {
      setMinIndex(Math.min(index, maxIndex));
      setMinSliderValue(sliderValueForIndex(Math.min(index, maxIndex)));
    } else {
      setMaxIndex(Math.max(index, minIndex));
      setMaxSliderValue(sliderValueForIndex(Math.max(index, minIndex)));
    }
    clearSelection();
  }
  function selectNearestPrice(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("input")) return;
    const track = priceTrackRef.current;
    if (!track || sortedPrices.length === 0) return;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    selectPriceStop(Math.round(ratio * Math.max(0, sortedPrices.length - 1)));
  }
  const backHref = `/events/${slug}${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ""}`;
  const selectionCategory = selectedObject ? categoryFor(selectedObject, selectedSeats[0]) : undefined;
  const selectionDescription = selectedObject ? objectDescription(selectedObject, selectedSeats) : "";
  const selectionQuantity = zoneObject ? qty : wholeObject ? wholeObject.seats : selectedSeatIds.length;
  const selectionTitle = selectedObject ? `${selectionCategory?.name ?? selectedObject.label}${selectionQuantity > 1 ? ` × ${selectionQuantity}` : ""}` : "";

  return <main className={styles.page}>
    <style jsx>{`
      @keyframes atlasCheckoutFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .atlas-selected-ticket {
        position: relative;
        padding: 18px 2px 20px;
        border-top: 1px solid #e5e7eb;
      }
      .atlas-selected-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: start;
        gap: 12px;
      }
      .atlas-selected-title {
        margin: 0;
        color: #0b1220;
        font-family: "Roboto Flex", Inter, Arial, sans-serif;
        font-size: 21px;
        line-height: 1.08;
        font-weight: 760;
        letter-spacing: -0.02em;
      }
      .atlas-selected-desc {
        display: block;
        margin-top: 9px;
        color: #26384d;
        font-family: Inter, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.35;
        font-weight: 500;
      }
      .atlas-selected-price {
        text-align: right;
        white-space: nowrap;
        color: #0b1220;
        font-family: Inter, Arial, sans-serif;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 800;
      }
      .atlas-selected-fee {
        display: block;
        margin-top: 4px;
        color: #8a94a3;
        font-family: Inter, Arial, sans-serif;
        font-size: 11px;
        line-height: 1.25;
        font-weight: 450;
      }
      .atlas-remove-ticket {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: 1px solid #d8dde5;
        border-radius: 50%;
        background: #fff;
        color: #6b7280;
        cursor: pointer;
        transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease;
      }
      .atlas-remove-ticket:hover {
        background: #f7f8fa;
        border-color: #c8ced7;
        color: #111827;
        transform: scale(1.04);
      }
      .atlas-checkout-button {
        width: 100%;
        min-height: 52px;
        margin-top: auto;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(105deg, #ff7818 0%, #ff315f 34%, #ff087e 60%, #a72de5 100%);
        background-size: 220% 220%;
        animation: atlasCheckoutFlow 7s ease-in-out infinite;
        color: #fff;
        font-family: Inter, Arial, sans-serif;
        font-size: 16px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: -0.01em;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(255, 38, 112, .18);
        transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
      }
      .atlas-checkout-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 13px 30px rgba(255, 38, 112, .25);
      }
      .atlas-checkout-button:disabled {
        animation: none;
        background: #d7dce2;
        color: #8993a0;
        box-shadow: none;
        cursor: not-allowed;
      }
      @media (max-width: 900px) {
        .atlas-selected-ticket { padding: 10px 0 12px; }
        .atlas-selected-title { font-size: 17px; }
        .atlas-selected-desc { margin-top: 5px; font-size: 12.5px; }
        .atlas-selected-price { font-size: 16px; }
        .atlas-selected-fee { font-size: 10px; }
        .atlas-remove-ticket { width: 25px; height: 25px; }
        .atlas-checkout-button { min-height: 44px; font-size: 14px; }
      }
    `}</style>
    <Link className={`${styles.headerBack} ${polish.headerBack}`} href={backHref}><ArrowLeft size={18}/><span>{local.back}</span></Link>
    <div className={styles.layout}>
      <section className={styles.mapSide}>
        <div className={styles.priceRail} onClick={selectNearestPrice}>
          <div className={styles.priceStops}>
            {sortedPrices.map((price, index) => {
              const category = availableCategories.find(item => (categoryPrice.get(item.id) ?? 0) === price);
              const active = index >= minIndex && index <= maxIndex;
              const stopPosition = sortedPrices.length <= 1 ? 50 : index / (sortedPrices.length - 1) * 100;
              return <button type="button" key={`${price}-${index}`} className={active ? styles.priceActive : ""} style={{ left: `${stopPosition}%` }} onClick={event => { event.stopPropagation(); selectPriceStop(index); }}><b style={{ color: category?.colorHex ?? "#64748b" }}>{money(price, "ILS", locale)}</b></button>;
            })}
          </div>
          <div className={styles.rangeWrap}>
            <div className={styles.rangeTrack} ref={priceTrackRef}>
              <div className={styles.rangeBase}/><div className={styles.rangeActive} style={{ left: `${activeLeft}%`, width: `${activeWidth}%` }}/>
              <input aria-label="minimum ticket price" className={styles.range} style={{ "--range-thumb-color": minCategory?.colorHex ?? "#168bf2" } as React.CSSProperties} type="range" min="0" max={PRICE_SLIDER_RESOLUTION} step="1" value={minSliderValue} onChange={event => { const value = Math.min(Number(event.target.value), maxSliderValue); const nextIndex = Math.min(indexForSliderValue(value), maxIndex); setMinSliderValue(value); if (nextIndex !== minIndex) { setMinIndex(nextIndex); clearSelection(); } }} onPointerUp={event => snapMinimumHandle(Number(event.currentTarget.value))} onPointerCancel={event => snapMinimumHandle(Number(event.currentTarget.value))} onKeyUp={event => snapMinimumHandle(Number(event.currentTarget.value))} onBlur={event => snapMinimumHandle(Number(event.currentTarget.value))}/>
              <input aria-label="maximum ticket price" className={`${styles.range} ${styles.rangeMax}`} style={{ "--range-thumb-color": maxCategory?.colorHex ?? "#a35df0" } as React.CSSProperties} type="range" min="0" max={PRICE_SLIDER_RESOLUTION} step="1" value={maxSliderValue} onChange={event => { const value = Math.max(Number(event.target.value), minSliderValue); const nextIndex = Math.max(indexForSliderValue(value), minIndex); setMaxSliderValue(value); if (nextIndex !== maxIndex) { setMaxIndex(nextIndex); clearSelection(); } }} onPointerUp={event => snapMaximumHandle(Number(event.currentTarget.value))} onPointerCancel={event => snapMaximumHandle(Number(event.currentTarget.value))} onKeyUp={event => snapMaximumHandle(Number(event.currentTarget.value))} onBlur={event => snapMaximumHandle(Number(event.currentTarget.value))}/>
              <span className={styles.visualHandle} style={{ left: `${minSliderValue / PRICE_SLIDER_RESOLUTION * 100}%`, backgroundColor: minCategory?.colorHex ?? "#168bf2" }}/>
              <span className={`${styles.visualHandle} ${styles.visualHandleMax}`} style={{ left: `${maxSliderValue / PRICE_SLIDER_RESOLUTION * 100}%`, backgroundColor: maxCategory?.colorHex ?? "#a35df0" }}/>
            </div>
          </div>
        </div>

        <div ref={viewportRef} className={`${styles.mapViewport} ${spaceHeld ? styles.panReady : ""} ${panning ? styles.panning : ""}`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
          <div className={styles.zoom}>
            <button type="button" onClick={() => setZoom(value => Math.min(125, value + 10))}><Plus size={20}/></button>
            <button type="button" title={local.zoomReset} onClick={() => setZoom(DEFAULT_ZOOM)}><RotateCcw size={18}/></button>
            <button type="button" onClick={() => setZoom(value => Math.max(35, value - 10))}><Minus size={20}/></button>
          </div>
          <div className={styles.mapFrame} style={{ width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale }}>
            <div className={styles.world} style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `scale(${scale})` }}>
              {availableObjects.map(object => {
                const seatObject = seatTypes.has(object.objectType);
                const zone = object.objectType === "ZONE";
                const categoryAllowed = Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId));
                const wholeVisible = object.priceMode !== "WHOLE_TABLE" || Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId) && !object.reserved);
                const selectedWhole = wholeObjectId === object.id;
                const selectedZone = zoneObjectId === object.id;
                const faded = (seatObject && !wholeVisible) || (zone && !categoryAllowed);
                const zoneColor = zone && categoryAllowed ? categories.find(item => item.id === object.categoryId)?.colorHex : undefined;
                return <div key={object.id} className={`${styles.object} ${zone ? styles.zoneLayer : ""} ${faded ? styles.filteredObject : ""}`} style={{ left: `${object.x}%`, top: `${object.y}%`, width: object.width, height: object.height, transform: `translate(-50%,-50%) rotate(${object.rotation}deg)` }}>
                  {!seatObject
                    ? <div data-seatmap-selectable="true" className={`${styles.decoration} ${styles[`decoration${object.objectType}`] ?? ""} ${selectedZone ? styles.zoneSelected : ""}`} style={zoneColor ? { background: zoneColor, borderColor: zoneColor, color: "#fff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" } : undefined} onClick={(event) => { event.stopPropagation(); chooseZone(object); }}><strong>{object.label}</strong></div>
                    : <div data-seatmap-selectable="true" className={`${styles.furniture} ${styles[`furniture${object.objectType}`] ?? ""}`} onClick={(event) => {
                        event.stopPropagation();
                        if (object.priceMode !== "WHOLE_TABLE" || object.reserved || !wholeVisible) return;
                        setSelectedSeatIds([]);
                        setZoneObjectId(null);
                        setWholeObjectId(selectedWhole ? null : object.id);
                      }}>
                        <div className={`${styles.core} ${selectedWhole ? styles.coreSelected : ""}`}><strong>{object.label}</strong></div>
                        {object.objectType === "ROW"
                          ? <div className={styles.rowSeats}>{object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={selectedSeatIds.includes(seat.id)} eligible={eligible} disabled={object.priceMode === "WHOLE_TABLE" || !eligible} onClick={() => chooseSeat(object, seat)} onHover={event => setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}</div>
                          : object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={selectedSeatIds.includes(seat.id)} eligible={eligible} disabled={object.priceMode === "WHOLE_TABLE" || !eligible} onClick={() => chooseSeat(object, seat)} onHover={event => setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}
                      </div>}
                </div>;
              })}
            </div>
          </div>
          {eligibleSeatIds.size === 0 && !wholeObject && !zoneObject && <div className={styles.noSeats}>{local.noSeats}</div>}
        </div>
      </section>

      <aside className={`${styles.sidebar} ${polish.sidebar}`}>
        <div className={`${styles.eventInfo} ${polish.eventInfo}`}>
          <img className={polish.poster} src={posterUrl} alt=""/>
          <div className={`${styles.eventDetails} ${polish.eventDetails}`}>
            <h1 className={polish.title}>{displayTitle}</h1>
            <div className={`${styles.eventPills} ${polish.eventPills}`}>
              <div className={styles.offerWrap}>
                <button type="button" className={`${styles.offerButton} ${polish.pill}`} onClick={() => { setOfferOpen(value => !value); setPeopleOpen(false); }}><Menu size={17}/><span>{offer === "ALL" ? local.offers : local.onePlusOne}</span><ChevronDown size={15}/></button>
                {offerOpen && <div className={styles.offerMenu}><button type="button" className={offer === "ALL" ? styles.offerSelected : ""} onClick={() => chooseOffer("ALL")}>{local.all}</button>{hasOnePlusOne && <button type="button" className={offer === "BUY_ONE_GET_ONE" ? styles.offerSelected : ""} onClick={() => chooseOffer("BUY_ONE_GET_ONE")}>{local.onePlusOne}</button>}</div>}
              </div>
              <div className={styles.peopleWrap}>
                <button type="button" className={`${styles.peopleButton} ${polish.peopleButton}`} onClick={() => { setDraftQty(qty); setPeopleOpen(true); setOfferOpen(false); }}><UsersRound size={17}/><strong>{qty}</strong><ChevronDown size={15}/></button>
              </div>
            </div>
          </div>
        </div>

        {selectedObject && <div className="atlas-selected-ticket">
          <div className="atlas-selected-head">
            <div>
              <h2 className="atlas-selected-title">{selectionTitle}</h2>
              <span className="atlas-selected-desc">{selectionDescription}</span>
            </div>
            <div className="atlas-selected-price">
              {money(currentTotal, "ILS", locale)}
              {includedBuyerFee > 0 && <span className="atlas-selected-fee">{local.feeIncluded} {money(includedBuyerFee, "ILS", locale)}</span>}
            </div>
            <button type="button" className="atlas-remove-ticket" aria-label="Remove selected ticket" onClick={removeSelection}><X size={15}/></button>
          </div>
          {!selectionComplete && <small style={{ display: "block", marginTop: 9, color: "#64748b", lineHeight: 1.4 }}>{selectedSeatIds.length} / {qty}</small>}
        </div>}

        <button type="button" className="atlas-checkout-button" disabled={!selectionComplete} onClick={go}>
          {selectionComplete ? <>{local.continue} <span aria-hidden="true">→</span> {money(currentTotal, "ILS", locale)}</> : local.emptyCheckout}
        </button>
      </aside>
    </div>

    {hoveredSeat && (() => {
      const hoverCategory = categoryFor(hoveredSeat.object, hoveredSeat.seat);
      const hoverPrice = hoverCategory?.priceMinor ?? 0;
      const left = Math.min(window.innerWidth - 290, hoveredSeat.x + 16);
      const top = Math.max(12, hoveredSeat.y - 82);
      return <div style={{ position: "fixed", zIndex: 20000, left, top, width: 270, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "13px 15px", boxShadow: "0 10px 30px rgba(15,23,42,.16)", pointerEvents: "none", fontFamily: "inherit" }}>
        <span style={{ display: "block", color: "#64748b", fontSize: 12, marginBottom: 5 }}>{hoverCategory?.name ?? venueName}</span>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "baseline" }}>
          <strong style={{ fontSize: 14, lineHeight: 1.35 }}>{objectDescription(hoveredSeat.object, [hoveredSeat.seat])}</strong>
          <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>{money(hoverPrice, "ILS", locale)}</strong>
        </div>
      </div>;
    })()}

    {peopleOpen && <div className={polish.modalBackdrop} role="presentation" onMouseDown={() => setPeopleOpen(false)}>
      <div className={polish.quantityModal} role="dialog" aria-modal="true" aria-label={local.people} onMouseDown={event => event.stopPropagation()}>
        <div className={polish.modalHeader}>
          <h2>{local.people}</h2>
          <button type="button" className={polish.closeButton} onClick={() => setPeopleOpen(false)} aria-label="Close"><X size={20}/></button>
        </div>
        <p style={{ margin: "-8px 36px 18px", textAlign: "center", color: "#6b7280", fontSize: 12.5, lineHeight: 1.45 }}>{local.peopleHint}</p>
        <div className={polish.quantityControl}>
          <button type="button" onClick={() => setDraftQty(value => Math.max(1, value - 1))} disabled={draftQty <= 1}><Minus size={22}/></button>
          <strong>{draftQty} {local.tickets}</strong>
          <button type="button" onClick={() => setDraftQty(value => Math.min(8, value + 1))} disabled={draftQty >= 8}><Plus size={22}/></button>
        </div>
        <button type="button" className={polish.confirmButton} onClick={confirmPeople}>{local.confirm}</button>
      </div>
    </div>}
  </main>;
}
