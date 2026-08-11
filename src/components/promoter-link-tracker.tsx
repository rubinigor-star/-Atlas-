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
  localStorage.setItem(key, JSON.stringify({ id, lastSeen: now }));
  return id;
}

export function PromoterLinkTracker({ code, eventId }: { code: string; eventId: string }) {
  useEffect(() => {
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
    void fetch(`/api/promoter-links/${encodeURIComponent(code)}/visit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  }, [code, eventId]);

  return null;
}
