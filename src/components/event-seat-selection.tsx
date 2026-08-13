"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Minus, Plus, RotateCcw, UsersRound, X } from "lucide-react";
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
  minPerOrder: number;
  maxPerOrder: number;
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
  maxPerOrder: number;
};

type SeatStyle = React.CSSProperties & { "--seat-color": string };
type HoveredSeat = { object: MapObject; seat: MapSeat; x: number; y: number } | null;
type CartItem = {
  id: string;
  kind: "SEATS" | "ZONE" | "WHOLE_TABLE";
  categoryId: string;
  quantity: number;
  objectId: string;
  seatIds: string[];
  title: string;
  description: string;
  subtotalMinor: number;
};

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

function seatPoint(object: MapObject, seat: MapSeat) {
  const index = Math.max(0, object.seatItems.findIndex(item => item.id === seat.id));
  if (object.objectType === "ROUND_TABLE") {
    const angle = index / Math.max(1, object.seats) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * 39, y: 50 + Math.sin(angle) * 39 };
  }
  if (object.objectType === "ROW") return { x: ((index + .5) / Math.max(1, object.seatItems.length)) * 100, y: 50 };
  const position = tableSeatPosition(object, index) as { left?: string | number; top?: string | number };
  return { x: Number.parseFloat(String(position.left ?? 50)), y: Number.parseFloat(String(position.top ?? 50)) };
}

function selectionHaloStyle(object: MapObject, seatIds: string[]): React.CSSProperties | undefined {
  const points = object.seatItems.filter(seat => seatIds.includes(seat.id)).map(seat => seatPoint(object, seat));
  if (!points.length) return undefined;
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  return {
    left: `${(minX + maxX) / 2}%`,
    top: `${(minY + maxY) / 2}%`,
    width: `max(48px, calc(${maxX - minX}% + 34px))`,
    height: `max(48px, calc(${maxY - minY}% + 34px))`,
  };
}

function seatSequences(object: MapObject): MapSeat[][] {
  const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
  if (object.objectType === "TABLE") {
    if (object.seats === 2) return [seats];
    if (seats.length >= 4 && seats.length % 2 === 0) {
      const half = seats.length / 2;
      return [seats.slice(0, half), seats.slice(half)];
    }
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
  if (object.objectType === "TABLE" && quantity === 2) {
    const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
    if (seats.length >= 4 && seats.length % 2 === 0) {
      const half = seats.length / 2;
      for (let index = 0; index < half; index += 1) {
        const pair = [seats[index], seats[index + half]];
        if (pair.every(seatAllowed)) output.push(pair.map(item => item.id));
      }
    }
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

function SeatDot({ seat, object, color, selected, priceMatched, disabled, onClick, onHover, onLeave }: {
  seat: MapSeat;
  object: MapObject;
  color: string;
  selected: boolean;
  priceMatched: boolean;
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
    className={`${styles.seat} ${selected ? styles.selected : ""} ${!priceMatched ? styles.filtered : ""}`}
    data-price-filtered={priceMatched ? undefined : "true"}
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
  const [draftQty, setDraftQty] = useState(Math.max(1, Math.min(20, initialQty)));
  const [hoveredSeat, setHoveredSeat] = useState<HoveredSeat>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");

  const local = {
    ru: {
      back: "Вернуться к мероприятию",
      people: "Количество билетов", peopleHint: "Показываем только варианты, где все выбранные места находятся рядом", close: "Закрыть",
      confirm: "Подтвердить", selected: "Выбрано", continue: "Перейти к оплате", emptyCheckout: "Выберите билет", price: "Цена", feeIncluded: "включая сервисный сбор", noSeats: "В выбранном диапазоне нет подходящих мест рядом", expandRange: "Расширьте диапазон цен", expandRangeHint: "Для выбранного количества гостей нет доступного варианта. Выберите более широкий диапазон.", applyRange: "Применить диапазон", categoryLimit: "Для категории «{name}» можно выбрать не более {count} билетов за один раз", linkLimit: "По этой ссылке можно купить не более {count} билетов в одном заказе",
      zoomReset: "Сбросить масштаб", row: "Ряд", seat: "место", seats: "места", table: "Стол", zone: "Зона", section: "Категория"
    },
    en: {
      back: "Back to event",
      people: "Ticket quantity", peopleHint: "Only options where all selected seats are together will be shown", close: "Close",
      confirm: "Confirm", selected: "Selected", continue: "Go to checkout", emptyCheckout: "Select a ticket", price: "Price", feeIncluded: "incl. service fee", noSeats: "No adjacent seats match this price range", expandRange: "Expand the price range", expandRangeHint: "No available option matches the selected group size. Choose a wider range.", applyRange: "Apply range", categoryLimit: "You can select no more than {count} tickets from “{name}” at a time", linkLimit: "This link allows no more than {count} tickets in one order",
      zoomReset: "Reset zoom", row: "Row", seat: "seat", seats: "seats", table: "Table", zone: "Zone", section: "Category"
    },
    he: {
      back: "חזרה לאירוע",
      people: "כמות כרטיסים", peopleHint: "יוצגו רק אפשרויות שבהן כל המקומות שנבחרו צמודים זה לזה", close: "סגירה",
      confirm: "אישור", selected: "נבחרו", continue: "המשך לתשלום", emptyCheckout: "בחרו כרטיס", price: "מחיר", feeIncluded: "כולל דמי שירות", noSeats: "אין מקומות צמודים בטווח המחירים שנבחר", expandRange: "הרחיבו את טווח המחירים", expandRangeHint: "אין אפשרות זמינה למספר האורחים שנבחר. בחרו טווח רחב יותר.", applyRange: "החלת הטווח", categoryLimit: "ניתן לבחור עד {count} כרטיסים מקטגוריית „{name}” בכל פעם", linkLimit: "בקישור זה ניתן לקנות עד {count} כרטיסים בהזמנה אחת",
      zoomReset: "איפוס זום", row: "שורה", seat: "מקום", seats: "מקומות", table: "שולחן", zone: "אזור", section: "קטגוריה"
    },
  }[locale];
  const ticketQuantityLabel = (value: number) => {
    if (locale === "en") return `${value} ${value === 1 ? "ticket" : "tickets"}`;
    if (locale === "he") return `${value} ${value === 1 ? "כרטיס" : "כרטיסים"}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    const noun = mod10 === 1 && mod100 !== 11 ? "билет" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "билета" : "билетов";
    return `${value} ${noun}`;
  };

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
  const [draftMinRangeIndex, setDraftMinRangeIndex] = useState(0);
  const [draftMaxRangeIndex, setDraftMaxRangeIndex] = useState(Math.max(0, sortedPrices.length - 1));
  const [qty, setQty] = useState(Math.max(1, Math.min(20, initialQty)));
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
      .filter(item => { const price = categoryPrice.get(item.id) ?? -1; return price >= minPrice && price <= maxPrice; })
      .map(item => item.id)
  ), [availableCategories, categoryPrice, minPrice, maxPrice]);

  const cartSeatIds = useMemo(() => new Set(cart.flatMap(item => item.seatIds)), [cart]);
  const seatCategoryById = useMemo(() => new Map(availableObjects.flatMap(object => object.seatItems.map(seat => [seat.id, seat.categoryId ?? object.categoryId] as const))), [availableObjects]);
  const cartCategoryQuantities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of cart) {
      if (item.seatIds.length) {
        for (const seatId of item.seatIds) {
          const categoryId = seatCategoryById.get(seatId);
          if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
        }
      } else counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + item.quantity);
    }
    return counts;
  }, [cart, seatCategoryById]);
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const quantityLimit = Math.max(1, Math.min(20, ...availableCategories.map(item => item.maxPerOrder)));

  function categoryCanAccept(categoryId: string, increment: number) {
    const category = availableCategories.find(item => item.id === categoryId);
    if (!category) return false;
    const cartTotal = cartCategoryQuantities.get(categoryId) ?? 0;
    return increment <= category.maxPerOrder && cartTotal + increment <= category.capacity - category.sold;
  }

  function additionsCanFit(additions: Map<string, number>) {
    const addedTotal = [...additions.values()].reduce((sum, value) => sum + value, 0);
    if (allocation && cartQuantity + addedTotal > allocation.maxPerOrder) return false;
    return [...additions].every(([categoryId, increment]) => categoryCanAccept(categoryId, increment));
  }

  function additionsFitLimits(additions: Map<string, number>) {
    const addedTotal = [...additions.values()].reduce((sum, value) => sum + value, 0);
    if (allocation && cartQuantity + addedTotal > allocation.maxPerOrder) {
      setCartError(local.linkLimit.replace("{count}", String(allocation.maxPerOrder)));
      return false;
    }
    for (const [categoryId, increment] of additions) {
      const category = availableCategories.find(item => item.id === categoryId);
      if (!category) return false;
      if (!categoryCanAccept(categoryId, increment)) {
        setCartError(local.categoryLimit.replace("{name}", category.name).replace("{count}", String(Math.min(category.maxPerOrder, category.capacity - category.sold))));
        return false;
      }
    }
    setCartError("");
    return true;
  }

  const groupsByObject = (() => {
    const map = new Map<string, string[][]>();
    for (const object of availableObjects) {
      if (!seatTypes.has(object.objectType) || object.reserved) continue;
      const groups = validGroups(object, qty, (seat) => {
        const categoryId = seat.categoryId ?? object.categoryId;
        return seat.status === "AVAILABLE" && !cartSeatIds.has(seat.id) && Boolean(categoryId && allowedCategoryIds.has(categoryId));
      }).filter(group => {
        const additions = new Map<string, number>();
        for (const seatId of group) {
          const categoryId = seatCategoryById.get(seatId);
          if (categoryId) additions.set(categoryId, (additions.get(categoryId) ?? 0) + 1);
        }
        return additionsCanFit(additions);
      });
      if (groups.length) map.set(object.id, groups);
    }
    return map;
  })();

  const eligibleSeatIds = new Set([...groupsByObject.values()].flat(2));
  const hasMatchingSeats = groupsByObject.size > 0;
  const hasMatchingZone = availableObjects.some(object => object.objectType === "ZONE" && Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, qty]]))));
  const hasMatchingWholeObject = availableObjects.some(object => object.priceMode === "WHOLE_TABLE" && !object.reserved && !cart.some(item => item.objectId === object.id) && Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, object.seats]]))));
  const hasMatchingPlaces = hasMatchingSeats || hasMatchingZone || hasMatchingWholeObject;
  const draftMinPrice = sortedPrices[draftMinRangeIndex] ?? 0;
  const draftMaxPrice = sortedPrices[draftMaxRangeIndex] ?? draftMinPrice;
  const draftAllowedCategoryIds = new Set(availableCategories
    .filter(item => { const price = categoryPrice.get(item.id) ?? -1; return price >= draftMinPrice && price <= draftMaxPrice; })
    .map(item => item.id));
  const draftHasSeats = availableObjects.some(object => seatTypes.has(object.objectType) && !object.reserved && validGroups(object, qty, seat => {
    const categoryId = seat.categoryId ?? object.categoryId;
    return seat.status === "AVAILABLE" && !cartSeatIds.has(seat.id) && Boolean(categoryId && draftAllowedCategoryIds.has(categoryId));
  }).some(group => {
    const additions = new Map<string, number>();
    for (const seatId of group) {
      const categoryId = seatCategoryById.get(seatId);
      if (categoryId) additions.set(categoryId, (additions.get(categoryId) ?? 0) + 1);
    }
    return additionsCanFit(additions);
  }));
  const draftHasZone = availableObjects.some(object => object.objectType === "ZONE" && Boolean(object.categoryId && draftAllowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, qty]]))));
  const draftHasWholeObject = availableObjects.some(object => object.priceMode === "WHOLE_TABLE" && !object.reserved && !cart.some(item => item.objectId === object.id) && Boolean(object.categoryId && draftAllowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, object.seats]]))));
  const canApplyDraftRange = draftHasSeats || draftHasZone || draftHasWholeObject;
  const wholeObject = objects.find(item => item.id === wholeObjectId);
  const zoneObject = objects.find(item => item.id === zoneObjectId);
  const noMatchingPlaces = !hasMatchingPlaces && !wholeObject && !zoneObject;
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotalMinor, 0);
  const cartPricing = calculateServiceFee(cartSubtotal, feeTerms);
  const cartDisplay = cart.reduce<{items:Array<CartItem & {feeMinor:number;buyerTotalMinor:number}>;allocatedFee:number}>((result, item, index) => {
    const fee = feeTerms.serviceFeePayer !== "BUYER" || cartSubtotal === 0 ? 0 : index === cart.length - 1 ? cartPricing.serviceFeeMinor - result.allocatedFee : Math.round(cartPricing.serviceFeeMinor * item.subtotalMinor / cartSubtotal);
    return {items:[...result.items,{...item,feeMinor:fee,buyerTotalMinor:item.subtotalMinor+fee}],allocatedFee:result.allocatedFee+fee};
  },{items:[],allocatedFee:0}).items;
  const scale = zoom / 100;
  const displayTitle = readableEventTitle(title);

  function clearSelection() {
    if (allocation?.type === "TABLE") return;
    setSelectedSeatIds([]);
    setWholeObjectId(null);
    setZoneObjectId(null);
  }

  function removeCartItem(id: string) {
    setCart(current => current.filter(item => item.id !== id));
    setCartError("");
  }

  function addCartItem(item: Omit<CartItem, "id">) {
    setCart(current => [...current, { ...item, id: crypto.randomUUID() }]);
  }

  function confirmPeople() {
    const nextQuantity = Math.max(1, Math.min(quantityLimit, draftQty));
    if (nextQuantity !== qty) {
      setQty(nextQuantity);
      clearSelection();
    }
    setPeopleOpen(false);
  }

  function applyDraftPriceRange() {
    if (!canApplyDraftRange) return;
    setMinIndex(draftMinRangeIndex);
    setMaxIndex(draftMaxRangeIndex);
    setMinSliderValue(sliderValueForIndex(draftMinRangeIndex));
    setMaxSliderValue(sliderValueForIndex(draftMaxRangeIndex));
    clearSelection();
  }

  function chooseSeat(object: MapObject, seat: MapSeat) {
    if (!eligibleSeatIds.has(seat.id) || seat.status !== "AVAILABLE") return;
    setWholeObjectId(null);
    setZoneObjectId(null);
    const candidates = (groupsByObject.get(object.id) ?? []).filter(group => group.includes(seat.id));
    if (!candidates.length) return;
    const clickedPosition = seat.position;
    const score = (group: string[]) => {
      const positions = object.seatItems.filter(item => group.includes(item.id)).map(item => item.position).sort((a, b) => a - b);
      return Math.abs(clickedPosition - (positions[0] + positions[positions.length - 1]) / 2);
    };
    const candidate = [...candidates].sort((left, right) => score(left) - score(right))[0];
    const seats = object.seatItems.filter(item => candidate.includes(item.id));
    const categoryId = seats.find(item => item.categoryId)?.categoryId ?? object.categoryId;
    if (!categoryId) return;
    const additions = new Map<string, number>();
    for (const item of seats) {
      const seatCategoryId = item.categoryId ?? object.categoryId;
      if (seatCategoryId) additions.set(seatCategoryId, (additions.get(seatCategoryId) ?? 0) + 1);
    }
    if (!additionsFitLimits(additions)) { setSelectedSeatIds([]); return; }
    const category = categories.find(item => item.id === categoryId);
    addCartItem({ kind: "SEATS", categoryId, quantity: seats.length, objectId: object.id, seatIds: candidate, title: `${category?.name ?? object.label} × ${seats.length}`, description: objectDescription(object, seats), subtotalMinor: seats.reduce((sum, item) => sum + (categories.find(categoryItem => categoryItem.id === (item.categoryId ?? object.categoryId))?.priceMinor ?? 0), 0) });
    setSelectedSeatIds([]);
  }

  function chooseZone(object: MapObject) {
    if (object.objectType !== "ZONE" || !object.categoryId || !allowedCategoryIds.has(object.categoryId)) return;
    if (!additionsFitLimits(new Map([[object.categoryId, qty]]))) return;
    const category = categories.find(item => item.id === object.categoryId);
    addCartItem({ kind: "ZONE", categoryId: object.categoryId, quantity: qty, objectId: object.id, seatIds: [], title: `${category?.name ?? object.label} × ${qty}`, description: objectDescription(object, []), subtotalMinor: (category?.priceMinor ?? object.priceMinor) * qty });
    clearSelection();
  }

  function chooseWholeObject(object: MapObject) {
    if (object.priceMode !== "WHOLE_TABLE" || object.reserved || !object.categoryId || !allowedCategoryIds.has(object.categoryId) || cart.some(item => item.objectId === object.id)) return;
    if (!additionsFitLimits(new Map([[object.categoryId, object.seats]]))) return;
    const category = categories.find(item => item.id === object.categoryId);
    const subtotal = allocation?.type === "TABLE" && allocation.customPriceMinor !== null ? allocation.customPriceMinor : (category?.priceMinor ?? object.priceMinor);
    addCartItem({ kind: "WHOLE_TABLE", categoryId: object.categoryId, quantity: object.seats, objectId: object.id, seatIds: [], title: `${category?.name ?? object.label} × ${object.seats}`, description: objectDescription(object, []), subtotalMinor: subtotal });
    clearSelection();
  }

  function go() {
    if (!cart.length) return;
    const query = new URLSearchParams({ eventId, locale, cart: JSON.stringify(cart.map(item => ({ categoryId: item.categoryId, quantity: item.quantity, tableId: item.kind === "WHOLE_TABLE" ? item.objectId : null, seatIds: item.seatIds }))) });
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
    setDraftMinRangeIndex(index);
  }
  function snapMaximumHandle(value = maxSliderValue) {
    const index = Math.max(indexForSliderValue(value), minIndex);
    setMaxIndex(index);
    setMaxSliderValue(sliderValueForIndex(index));
    setDraftMaxRangeIndex(index);
  }
  function selectPriceStop(index: number) {
    const distanceToMin = Math.abs(index - minIndex);
    const distanceToMax = Math.abs(index - maxIndex);
    const moveMinimum = index <= minIndex || (index < maxIndex && distanceToMin <= distanceToMax);
    if (moveMinimum) {
      setMinIndex(Math.min(index, maxIndex));
      setMinSliderValue(sliderValueForIndex(Math.min(index, maxIndex)));
      setDraftMinRangeIndex(Math.min(index, maxIndex));
    } else {
      setMaxIndex(Math.max(index, minIndex));
      setMaxSliderValue(sliderValueForIndex(Math.max(index, minIndex)));
      setDraftMaxRangeIndex(Math.max(index, minIndex));
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
          <div className={styles.priceGrid}>
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
              <input aria-label="minimum ticket price" className={styles.range} style={{ "--range-thumb-color": minCategory?.colorHex ?? "#168bf2" } as React.CSSProperties} type="range" min="0" max={PRICE_SLIDER_RESOLUTION} step="1" value={minSliderValue} onChange={event => { const value = Math.min(Number(event.target.value), maxSliderValue); const nextIndex = Math.min(indexForSliderValue(value), maxIndex); setMinSliderValue(value); setDraftMinRangeIndex(nextIndex); if (nextIndex !== minIndex) { setMinIndex(nextIndex); clearSelection(); } }} onPointerUp={event => snapMinimumHandle(Number(event.currentTarget.value))} onPointerCancel={event => snapMinimumHandle(Number(event.currentTarget.value))} onKeyUp={event => snapMinimumHandle(Number(event.currentTarget.value))} onBlur={event => snapMinimumHandle(Number(event.currentTarget.value))}/>
              <input aria-label="maximum ticket price" className={`${styles.range} ${styles.rangeMax}`} style={{ "--range-thumb-color": maxCategory?.colorHex ?? "#a35df0" } as React.CSSProperties} type="range" min="0" max={PRICE_SLIDER_RESOLUTION} step="1" value={maxSliderValue} onChange={event => { const value = Math.max(Number(event.target.value), minSliderValue); const nextIndex = Math.max(indexForSliderValue(value), minIndex); setMaxSliderValue(value); setDraftMaxRangeIndex(nextIndex); if (nextIndex !== maxIndex) { setMaxIndex(nextIndex); clearSelection(); } }} onPointerUp={event => snapMaximumHandle(Number(event.currentTarget.value))} onPointerCancel={event => snapMaximumHandle(Number(event.currentTarget.value))} onKeyUp={event => snapMaximumHandle(Number(event.currentTarget.value))} onBlur={event => snapMaximumHandle(Number(event.currentTarget.value))}/>
              <span className={styles.visualHandle} style={{ left: `${minSliderValue / PRICE_SLIDER_RESOLUTION * 100}%`, backgroundColor: minCategory?.colorHex ?? "#168bf2" }}/>
              <span className={`${styles.visualHandle} ${styles.visualHandleMax}`} style={{ left: `${maxSliderValue / PRICE_SLIDER_RESOLUTION * 100}%`, backgroundColor: maxCategory?.colorHex ?? "#a35df0" }}/>
            </div>
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
                const selectedWhole = wholeObjectId === object.id || cart.some(item => item.kind === "WHOLE_TABLE" && item.objectId === object.id);
                const selectedZone = zoneObjectId === object.id || cart.some(item => item.kind === "ZONE" && item.objectId === object.id);
                const faded = (seatObject && !wholeVisible) || (zone && !categoryAllowed);
                const zoneColor = zone && categoryAllowed ? categories.find(item => item.id === object.categoryId)?.colorHex : undefined;
                return <div key={object.id} className={`${styles.object} ${zone ? styles.zoneLayer : ""} ${faded ? styles.filteredObject : ""}`} style={{ left: `${object.x}%`, top: `${object.y}%`, width: object.width, height: object.height, transform: `translate(-50%,-50%) rotate(${object.rotation}deg)` }}>
                  {!seatObject
                    ? <div data-seatmap-selectable="true" className={`${styles.decoration} ${styles[`decoration${object.objectType}`] ?? ""} ${selectedZone ? styles.zoneSelected : ""}`} style={zoneColor ? { background: zoneColor, borderColor: zoneColor, color: "#fff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" } : undefined} onClick={(event) => { event.stopPropagation(); chooseZone(object); }}><strong>{object.label}</strong></div>
                    : <div data-seatmap-selectable="true" className={`${styles.furniture} ${styles[`furniture${object.objectType}`] ?? ""}`} onClick={(event) => {
                        event.stopPropagation();
                        if (object.priceMode !== "WHOLE_TABLE" || object.reserved || !wholeVisible) return;
                        chooseWholeObject(object);
                      }}>
                        {cart.filter(item => item.kind === "SEATS" && item.objectId === object.id).map(item => <span key={item.id} className={styles.selectionHalo} style={selectionHaloStyle(object, item.seatIds)}/>)}
                        <div className={`${styles.core} ${selectedWhole ? styles.coreSelected : ""}`}><strong>{object.label}</strong></div>
                        {object.objectType === "ROW"
                          ? <div className={styles.rowSeats}>{object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const priceMatched = Boolean(categoryId && allowedCategoryIds.has(categoryId) && seat.status === "AVAILABLE");
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={selectedSeatIds.includes(seat.id) || cartSeatIds.has(seat.id)} priceMatched={priceMatched} disabled={object.priceMode === "WHOLE_TABLE" || !eligible || cartSeatIds.has(seat.id)} onClick={() => chooseSeat(object, seat)} onHover={event => priceMatched && !cartSeatIds.has(seat.id) && setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}</div>
                          : object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const priceMatched = Boolean(categoryId && allowedCategoryIds.has(categoryId) && seat.status === "AVAILABLE");
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={selectedSeatIds.includes(seat.id) || cartSeatIds.has(seat.id)} priceMatched={priceMatched} disabled={object.priceMode === "WHOLE_TABLE" || !eligible || cartSeatIds.has(seat.id)} onClick={() => chooseSeat(object, seat)} onHover={event => priceMatched && !cartSeatIds.has(seat.id) && setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}
                      </div>}
                </div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className={`${styles.sidebar} ${polish.sidebar}`}>
        <div className={`${styles.eventInfo} ${polish.eventInfo}`}>
          <img className={polish.poster} src={posterUrl} alt=""/>
          <div className={`${styles.eventDetails} ${polish.eventDetails}`}>
            <h1 className={polish.title}>{displayTitle}</h1>
            <div className={styles.peopleWrap}>
              <button type="button" className={`${styles.peopleButton} ${polish.peopleButton}`} aria-label={`${local.people}: ${qty}`} onClick={() => { setDraftQty(qty); setPeopleOpen(true); }}>
                <UsersRound size={16}/><strong>{qty}</strong><ChevronDown size={14}/>
              </button>
            </div>
          </div>
        </div>
        <div className={styles.sidebarDivider}/>

        {cartError && <div className={styles.cartError} role="alert">{cartError}</div>}
        <div className={styles.cartItems}>{cartDisplay.map(item => <div className="atlas-selected-ticket" key={item.id}>
          <div className="atlas-selected-head">
            <div>
              <h2 className="atlas-selected-title">{item.title}</h2>
              <span className="atlas-selected-desc">{item.description}</span>
            </div>
            <div className="atlas-selected-price">
              {money(item.buyerTotalMinor, "ILS", locale)}
              {item.feeMinor > 0 && <span className="atlas-selected-fee">{local.feeIncluded} {money(item.feeMinor, "ILS", locale)}</span>}
            </div>
            <button type="button" className="atlas-remove-ticket" aria-label="Remove selected ticket" onClick={() => removeCartItem(item.id)}><X size={15}/></button>
          </div>
        </div>)}</div>

        <button type="button" className="atlas-checkout-button" disabled={!cart.length} onClick={go}>
          {cart.length ? <>{local.continue} <span aria-hidden="true">→</span> {money(cartPricing.buyerTotalMinor, "ILS", locale)}</> : local.emptyCheckout}
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
      <div className={polish.quantityModal} role="dialog" aria-modal="true" aria-labelledby="seat-quantity-title" aria-describedby="seat-quantity-description" onMouseDown={event => event.stopPropagation()}>
        <div className={polish.modalHeader}>
          <h2 id="seat-quantity-title">{local.people}</h2>
          <button type="button" className={polish.closeButton} onClick={() => setPeopleOpen(false)} aria-label={local.close}><X size={18}/></button>
        </div>
        <p id="seat-quantity-description" className={polish.quantityDescription}>{local.peopleHint}</p>
        <div className={polish.quantityControl}>
          <button type="button" onClick={() => setDraftQty(value => Math.max(1, value - 1))} disabled={draftQty <= 1}><Minus size={21}/></button>
          <strong aria-live="polite">{ticketQuantityLabel(draftQty)}</strong>
          <button type="button" onClick={() => setDraftQty(value => Math.min(quantityLimit, value + 1))} disabled={draftQty >= quantityLimit}><Plus size={21}/></button>
        </div>
        <button type="button" className={polish.confirmButton} onClick={confirmPeople}>{local.confirm}</button>
      </div>
    </div>}
    {noMatchingPlaces && !peopleOpen && <div className={polish.modalBackdrop} role="presentation">
      <div className={styles.rangeRecoveryModal} role="dialog" aria-modal="true" aria-label={local.expandRange}>
        <h2>{local.expandRange}</h2>
        <p>{local.expandRangeHint}</p>
        <div className={styles.recoveryPriceLabels}>
          <strong style={{ color: availableCategories.find(item => (categoryPrice.get(item.id) ?? 0) === draftMinPrice)?.colorHex }}>{money(draftMinPrice, "ILS", locale)}</strong>
          <strong style={{ color: availableCategories.find(item => (categoryPrice.get(item.id) ?? 0) === draftMaxPrice)?.colorHex }}>{money(draftMaxPrice, "ILS", locale)}</strong>
        </div>
        <div className={styles.recoverySlider}>
          <span style={{ left: `${draftMinRangeIndex / Math.max(1, sortedPrices.length - 1) * 100}%`, width: `${(draftMaxRangeIndex - draftMinRangeIndex) / Math.max(1, sortedPrices.length - 1) * 100}%` }}/>
          <input aria-label="minimum ticket price" type="range" min="0" max={Math.max(0, sortedPrices.length - 1)} step="1" value={draftMinRangeIndex} onChange={event => setDraftMinRangeIndex(Math.min(Number(event.target.value), draftMaxRangeIndex))}/>
          <input aria-label="maximum ticket price" type="range" min="0" max={Math.max(0, sortedPrices.length - 1)} step="1" value={draftMaxRangeIndex} onChange={event => setDraftMaxRangeIndex(Math.max(Number(event.target.value), draftMinRangeIndex))}/>
        </div>
        <button type="button" disabled={!canApplyDraftRange} onClick={applyDraftPriceRange}>{local.applyRange}</button>
      </div>
    </div>}
  </main>;
}
