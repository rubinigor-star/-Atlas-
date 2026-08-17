"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "atlas-persistent-cart-v2";

export function CartStateReconciler() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/events\/([^/]+)\/seats(?:\/|$)/);
    if (!match) return;
    const eventSlug = match[1];

    const timer = window.setTimeout(() => {
      if (document.querySelector(".atlas-selected-ticket")) return;

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { version?: number; groups?: Array<{ eventSlug?: string }> };
        if (parsed.version !== 2 || !Array.isArray(parsed.groups)) return;
        const nextGroups = parsed.groups.filter(group => group?.eventSlug !== eventSlug);
        if (nextGroups.length === parsed.groups.length) return;
        if (nextGroups.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, groups: nextGroups }));
        else window.localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("atlas-cart-change"));
        void fetch("/api/cart/hold/release", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventSlug }),
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        // Ignore malformed legacy browser state. The cart UI can recover normally.
      }
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
