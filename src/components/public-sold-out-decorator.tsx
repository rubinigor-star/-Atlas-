"use client";

import { useEffect } from "react";
import styles from "./public-sold-out.module.css";

type AvailabilityPayload = {
  soldOutSlugs?: string[];
  lastTicketsSlugs?: string[];
};

type AvailabilityState = "soldOut" | "lastTickets";

const labels = {
  ru: { soldOut: "SOLD OUT", lastTickets: "ПОСЛЕДНИЕ БИЛЕТЫ" },
  he: { soldOut: "SOLD OUT", lastTickets: "כרטיסים אחרונים" },
  en: { soldOut: "SOLD OUT", lastTickets: "LAST TICKETS" },
} as const;

function locale() {
  const value = document.documentElement.lang.slice(0, 2);
  return value === "he" || value === "en" ? value : "ru";
}

export function PublicSoldOutDecorator() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function decorate(soldOutSlugs: Set<string>, lastTicketsSlugs: Set<string>) {
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/events/"]');
      links.forEach((link) => {
        const slug = link.getAttribute("href")?.split("/events/")[1]?.split(/[?#]/)[0] ?? "";
        const state: AvailabilityState | null = soldOutSlugs.has(slug)
          ? "soldOut"
          : lastTicketsSlugs.has(slug)
            ? "lastTickets"
            : null;
        if (!slug || !state) return;

        const image = link.querySelector<HTMLImageElement>("img");
        if (!image) return;

        let frame = image.closest<HTMLElement>(`.${styles.mediaFrame}`);
        if (!frame) {
          frame = document.createElement("span");
          frame.className = styles.mediaFrame;
          image.parentNode?.insertBefore(frame, image);
          frame.appendChild(image);
        }

        frame.classList.toggle(styles.soldOut, state === "soldOut");
        frame.classList.toggle(styles.lastTickets, state === "lastTickets");

        let label = frame.querySelector<HTMLElement>(`.${styles.label}`);
        if (!label) {
          label = document.createElement("span");
          label.className = styles.label;
          frame.prepend(label);
        }
        label.textContent = labels[locale()][state];
        label.setAttribute("dir", state === "lastTickets" && locale() === "he" ? "rtl" : "ltr");
      });
    }

    fetch("/api/events/sold-out", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<AvailabilityPayload> : Promise.reject(new Error("Availability request failed")))
      .then((payload) => {
        if (cancelled) return;
        const soldOutSlugs = new Set(payload.soldOutSlugs ?? []);
        const lastTicketsSlugs = new Set(payload.lastTicketsSlugs ?? []);
        decorate(soldOutSlugs, lastTicketsSlugs);
        observer = new MutationObserver(() => decorate(soldOutSlugs, lastTicketsSlugs));
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
