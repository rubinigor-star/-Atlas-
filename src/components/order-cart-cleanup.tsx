"use client";

import { useEffect } from "react";

const STORAGE_KEY = "atlas-persistent-cart-v2";

type CartGroup = {
  eventSlug?: string;
  eventTitle?: string;
};

type StoredCart = {
  groups?: CartGroup[];
  [key: string]: unknown;
};

export function OrderCartCleanup({ eventSlug, eventTitle }: { eventSlug: string; eventTitle: string }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as StoredCart;
      if (!Array.isArray(parsed.groups)) return;

      const nextGroups = parsed.groups.filter(
        (group) => group?.eventSlug !== eventSlug && group?.eventTitle !== eventTitle,
      );
      if (nextGroups.length === parsed.groups.length) return;

      if (nextGroups.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, groups: nextGroups }));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }

      // Update the cart icon, drawer and reminder immediately. Do NOT release the
      // server reservation here: approval orders must keep inventory blocked while
      // the organizer is reviewing the request.
      window.dispatchEvent(new CustomEvent("atlas-cart-change"));
    } catch {
      // Ignore unavailable or malformed browser storage. Server inventory remains authoritative.
    }
  }, [eventSlug, eventTitle]);

  return null;
}
