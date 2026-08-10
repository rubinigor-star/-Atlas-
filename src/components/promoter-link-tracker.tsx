"use client";

import { useEffect } from "react";

export function PromoterLinkTracker({ code, eventId }: { code: string; eventId: string }) {
  useEffect(() => {
    const key = `atlas-promoter-session-${code}`;
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(key, sessionId);
    }
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
