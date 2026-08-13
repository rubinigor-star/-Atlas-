import type { ReactNode } from "react";

export default function SeatSelectionLayout({ children }: { children: ReactNode }) {
  return <>
    <style>{`
      @media (min-width: 901px) {
        aside:has(> .atlas-checkout-button) {
          padding-bottom: 34px !important;
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
