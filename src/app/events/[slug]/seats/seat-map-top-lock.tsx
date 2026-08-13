"use client";

import { useEffect } from "react";

function lockTop(element: HTMLElement) {
  const transform = element.style.transform;
  if (!transform) return;

  const translate3d = transform.match(/translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/i);
  if (translate3d) {
    const y = Number.parseFloat(translate3d[2]);
    if (y > 0) {
      element.style.transform = transform.replace(translate3d[0], `translate3d(${translate3d[1]}px, 0px, ${translate3d[3]}px)`);
    }
    return;
  }

  const translate = transform.match(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/i);
  if (translate) {
    const y = Number.parseFloat(translate[2]);
    if (y > 0) {
      element.style.transform = transform.replace(translate[0], `translate(${translate[1]}px, 0px)`);
    }
  }
}

export default function SeatMapTopLock() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let frame = 0;

    const attach = () => {
      const element = document.querySelector<HTMLElement>(".react-transform-component");
      if (!element) {
        frame = requestAnimationFrame(attach);
        return;
      }

      const enforce = () => lockTop(element);
      enforce();
      observer = new MutationObserver(enforce);
      observer.observe(element, { attributes: true, attributeFilter: ["style"] });
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return null;
}
