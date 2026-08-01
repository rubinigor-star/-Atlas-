"use client";

import { useEffect } from "react";

export function AbandonExitTracker({ eventId, categoryId, tableId, seatIds = [] }: { eventId: string; categoryId: string; tableId?: string; seatIds?: string[] }) {
  useEffect(() => {
    const key = `atlas-abandon-${eventId}-${categoryId}-${tableId || seatIds.join("-") || "general"}`;
    const leave = () => {
      const token = sessionStorage.getItem(key);
      if (!token) return;
      const body = JSON.stringify({ token });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/checkout/abandon/leave", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/checkout/abandon/leave", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
      }
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [eventId, categoryId, tableId, seatIds]);
  return null;
}
