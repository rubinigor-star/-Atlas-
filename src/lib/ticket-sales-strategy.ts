export type TicketSalesStrategy = "STANDARD" | "BUY_ONE_GET_ONE";

const MARKER = /\n?<!--ATLAS_TICKET_SALES_STRATEGY:(STANDARD|BUY_ONE_GET_ONE)-->/g;

export function parseTicketSalesStrategy(description?: string | null): TicketSalesStrategy {
  if (!description) return "STANDARD";
  const matches = [...description.matchAll(MARKER)];
  return (matches.at(-1)?.[1] as TicketSalesStrategy | undefined) ?? "STANDARD";
}

export function stripTicketSalesStrategy(description?: string | null) {
  return (description || "").replace(MARKER, "").trim();
}

export function withTicketSalesStrategy(description: string | null | undefined, strategy: TicketSalesStrategy) {
  const clean = stripTicketSalesStrategy(description);
  return `${clean}${clean ? "\n" : ""}<!--ATLAS_TICKET_SALES_STRATEGY:${strategy}-->`;
}

export function ticketPackageSize(strategy: TicketSalesStrategy) {
  return strategy === "BUY_ONE_GET_ONE" ? 2 : 1;
}

export function ticketPackageCount(physicalQuantity: number, strategy: TicketSalesStrategy) {
  const size = ticketPackageSize(strategy);
  if (!Number.isInteger(physicalQuantity) || physicalQuantity < 1 || physicalQuantity % size !== 0) {
    throw new Error(strategy === "BUY_ONE_GET_ONE" ? "Для билета 1+1 нужно выбрать чётное количество билетов" : "Некорректное количество билетов");
  }
  return physicalQuantity / size;
}

export function salesStrategySubtotal(bundlePriceMinor: number, physicalQuantity: number, strategy: TicketSalesStrategy) {
  return bundlePriceMinor * ticketPackageCount(physicalQuantity, strategy);
}
