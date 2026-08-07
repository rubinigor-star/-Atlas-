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

function clearAvailability(link: HTMLAnchorElement) {
  link.classList.remove(styles.availabilityLink, styles.soldOut, styles.lastTickets);
  link.removeAttribute("data-atlas-availability-label");
  link.removeAttribute("data-atlas-availability-state");
  link.removeAttribute("data-atlas-availability-dir");
}

export function PublicSoldOutDecorator() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function decorate(soldOutSlugs: Set<string>, lastTicketsSlugs: Set<string>) {
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/events/"]');
      const activeLocale = locale();

      links.forEach((link) => {
        const slug = link.getAttribute("href")?.split("/events/")[1]?.split(/[?#]/)[0] ?? "";
        const state: AvailabilityState | null = soldOutSlugs.has(slug)
          ? "soldOut"
          : lastTicketsSlugs.has(slug)
            ? "lastTickets"
            : null;

        if (!slug || !state || !link.querySelector("img")) {
          clearAvailability(link);
          return;
        }

        // Important: do not re-parent or insert nodes inside React-managed markup.
        // Client-side navigation relies on the DOM tree matching React's virtual tree.
        // Availability is therefore represented only by classes/data attributes and CSS.
        link.classList.add(styles.availabilityLink);
        link.classList.toggle(styles.soldOut, state === "soldOut");
        link.classList.toggle(styles.lastTickets, state === "lastTickets");
        link.setAttribute("data-atlas-availability-label", labels[activeLocale][state]);
        link.setAttribute("data-atlas-availability-state", state);
        link.setAttribute("data-atlas-availability-dir", state === "lastTickets" && activeLocale === "he" ? "rtl" : "ltr");
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
