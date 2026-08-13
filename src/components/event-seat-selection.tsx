"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Minus, Plus, RotateCcw, X } from "lucide-react";
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

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (count > items.length) return [];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), count - 1).map(rest => [item, ...rest]));
}

function validSeatGroups(object: MapObject, quantity: number, seatAllowed: (seat: MapSeat) => boolean): string[][] {
  if (object.priceMode !== "PER_SEAT" || quantity < 1) return [];
  const seats = [...object.seatItems].sort((a, b) => a.position - b.position);
  if (quantity > seats.length) return [];
  if (quantity === 1) return seats.filter(seatAllowed).map(seat => [seat.id]);

  if (object.objectType === "TABLE" && seats.length % 2 === 0) {
    const half = seats.length / 2;
    const sides = [seats.slice(0, half), seats.slice(half)];
    const adjacentPairs = sides.flatMap(side => side.slice(0, -1).map((seat, index) => [seat.id, side[index + 1].id]));
    const oppositePairs = Array.from({ length: half }, (_, index) => [seats[index].id, seats[index + half].id]);
    const seatById = new Map(seats.map(seat => [seat.id, seat]));
    const pairAllowed = (pair: string[]) => pair.every(id => {
      const candidate = seatById.get(id);
      return Boolean(candidate && seatAllowed(candidate));
    });
    if (quantity === 2) return [...adjacentPairs.filter(pairAllowed), ...oppositePairs.filter(pairAllowed)];
    const available = seats.filter(seatAllowed);
    const preferred = quantity <= half ? sides.flatMap(side => side.slice(0, side.length - quantity + 1).map((_, index) => side.slice(index, index + quantity)).filter(group => group.every(seatAllowed)).map(group => group.map(seat => seat.id))) : [];
    const all = combinations(available, quantity).map(group => group.map(seat => seat.id));
    const seen = new Set<string>();
    return [...preferred, ...all].filter(group => {
      const key = [...group].sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (object.objectType === "ROUND_TABLE") {
    const groups: string[][] = [];
    for (let start = 0; start < seats.length; start += 1) {
      const group = Array.from({ length: quantity }, (_, offset) => seats[(start + offset) % seats.length]);
      if (new Set(group.map(seat => seat.id)).size === quantity && group.every(seatAllowed)) groups.push(group.map(seat => seat.id));
    }
    return groups;
  }

  const groups: string[][] = [];
  for (let start = 0; start <= seats.length - quantity; start += 1) {
    const group = seats.slice(start, start + quantity);
    const firstPosition = group[0]?.position ?? 0;
    if (group.every((seat, index) => seat.position === firstPosition + index && seatAllowed(seat))) groups.push(group.map(seat => seat.id));
  }
  return groups;
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
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef({ distance: 0, zoom: DEFAULT_ZOOM, worldX: 0, worldY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [hoveredSeat, setHoveredSeat] = useState<HoveredSeat>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");
  const [qty, setQty] = useState(Math.max(1, Math.min(8, initialQty)));
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [draftQty, setDraftQty] = useState(Math.max(1, Math.min(8, initialQty)));
  const [dismissedRecoveryQty, setDismissedRecoveryQty] = useState<number | null>(null);

  const local = {
    ru: {
      back: "Вернуться к мероприятию",
      quantity: "Количество билетов", quantityHint: "При нажатии на место сразу выберется указанное количество доступных мест рядом", quantityInfo: "Как выбираются места", decrease: "Уменьшить количество", increase: "Увеличить количество", confirmQuantity: "Подтвердить", closeQuantity: "Закрыть",
      continue: "Перейти к оплате", emptyCheckout: "Выберите билет", feeIncluded: "включая сервисный сбор", noSeats: "В выбранном диапазоне нет доступных мест", expandRange: "Расширьте диапазон цен", expandRangeHint: "В выбранном диапазоне нет доступных билетов. Выберите более широкий диапазон.", applyRange: "Применить диапазон", categoryLimit: "Для категории «{name}» можно выбрать не более {count} билетов за один раз", orderLimit: "В одном заказе можно выбрать не более {count} билетов", linkLimit: "По этой ссылке можно купить не более {count} билетов в одном заказе",
      zoomReset: "Сбросить масштаб", row: "Ряд", seat: "место", seats: "места", table: "Стол", zone: "Зона", section: "Категория"
    },
    en: {
      back: "Back to event",
      quantity: "Ticket quantity", quantityHint: "Selecting a seat immediately adds the chosen number of available seats together", quantityInfo: "How seats are selected", decrease: "Decrease quantity", increase: "Increase quantity", confirmQuantity: "Confirm", closeQuantity: "Close",
      continue: "Go to checkout", emptyCheckout: "Select a ticket", feeIncluded: "incl. service fee", noSeats: "No available seats match this price range", expandRange: "Expand the price range", expandRangeHint: "No tickets are available in this price range. Choose a wider range.", applyRange: "Apply range", categoryLimit: "You can select no more than {count} tickets from “{name}” at a time", orderLimit: "You can select no more than {count} tickets in one order", linkLimit: "This link allows no more than {count} tickets in one order",
      zoomReset: "Reset zoom", row: "Row", seat: "seat", seats: "seats", table: "Table", zone: "Zone", section: "Category"
    },
    he: {
      back: "חזרה לאירוע",
      quantity: "כמות כרטיסים", quantityHint: "לחיצה על מקום תבחר מיד את מספר המקומות הזמינים יחד", quantityInfo: "איך נבחרים המקומות", decrease: "הפחתת כמות", increase: "הגדלת כמות", confirmQuantity: "אישור", closeQuantity: "סגירה",
      continue: "המשך לתשלום", emptyCheckout: "בחרו כרטיס", feeIncluded: "כולל דמי שירות", noSeats: "אין מקומות זמינים בטווח המחירים שנבחר", expandRange: "הרחיבו את טווח המחירים", expandRangeHint: "אין כרטיסים זמינים בטווח המחירים שנבחר. בחרו טווח רחב יותר.", applyRange: "החלת הטווח", categoryLimit: "ניתן לבחור עד {count} כרטיסים מקטגוריית „{name}” בכל פעם", orderLimit: "ניתן לבחור עד {count} כרטיסים בהזמנה אחת", linkLimit: "בקישור זה ניתן לקנות עד {count} כרטיסים בהזמנה אחת",
      zoomReset: "איפוס זום", row: "שורה", seat: "מקום", seats: "מקומות", table: "שולחן", zone: "אזור", section: "קטגוריה"
    },
  }[locale];

  useEffect(() => {
    document.body.classList.add("atlas-seat-selection-active");
    return () => document.body.classList.remove("atlas-seat-selection-active");
  }, []);

  useEffect(() => {
    if (!quantityModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setQuantityModalOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quantityModalOpen]);

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

  const availableObjects = useMemo(() => (allocation?.type === "TABLE" ? objects.filter(item => item.id === allocation.tableId || !seatTypes.has(item.objectType)) : objects).filter(item => !isInternalObject(item)), [allocation?.tableId, allocation?.type, objects]);
  const mobileMapBounds = useMemo(() => {
    if (!availableObjects.length) return { minX: 0, maxX: WORLD_WIDTH, minY: 0, maxY: WORLD_HEIGHT };
    const bleed = 34;
    return availableObjects.reduce((bounds, object) => {
      const centerX = object.x / 100 * WORLD_WIDTH;
      const centerY = object.y / 100 * WORLD_HEIGHT;
      return {
        minX: Math.min(bounds.minX, centerX - object.width / 2 - bleed),
        maxX: Math.max(bounds.maxX, centerX + object.width / 2 + bleed),
        minY: Math.min(bounds.minY, centerY - object.height / 2 - bleed),
        maxY: Math.max(bounds.maxY, centerY + object.height / 2 + bleed),
      };
    }, { minX: WORLD_WIDTH, maxX: 0, minY: WORLD_HEIGHT, maxY: 0 });
  }, [availableObjects]);
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
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !window.matchMedia("(max-width: 900px)").matches) return;
    const centerMobileMap = () => {
      const contentWidth = Math.max(1, mobileMapBounds.maxX - mobileMapBounds.minX);
      const fittedZoom = Math.max(24, Math.min(48, ((viewport.clientWidth - 28) / contentWidth) * 100));
      const fittedScale = fittedZoom / 100;
      const contentCenterX = (mobileMapBounds.minX + mobileMapBounds.maxX) / 2;
      setZoom(fittedZoom);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, contentCenterX * fittedScale - viewport.clientWidth / 2);
        viewport.scrollTop = Math.max(0, mobileMapBounds.minY * fittedScale - 8);
      }));
    };
    centerMobileMap();
    const observer = new ResizeObserver(centerMobileMap);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [mobileMapBounds]);

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
  const eventOrderLimit = Math.max(1, ...availableCategories.map(item => item.maxPerOrder));
  const purchaseLimit = allocation ? Math.min(eventOrderLimit, allocation.maxPerOrder) : eventOrderLimit;
  function categoryCanAccept(categoryId: string, increment: number) {
    const category = availableCategories.find(item => item.id === categoryId);
    if (!category) return false;
    const next = (cartCategoryQuantities.get(categoryId) ?? 0) + increment;
    return next <= category.capacity - category.sold;
  }

  function additionsCanFit(additions: Map<string, number>) {
    const addedTotal = [...additions.values()].reduce((sum, value) => sum + value, 0);
    if (cartQuantity + addedTotal > purchaseLimit) return false;
    return [...additions].every(([categoryId, increment]) => categoryCanAccept(categoryId, increment));
  }

  function additionsFitLimits(additions: Map<string, number>) {
    const addedTotal = [...additions.values()].reduce((sum, value) => sum + value, 0);
    if (cartQuantity + addedTotal > purchaseLimit) {
      setCartError((allocation ? local.linkLimit : local.orderLimit).replace("{count}", String(purchaseLimit)));
      return false;
    }
    for (const [categoryId, increment] of additions) {
      const category = availableCategories.find(item => item.id === categoryId);
      if (!category) return false;
      if (!categoryCanAccept(categoryId, increment)) {
        setCartError(local.categoryLimit.replace("{name}", category.name).replace("{count}", String(Math.max(0, category.capacity - category.sold))));
        return false;
      }
    }
    setCartError("");
    return true;
  }

  const groupAdditions = (object: MapObject, seatIds: string[]) => {
    const additions = new Map<string, number>();
    for (const seatId of seatIds) {
      const seat = object.seatItems.find(item => item.id === seatId);
      const categoryId = seat?.categoryId ?? object.categoryId;
      if (categoryId) additions.set(categoryId, (additions.get(categoryId) ?? 0) + 1);
    }
    return additions;
  };
  const groupsByObject = new Map<string, string[][]>();
  for (const object of availableObjects) {
    if (object.priceMode !== "PER_SEAT" || object.reserved) continue;
    const groups = validSeatGroups(object, qty, seat => {
      const categoryId = seat.categoryId ?? object.categoryId;
      return seat.status === "AVAILABLE" && !cartSeatIds.has(seat.id) && Boolean(categoryId && allowedCategoryIds.has(categoryId));
    }).filter(group => additionsCanFit(groupAdditions(object, group)));
    if (groups.length) groupsByObject.set(object.id, groups);
  }
  const eligibleSeatIds = new Set([...groupsByObject.values()].flat(2));
  const hasMatchingSeats = eligibleSeatIds.size > 0;
  const hasMatchingZone = availableObjects.some(object => object.objectType === "ZONE" && Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, qty]]))));
  const hasMatchingWholeObject = availableObjects.some(object => object.priceMode === "WHOLE_TABLE" && !object.reserved && !cart.some(item => item.objectId === object.id) && Boolean(object.categoryId && allowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, object.seats]]))));
  const hasMatchingPlaces = hasMatchingSeats || hasMatchingZone || hasMatchingWholeObject;
  const draftMinPrice = sortedPrices[draftMinRangeIndex] ?? 0;
  const draftMaxPrice = sortedPrices[draftMaxRangeIndex] ?? draftMinPrice;
  const draftAllowedCategoryIds = new Set(availableCategories
    .filter(item => { const price = categoryPrice.get(item.id) ?? -1; return price >= draftMinPrice && price <= draftMaxPrice; })
    .map(item => item.id));
  const draftHasSeats = availableObjects.some(object => object.priceMode === "PER_SEAT" && !object.reserved && validSeatGroups(object, qty, seat => {
    const categoryId = seat.categoryId ?? object.categoryId;
    return seat.status === "AVAILABLE" && !cartSeatIds.has(seat.id) && Boolean(categoryId && draftAllowedCategoryIds.has(categoryId));
  }).some(group => additionsCanFit(groupAdditions(object, group))));
  const draftHasZone = availableObjects.some(object => object.objectType === "ZONE" && Boolean(object.categoryId && draftAllowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, qty]]))));
  const draftHasWholeObject = availableObjects.some(object => object.priceMode === "WHOLE_TABLE" && !object.reserved && !cart.some(item => item.objectId === object.id) && Boolean(object.categoryId && draftAllowedCategoryIds.has(object.categoryId) && additionsCanFit(new Map([[object.categoryId, object.seats]]))));
  const canApplyDraftRange = draftHasSeats || draftHasZone || draftHasWholeObject;
  const wholeObject = objects.find(item => item.id === wholeObjectId);
  const zoneObject = objects.find(item => item.id === zoneObjectId);
  const noMatchingPlaces = cartQuantity < purchaseLimit && !hasMatchingPlaces && !wholeObject && !zoneObject;
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
    const candidates = (groupsByObject.get(object.id) ?? []).filter(group => group.includes(seat.id));
    const selectedIds = candidates[0];
    if (!selectedIds?.length) return;
    setWholeObjectId(null);
    setZoneObjectId(null);
    const additions = groupAdditions(object, selectedIds);
    if (!additionsFitLimits(additions)) return;
    const selectedSeats = selectedIds.map(id => object.seatItems.find(item => item.id === id)).filter((item): item is MapSeat => Boolean(item));
    const categoryId = selectedSeats[0]?.categoryId ?? object.categoryId;
    if (!categoryId) return;
    const category = categories.find(item => item.id === categoryId);
    const subtotalMinor = selectedSeats.reduce((sum, item) => {
      const selectedCategoryId = item.categoryId ?? object.categoryId;
      return sum + (categories.find(candidate => candidate.id === selectedCategoryId)?.priceMinor ?? 0);
    }, 0);
    addCartItem({ kind: "SEATS", categoryId, quantity: selectedSeats.length, objectId: object.id, seatIds: selectedIds, title: `${category?.name ?? object.label} × ${selectedSeats.length}`, description: objectDescription(object, selectedSeats), subtotalMinor });
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
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (event.pointerType === "touch") {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      const points = [...touchPointersRef.current.values()];
      if (points.length >= 2) {
        const [first, second] = points;
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const bounds = viewport.getBoundingClientRect();
        const currentScale = zoom / 100;
        pinchRef.current = {
          distance: Math.hypot(second.x - first.x, second.y - first.y),
          zoom,
          worldX: (viewport.scrollLeft + centerX - bounds.left) / currentScale,
          worldY: (viewport.scrollTop + centerY - bounds.top) / currentScale,
        };
        setPanning(true);
        event.preventDefault();
        return;
      }
      if (target.closest('button,input,select,a,[data-seatmap-selectable="true"]')) return;
    } else if (!spaceHeld && target.closest('button,input,select,a,[data-seatmap-selectable="true"]')) return;
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
    setPanning(true);
    event.preventDefault();
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...touchPointersRef.current.values()];
      if (points.length >= 2) {
        const [first, second] = points;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        const ratio = pinchRef.current.distance > 0 ? distance / pinchRef.current.distance : 1;
        const minimumZoom = window.matchMedia("(max-width: 900px)").matches ? 24 : 35;
        const nextZoom = Math.max(minimumZoom, Math.min(125, pinchRef.current.zoom * ratio));
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const bounds = viewport.getBoundingClientRect();
        setZoom(nextZoom);
        requestAnimationFrame(() => {
          const nextScale = nextZoom / 100;
          viewport.scrollLeft = Math.max(0, pinchRef.current.worldX * nextScale - (centerX - bounds.left));
          viewport.scrollTop = Math.max(0, pinchRef.current.worldY * nextScale - (centerY - bounds.top));
        });
        event.preventDefault();
        return;
      }
    }
    if (!panning || panRef.current.pointerId !== event.pointerId) return;
    viewport.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
    viewport.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (event.pointerType === "touch") {
      touchPointersRef.current.delete(event.pointerId);
      if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      const remaining = [...touchPointersRef.current.entries()];
      if (remaining.length === 1 && viewport) {
        const [pointerId, point] = remaining[0];
        panRef.current = { pointerId, x: point.x, y: point.y, left: viewport.scrollLeft, top: viewport.scrollTop };
        return;
      }
      if (remaining.length === 0) {
        panRef.current.pointerId = -1;
        setPanning(false);
      }
      return;
    }
    if (panRef.current.pointerId !== event.pointerId) return;
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
      return `${local.table} ${object.label}, ${local.seats} ${sorted.map(seat => seat.position).join(", ")}`;
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
  const mobileEventTitle = locale === "ru"
    ? `Билеты на ${displayTitle.replace(/^Группа\s+/i, "")}`
    : locale === "he"
      ? `כרטיסים ל${displayTitle.replace(/^להקת\s+/i, "")}`
      : `Tickets for ${displayTitle.replace(/^Group\s+/i, "")}`;

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
      .atlas-quantity-confirm-wrap {
        position: relative;
        z-index: 30;
        display: block;
        width: 100%;
        min-width: 100%;
        flex: 0 0 auto;
      }
      .atlas-quantity-confirm-button {
        position: relative !important;
        z-index: 31 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        width: 100% !important;
        min-width: 100% !important;
        max-width: none !important;
        height: 44px !important;
        min-height: 44px !important;
        margin: 0 !important;
        padding: 0 20px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: linear-gradient(90deg, #ff0b55 0%, #ff087f 52%, #ff1493 100%) !important;
        color: #fff !important;
        font-family: inherit !important;
        font-size: 16px !important;
        line-height: 44px !important;
        font-weight: 800 !important;
        text-align: center !important;
        white-space: nowrap !important;
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
        appearance: none !important;
        cursor: pointer !important;
        box-shadow: none !important;
      }
      .atlas-quantity-confirm-button:hover {
        filter: brightness(.98);
      }
      .atlas-quantity-confirm-button:focus-visible {
        outline: 3px solid rgba(255, 10, 120, .25) !important;
        outline-offset: 3px;
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
        <div className={styles.mobileEventBar}>
          <img src={posterUrl} alt=""/>
          <Link className={styles.mobileEventTitle} href={backHref}>{mobileEventTitle}</Link>
          <Link className={styles.mobileInlineBack} href={backHref} aria-label={local.back}><ArrowLeft size={18}/></Link>
          <div className={styles.mobileQuantityRow}>
            <span className={styles.mobileQuantityLabel}>
              <strong>{local.quantity}</strong>
              <button type="button" aria-label={local.quantityInfo} aria-haspopup="dialog" onClick={() => { setDraftQty(qty); setQuantityModalOpen(true); }}><Info size={13}/></button>
            </span>
            <span className={styles.mobileQuantityControl}>
              <button type="button" aria-label={local.decrease} disabled={qty <= 1} onClick={() => setQty(value => Math.max(1, value - 1))}><Minus size={16}/></button>
              <strong aria-live="polite">{qty}</strong>
              <button type="button" aria-label={local.increase} disabled={qty >= 8} onClick={() => setQty(value => Math.min(8, value + 1))}><Plus size={16}/></button>
            </span>
          </div>
        </div>
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
                        {cart.filter(item => item.kind === "SEATS" && item.objectId === object.id).map(item => <span key={item.id} className={styles.selectionHalo} style={selectionHaloStyle(object, item.seatIds)}/>) }
                        <div className={`${styles.core} ${selectedWhole ? styles.coreSelected : ""}`}><strong>{object.label}</strong></div>
                        {object.objectType === "ROW"
                          ? <div className={styles.rowSeats}>{object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const priceMatched = Boolean(categoryId && allowedCategoryIds.has(categoryId) && seat.status === "AVAILABLE");
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={cartSeatIds.has(seat.id)} priceMatched={priceMatched} disabled={object.priceMode === "WHOLE_TABLE" || !eligible || cartSeatIds.has(seat.id)} onClick={() => chooseSeat(object, seat)} onHover={event => priceMatched && !cartSeatIds.has(seat.id) && setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}</div>
                          : object.seatItems.map(seat => {
                              const categoryId = seat.categoryId ?? object.categoryId;
                              const color = categories.find(item => item.id === categoryId)?.colorHex ?? "#e3e7eb";
                              const priceMatched = Boolean(categoryId && allowedCategoryIds.has(categoryId) && seat.status === "AVAILABLE");
                              const eligible = eligibleSeatIds.has(seat.id);
                              return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status === "AVAILABLE" ? color : "#e3e7eb"} selected={cartSeatIds.has(seat.id)} priceMatched={priceMatched} disabled={object.priceMode === "WHOLE_TABLE" || !eligible || cartSeatIds.has(seat.id)} onClick={() => chooseSeat(object, seat)} onHover={event => priceMatched && !cartSeatIds.has(seat.id) && setHoveredSeat({ object, seat, x: event.clientX, y: event.clientY })} onLeave={() => setHoveredSeat(null)}/>;
                            })}
                      </div>}
                </div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className={`${styles.sidebar} ${!cart.length ? styles.sidebarEmpty : ""} ${polish.sidebar}`}>
        <div className={`${styles.eventInfo} ${polish.eventInfo}`}>
          <img className={polish.poster} src={posterUrl} alt=""/>
          <div className={`${styles.eventDetails} ${polish.eventDetails}`}>
            <h1 className={polish.title}>{displayTitle}</h1>
            <div className={polish.quantityRow}>
              <span className={polish.quantityLabel}>
                <strong>{local.quantity}</strong>
                <span className={polish.infoHint}>
                  <button type="button" className={polish.infoButton} aria-label={local.quantityInfo} aria-haspopup="dialog" onClick={() => { setDraftQty(qty); setQuantityModalOpen(true); }}><Info size={14}/></button>
                </span>
              </span>
              <span className={polish.quantityControl}>
                <button type="button" aria-label={local.decrease} disabled={qty <= 1} onClick={() => setQty(value => Math.max(1, value - 1))}><Minus size={17}/></button>
                <strong aria-live="polite">{qty}</strong>
                <button type="button" aria-label={local.increase} disabled={qty >= 8} onClick={() => setQty(value => Math.min(8, value + 1))}><Plus size={17}/></button>
              </span>
            </div>
          </div>
        </div>

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

    {quantityModalOpen && <div className={polish.modalBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setQuantityModalOpen(false); }}>
      <div className={polish.quantityModal} role="dialog" aria-modal="true" aria-labelledby="quantity-modal-title" aria-describedby="quantity-modal-description">
        <button type="button" className={polish.modalClose} aria-label={local.closeQuantity} onClick={() => setQuantityModalOpen(false)}><X size={17}/></button>
        <h2 id="quantity-modal-title">{local.quantity}</h2>
        <p id="quantity-modal-description">{local.quantityHint}</p>
        <div className={polish.modalQuantityControl}>
          <button type="button" aria-label={local.decrease} disabled={draftQty <= 1} onClick={() => setDraftQty(value => Math.max(1, value - 1))}><Minus size={20}/></button>
          <strong aria-live="polite">{draftQty}</strong>
          <button type="button" aria-label={local.increase} disabled={draftQty >= 8} onClick={() => setDraftQty(value => Math.min(8, value + 1))}><Plus size={20}/></button>
        </div>
        <div className="atlas-quantity-confirm-wrap">
          <button type="button" className="atlas-quantity-confirm-button" onClick={() => { setQty(draftQty); setQuantityModalOpen(false); }}>{local.confirmQuantity}</button>
        </div>
      </div>
    </div>}

    {noMatchingPlaces && !quantityModalOpen && dismissedRecoveryQty !== qty && <div className={polish.modalBackdrop} role="presentation">
      <div className={styles.rangeRecoveryModal} role="dialog" aria-modal="true" aria-label={local.expandRange}>
        <button type="button" className={styles.rangeRecoveryClose} aria-label={local.closeQuantity} onClick={() => setDismissedRecoveryQty(qty)}><X size={18}/></button>
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
        <button type="button" className={styles.rangeRecoveryApply} disabled={!canApplyDraftRange} onClick={applyDraftPriceRange}>{local.applyRange}</button>
      </div>
    </div>}
  </main>;
}
