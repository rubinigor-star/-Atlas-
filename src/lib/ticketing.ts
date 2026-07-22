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
