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

type HoldState = {
  heldSeatIds?: string[];
  heldTableIds?: string[];
  heldByCategory?: Record<string, number>;
};

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

  // Whole-table objects do not expose stable data ids in the public map, so use
  // their visible label and block pointer interaction when another buyer holds them.
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

    const syncCart = async () => {
      if (syncingRef.current || stopped) return;
      const items = captureCart(categories, objects);
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
          // Another buyer won a race for the same claim. Reloading clears the
          // optimistic local selection and immediately paints the winning hold.
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

    const observer = new MutationObserver(() => window.setTimeout(syncCart, 0));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const polling = window.setInterval(refreshRemote, 2500);
    const cartPolling = window.setInterval(syncCart, 350);
    void refreshRemote();
    window.setTimeout(syncCart, 100);

    return () => {
      stopped = true;
      observer.disconnect();
      window.clearInterval(polling);
      window.clearInterval(cartPolling);
    };
  }, [categories, eventId, objects, seatLabelById, tableLabelById]);

  return null;
}
