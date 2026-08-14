import type { ReactNode } from "react";

export default function SeatSelectionLayout({ children }: { children: ReactNode }) {
  return <>
    <style>{`
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

      @media (max-width: 900px) {
        aside:has(> .atlas-checkout-button) {
          display: flex !important;
        }
      }
    `}</style>
    {children}
  </>;
}
