"use client";

import { useEffect, useMemo, useRef } from "react";

type HoldCategory = { id: string; name: string };
type HoldSeat = { id: string; label: string; position: number; categoryId: string | null };
type HoldObject = {
  id: string;
  label: string;
  seats: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  objectType: string;
  categoryId: string | null;
  seatItems: HoldSeat[];
};

type CartHoldItem = { categoryId: string; quantity: number; tableId: string | null; seatIds: string[] };
type StoredItem = { title: string; description: string; quantity?: number };
type StoredGroup = { eventSlug: string; expiresAt: number; items: StoredItem[] };
type StoredCart = { version?: number; groups?: StoredGroup[] };

type HoldState = {
  heldSeatIds?: string[];
  heldTableIds?: string[];
  heldByCategory?: Record<string, number>;
};

const CART_STORAGE_KEY = "atlas-persistent-cart-v2";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function quantityFromTitle(title: string) {
  const match = title.match(/[×x]\s*(\d+)/i);
  const value = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function findCategory(title: string, categories: HoldCategory[]) {
  const normalized = normalize(title.replace(/[×x]\s*\d+.*$/i, ""));
  return [...categories]
    .sort((a, b) => b.name.length - a.name.length)
    .find(category => normalized.includes(normalize(category.name)));
}

function findObject(description: string, objects: HoldObject[]) {
  const normalized = normalize(description);
  return [...objects]
    .sort((a, b) => b.label.length - a.label.length)
    .find(object => normalized.includes(normalize(object.label)));
}

function seatIdsFromDescription(description: string, object: HoldObject, quantity: number) {
  const withoutLabel = description.replace(new RegExp(object.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  const numbers = [...withoutLabel.matchAll(/\d+/g)].map(match => Number.parseInt(match[0], 10));
  const positions = new Set<number>();
  for (let index = 0; index < numbers.length; index += 1) {
    const current = numbers[index];
    const next = numbers[index + 1];
    if (next && withoutLabel.includes(`${current}-${next}`)) {
      for (let position = current; position <= next; position += 1) positions.add(position);
    } else positions.add(current);
  }
  const matched = object.seatItems.filter(seat => positions.has(seat.position)).slice(0, quantity);
  return matched.map(seat => seat.id);
}

function captureCart(categories: HoldCategory[], objects: HoldObject[]): CartHoldItem[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".atlas-selected-ticket"));
  return nodes.flatMap((node): CartHoldItem[] => {
    const title = node.querySelector<HTMLElement>(".atlas-selected-title")?.innerText || "";
    const description = node.querySelector<HTMLElement>(".atlas-selected-desc")?.innerText || "";
    const quantity = quantityFromTitle(title);
    const category = findCategory(title, categories);
    const object = findObject(description, objects);
    if (!category) return [];

    if (!object) return [{ categoryId: category.id, quantity, tableId: null, seatIds: [] }];
    if (object.priceMode === "WHOLE_TABLE") {
      return [{ categoryId: category.id, quantity, tableId: object.id, seatIds: [] }];
    }
    if (object.objectType === "ZONE") {
      return [{ categoryId: category.id, quantity, tableId: null, seatIds: [] }];
    }
    const seatIds = seatIdsFromDescription(description, object, quantity);
    if (seatIds.length !== quantity) return [];
    return [{ categoryId: category.id, quantity, tableId: null, seatIds }];
  });
}

function currentStoredGroup(): StoredGroup | null {
  try {
    const slug = window.location.pathname.match(/^\/events\/([^/]+)\/seats/)?.[1];
    if (!slug) return null;
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const cart = JSON.parse(raw) as StoredCart;
    const group = cart.groups?.find(candidate => candidate.eventSlug === slug && candidate.expiresAt > Date.now());
    return group && Array.isArray(group.items) ? group : null;
  } catch {
    return null;
  }
}

function clickableForObject(object: HoldObject) {
  const target = normalize(object.label);
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-seatmap-selectable='true'],button,[role='button'],[tabindex='0']"));
  return candidates.find(element => {
    const aria = normalize(element.getAttribute("aria-label") || "");
    const text = normalize(element.innerText || "");
    return aria === target || text === target || aria.includes(target) || text === target;
  }) || null;
}

function clickableForSeat(seat: HoldSeat) {
  const target = normalize(seat.label);
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-label]")).find(button => normalize(button.getAttribute("aria-label") || "") === target) || null;
}

function scheduleRestore(group: StoredGroup, categories: HoldCategory[], objects: HoldObject[]) {
  let delay = 0;
  let scheduled = 0;

  for (const item of group.items) {
    const quantity = item.quantity || quantityFromTitle(item.title || "");
    const category = findCategory(item.title || "", categories);
    const object = findObject(item.description || "", objects);
    if (!category || !object) continue;

    if (object.priceMode === "PER_SEAT" && object.objectType !== "ZONE") {
      const ids = seatIdsFromDescription(item.description || "", object, quantity);
      for (const id of ids) {
        const seat = object.seatItems.find(candidate => candidate.id === id);
        if (!seat) continue;
        window.setTimeout(() => clickableForSeat(seat)?.click(), delay);
        delay += 110;
        scheduled += 1;
      }
      continue;
    }

    const target = clickableForObject(object);
    if (!target) continue;
    // A ZONE click creates one cart line using the page's current ticket quantity.
    // Clicking the zone once per stored ticket would multiply the restored quantity.
    const clicks = object.priceMode === "WHOLE_TABLE" || object.objectType === "ZONE" ? 1 : quantity;
    for (let index = 0; index < clicks; index += 1) {
      window.setTimeout(() => target.click(), delay);
      delay += 140;
      scheduled += 1;
    }
  }

  return { scheduled, duration: delay };
}

function applyRemoteHolds(state: HoldState, seatLabelById: Map<string, string>, tableLabelById: Map<string, string>) {
  const heldSeatLabels = new Set((state.heldSeatIds ?? []).map(id => seatLabelById.get(id)).filter((label): label is string => Boolean(label)));
  const heldTableLabels = new Set((state.heldTableIds ?? []).map(id => tableLabelById.get(id)).filter((label): label is string => Boolean(label)));

  document.querySelectorAll<HTMLButtonElement>("button[aria-label]").forEach(button => {
    const label = button.getAttribute("aria-label") || "";
    const remotelyHeld = heldSeatLabels.has(label);
    if (remotelyHeld) {
      button.dataset.atlasRemoteHeld = "true";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else if (button.dataset.atlasRemoteHeld === "true") {
      delete button.dataset.atlasRemoteHeld;
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    }
  });

  document.querySelectorAll<HTMLElement>("div[class*='object']").forEach(element => {
    const text = normalize(element.innerText || "");
    const held = [...heldTableLabels].some(label => text.includes(normalize(label)));
    if (held) {
      element.dataset.atlasRemoteHeldTable = "true";
      element.style.pointerEvents = "none";
      element.style.opacity = ".42";
    } else if (element.dataset.atlasRemoteHeldTable === "true") {
      delete element.dataset.atlasRemoteHeldTable;
      element.style.pointerEvents = "";
      element.style.opacity = "";
    }
  });
}

export function SeatHoldBridge({ eventId, categories, objects }: {
  eventId: string;
  categories: HoldCategory[];
  objects: HoldObject[];
}) {
  const signatureRef = useRef("");
  const syncingRef = useRef(false);
  const restoreStartedRef = useRef(false);
  const restoringUntilRef = useRef(0);
  const seatLabelById = useMemo(() => new Map(objects.flatMap(object => object.seatItems.map(seat => [seat.id, seat.label] as const))), [objects]);
  const tableLabelById = useMemo(() => new Map(objects.map(object => [object.id, object.label] as const)), [objects]);

  useEffect(() => {
    let stopped = false;

    const refreshRemote = async () => {
      try {
        const response = await fetch(`/api/cart/hold?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const state = await response.json() as HoldState;
        applyRemoteHolds(state, seatLabelById, tableLabelById);
      } catch {/* next poll retries */}
    };

    const restorePersistentSelection = () => {
      if (restoreStartedRef.current || document.querySelector(".atlas-selected-ticket")) return;
      const group = currentStoredGroup();
      if (!group) return;
      const restored = scheduleRestore(group, categories, objects);
      if (!restored.scheduled) return;
      restoreStartedRef.current = true;
      restoringUntilRef.current = Date.now() + restored.duration + 900;
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("atlas-cart-restore-complete")), restored.duration + 250);
    };

    const syncCart = async () => {
      if (syncingRef.current || stopped || Date.now() < restoringUntilRef.current) return;
      const items = captureCart(categories, objects);
      const persisted = currentStoredGroup();
      if (!items.length && persisted && !restoreStartedRef.current) {
        restorePersistentSelection();
        return;
      }
      const signature = JSON.stringify(items);
      if (signature === signatureRef.current) return;
      syncingRef.current = true;
      try {
        const response = await fetch("/api/cart/hold", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, items }),
          keepalive: true,
        });
        const data = await response.json().catch(() => ({})) as { error?: string; expiresAt?: string | null };
        if (!response.ok) {
          window.alert(data.error || "Одно из выбранных мест уже временно забронировано другим покупателем");
          window.location.reload();
          return;
        }
        signatureRef.current = signature;
        if (data.expiresAt) window.dispatchEvent(new CustomEvent("atlas-server-hold", { detail: { eventId, expiresAt: data.expiresAt } }));
        await refreshRemote();
      } finally {
        syncingRef.current = false;
      }
    };

    const observer = new MutationObserver(() => {
      window.setTimeout(restorePersistentSelection, 0);
      window.setTimeout(syncCart, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const polling = window.setInterval(refreshRemote, 2500);
    const cartPolling = window.setInterval(syncCart, 350);
    void refreshRemote();
    window.setTimeout(restorePersistentSelection, 180);
    window.setTimeout(syncCart, 850);

    return () => {
      stopped = true;
      observer.disconnect();
      window.clearInterval(polling);
      window.clearInterval(cartPolling);
    };
  }, [categories, eventId, objects, seatLabelById, tableLabelById]);

  return null;
}
