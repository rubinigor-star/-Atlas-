"use client";

import { useEffect, useState } from "react";
import { LiveViewerPressure } from "@/components/live-viewer-pressure";
import styles from "./event-mobile-sticky-cta.module.css";

type Props = {
  priceLabel: string;
  actionLabel: string;
  locale: "ru" | "en" | "he";
  targetId?: string;
  actionHref?: string;
};

export function EventMobileStickyCta({ priceLabel, actionLabel, locale, targetId = "tickets", actionHref }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const primaryButton = document.querySelector<HTMLAnchorElement>("[data-event-primary-cta]");
    const footer = document.querySelector<HTMLElement>("footer.atlas-footer") ?? document.querySelector<HTMLElement>("footer");
    if (!primaryButton) return;

    let passedPrimaryButton = false;
    let footerVisible = false;
    const sync = () => setVisible(passedPrimaryButton && !footerVisible);

    const primaryObserver = new IntersectionObserver(([entry]) => {
      passedPrimaryButton = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
      sync();
    }, { threshold: 0 });
    primaryObserver.observe(primaryButton);

    let footerObserver: IntersectionObserver | null = null;
    if (footer) {
      footerObserver = new IntersectionObserver(([entry]) => {
        footerVisible = entry.isIntersecting;
        sync();
      }, { threshold: 0.01 });
      footerObserver.observe(footer);
    }

    return () => {
      primaryObserver.disconnect();
      footerObserver?.disconnect();
    };
  }, []);

  function act() {
    if (actionHref) {
      window.location.assign(actionHref);
      return;
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className={`${styles.wrap} ${visible ? styles.visible : ""}`} aria-hidden={!visible}>
    <div className={styles.viewer}><LiveViewerPressure locale={locale} /></div>
    <div className={styles.bar}>
      <strong className={styles.price}>{priceLabel}</strong>
      <button type="button" className={styles.button} onClick={act} tabIndex={visible ? 0 : -1}>{actionLabel}</button>
    </div>
  </div>;
}
