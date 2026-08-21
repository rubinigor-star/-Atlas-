import type { ReactNode } from "react";

export default function SeatSelectionLayout({ children }: { children: ReactNode }) {
  return <>
    <style>{`
      /* The public seat-map geometry is physical, not logical. Hebrew should
         change text direction, not mirror the map/sidebar/header composition. */
      body.atlas-seat-selection-active {
        direction: ltr !important;
      }

      html[dir="rtl"] body.atlas-seat-selection-active .atlas-site-header,
      html[dir="rtl"] body.atlas-seat-selection-active .atlas-header-shell {
        direction: ltr !important;
      }

      html[dir="rtl"] body.atlas-seat-selection-active .atlas-header-brand {
        justify-self: left !important;
      }

      html[dir="rtl"] body.atlas-seat-selection-active aside:has(> .atlas-checkout-button) {
        direction: rtl !important;
        text-align: right !important;
      }

      html[dir="rtl"] body.atlas-seat-selection-active a[class*="headerBack"] {
        direction: rtl !important;
        right: 28px !important;
        left: auto !important;
      }

      @media (min-width: 901px) {
        aside:has(> .atlas-checkout-button) {
          position: relative !important;
          height: 100% !important;
          min-height: 0 !important;
          padding-bottom: 136px !important;
          overflow: hidden !important;
        }

        aside:has(> .atlas-checkout-button) > .atlas-checkout-button {
          position: absolute !important;
          z-index: 20 !important;
          left: 18px !important;
          right: 18px !important;
          bottom: 66px !important;
          width: auto !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 auto !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
      }

      /* Price labels and slider handles must share the exact same physical X anchor.
         The button itself is reduced to a zero-width anchor at its percentage stop,
         while the visible price is centered around that anchor. This avoids optical
         and RTL/intrinsic-width drift at intermediate and endpoint stations. */
      [class*="priceStops"] > button {
        width: 0 !important;
        min-width: 0 !important;
        padding-inline: 0 !important;
        overflow: visible !important;
        transform: none !important;
        text-align: center !important;
      }

      [class*="priceStops"] > button:hover {
        transform: none !important;
      }

      [class*="priceStops"] > button > b {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: max-content !important;
        transform: translateX(-50%) !important;
        text-align: center !important;
        direction: ltr !important;
        unicode-bidi: isolate !important;
      }

      @media (max-width: 900px) {
        aside:has(> .atlas-checkout-button) {
          display: flex !important;
        }

        html[dir="rtl"] body.atlas-seat-selection-active a[class*="headerBack"] {
          right: 14px !important;
          left: auto !important;
        }
      }
    `}</style>
    {children}
  </>;
}
