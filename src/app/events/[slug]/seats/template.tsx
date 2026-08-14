import type { ReactNode } from "react";
import SeatMapTopLock from "./seat-map-top-lock";

export default function SeatSelectionTemplate({ children }: { children: ReactNode }) {
  return <>
    <SeatMapTopLock />
    {children}
  </>;
}
