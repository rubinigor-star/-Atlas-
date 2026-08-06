"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./event-mobile-sticky-cta.module.css";

type Props = {
  label: string;
  targetId?: string;
};

export function EventMobileStickyCta({ label, targetId = "tickets" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const primaryButton = document.querySelector<HTMLAnchorElement>('a[href="#tickets"]');
    const footer = document.querySelector<HTMLElement>("footer");
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

  function goToTickets() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className={`${styles.wrap} ${visible ? styles.visible : ""}`} aria-hidden={!visible}>
    <button type="button" className={styles.button} onClick={goToTickets} tabIndex={visible ? 0 : -1}>
      <span className={styles.icon}><ArrowUpRight size={22}/></span>
      <span className={styles.label}>{label}</span>
    </button>
  </div>;
}
