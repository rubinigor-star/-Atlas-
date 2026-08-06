"use client";

import { useEffect } from "react";
import styles from "./public-sold-out.module.css";

type SoldOutPayload = { slugs?: string[] };

export function PublicSoldOutDecorator() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function decorate(slugs: Set<string>) {
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/events/"]');
      links.forEach((link) => {
        const slug = link.getAttribute("href")?.split("/events/")[1]?.split(/[?#]/)[0] ?? "";
        if (!slug || !slugs.has(slug) || !link.querySelector("img")) return;
        link.classList.add(styles.event);
        if (!link.querySelector(`.${styles.label}`)) {
          const label = document.createElement("span");
          label.className = styles.label;
          label.textContent = "SOLD OUT";
          link.appendChild(label);
        }
      });
    }

    fetch("/api/events/sold-out", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<SoldOutPayload> : Promise.reject(new Error("Sold-out request failed")))
      .then((payload) => {
        if (cancelled) return;
        const slugs = new Set(payload.slugs ?? []);
        decorate(slugs);
        observer = new MutationObserver(() => decorate(slugs));
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
