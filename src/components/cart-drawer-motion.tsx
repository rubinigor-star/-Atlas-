"use client";

import { useEffect } from "react";

const CLOSE_MS = 430;

export function CartDrawerMotion() {
  useEffect(() => {
    let closing = false;

    const beginClose = (overlay: HTMLElement) => {
      if (closing || overlay.dataset.cartClosing === "true") return;
      closing = true;
      overlay.dataset.cartClosing = "true";
      const panel = overlay.querySelector<HTMLElement>(".atlas-cart-panel");
      if (panel) panel.dataset.cartClosing = "true";

      window.setTimeout(() => {
        const closeButton = overlay.querySelector<HTMLButtonElement>(".atlas-cart-panel-head > button");
        if (closeButton) {
          closeButton.dataset.cartMotionBypass = "true";
          closeButton.click();
        }
        closing = false;
      }, CLOSE_MS);
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const closeButton = target?.closest<HTMLButtonElement>(".atlas-cart-panel-head > button");
      if (!closeButton) return;
      if (closeButton.dataset.cartMotionBypass === "true") {
        delete closeButton.dataset.cartMotionBypass;
        return;
      }
      const overlay = closeButton.closest<HTMLElement>(".atlas-cart-overlay");
      if (!overlay) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      beginClose(overlay);
    };

    const onMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains("atlas-cart-overlay")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      beginClose(target);
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("mousedown", onMouseDownCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mousedown", onMouseDownCapture, true);
    };
  }, []);

  return null;
}
