"use client";

import { useEffect } from "react";

const SESSION_TTL_MS = 30 * 60 * 1000;

function sessionFor(key: string) {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: unknown; lastSeen?: unknown };
      if (typeof parsed.id === "string" && typeof parsed.lastSeen === "number" && now - parsed.lastSeen < SESSION_TTL_MS) {
        localStorage.setItem(key, JSON.stringify({ id: parsed.id, lastSeen: now }));
        return parsed.id;
      }
    }
  } catch {}
  const id = crypto.randomUUID();
  try { localStorage.setItem(key, JSON.stringify({ id, lastSeen: now })); } catch {}
  return id;
}

export function PromoterLinkTracker({ code, eventId }: { code: string; eventId: string }) {
  useEffect(() => {
    let cancelled = false;
    const sessionId = sessionFor(`atlas-promoter-session-${code}`);
    const params = new URLSearchParams(window.location.search);
    const body = {
      sessionId,
      eventId,
      source: params.get("source") || document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    };

    async function track() {
      for (let attempt = 0; attempt < 2 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(`/api/promoter-links/${encodeURIComponent(code)}/visit`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            keepalive: true,
            cache: "no-store",
          });
          if (response.ok) return;
          if (response.status === 404) return;
        } catch {}
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    void track();
    return () => { cancelled = true; };
  }, [code, eventId]);

  return null;
}
