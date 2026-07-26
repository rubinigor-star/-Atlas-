import { randomBytes } from "crypto";

export function orderNumber() {
  return `ATL-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function ticketCode() {
  return `ATLAS_${randomBytes(24).toString("base64url")}`;
}

export type TicketState = "VALID" | "USED" | "CANCELLED" | "NOT_FOUND";

export function classifyTicket(status?: "VALID" | "USED" | "CANCELLED"): TicketState {
  return status ?? "NOT_FOUND";
}

export function initialOrderStatus(salesMode: "INSTANT" | "APPROVAL_REQUIRED") {
  return salesMode === "APPROVAL_REQUIRED" ? "PENDING_APPROVAL" : "PAID";
}

export function seatingSelectionTotal(
  priceMode: "WHOLE_TABLE" | "PER_SEAT",
  priceMinor: number,
  selectedSeatCount: number,
) {
  if (!Number.isInteger(priceMinor) || priceMinor <= 0) throw new Error("Invalid seating price");
  if (!Number.isInteger(selectedSeatCount) || selectedSeatCount <= 0) throw new Error("Select at least one seat");
  return priceMode === "WHOLE_TABLE" ? priceMinor : priceMinor * selectedSeatCount;
}

type PriceTier = { label?: string; priceMinor: number; startsAt: Date; endsAt: Date };
type PriceCategory = { priceMinor: number; pricingMode: "FIXED" | "SCHEDULED"; salesStart: Date | null; salesEnd: Date | null; priceTiers: PriceTier[] };

export function effectiveTicketPrice(category: PriceCategory, now = new Date()) {
  if (category.salesStart && now < category.salesStart) throw new Error("Продажи этого тарифа ещё не начались");
  if (category.salesEnd && now >= category.salesEnd) throw new Error("Продажи этого тарифа завершены");
  if (category.pricingMode === "FIXED") return category.priceMinor;
  const tier = category.priceTiers.find((item) => now >= item.startsAt && now < item.endsAt);
  if (!tier) throw new Error("Для текущего времени цена тарифа не настроена");
  return tier.priceMinor;
}

export function ticketPricePresentation(category: PriceCategory, now = new Date()) {
  const sorted = [...category.priceTiers].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  if (category.pricingMode === "FIXED") return { stageLabel: "Текущая цена", nextPriceMinor: null, nextAt: null };
  const index = sorted.findIndex((item) => now >= item.startsAt && now < item.endsAt);
  if (index < 0) return { stageLabel: "Текущий этап", nextPriceMinor: null, nextAt: null };
  const current = sorted[index];
  const next = sorted[index + 1];
  return {
    stageLabel: current.label || `Этап ${index + 1}`,
    nextPriceMinor: next?.priceMinor ?? null,
    nextAt: next?.startsAt.toISOString() ?? null,
  };
}
