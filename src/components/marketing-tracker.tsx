"use client";

import { useEffect } from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function MarketingTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = UTM_KEYS.some((key) => params.get(key));
    if (!hasUtm) return;
    const existingSession = window.localStorage.getItem("atlas_marketing_session");
    const sessionId = existingSession || crypto.randomUUID();
    window.localStorage.setItem("atlas_marketing_session", sessionId);
    const eventMatch = window.location.pathname.match(/^\/events\/([^/?#]+)/);
    const payload = {
      sessionId,
      eventId: eventMatch?.[1] ?? null,
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      content: params.get("utm_content"),
      term: params.get("utm_term"),
      landingPath: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || null,
    };
    document.cookie = `atlas_marketing=${encodeURIComponent(JSON.stringify(payload))}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    void fetch("/api/marketing/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
  }, []);
  return null;
}
