import { describe, expect, it } from "vitest";
import { classifyTicket, describeCategoryPrice, effectiveTicketPrice, initialOrderStatus, orderNumber, seatingSelectionTotal, ticketCode } from "./ticketing";

describe("ticket identity", () => {
  it("creates non-sequential opaque codes", () => {
    const first = ticketCode();
    const second = ticketCode();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(30);
  });

  it("creates readable unique orders", () => expect(orderNumber()).toMatch(/^ATL-/));
  it("classifies missing tickets", () => expect(classifyTicket()).toBe("NOT_FOUND"));
});

describe("per-event sales mode", () => {
  it("issues instant orders as paid", () => expect(initialOrderStatus("INSTANT")).toBe("PAID"));
  it("holds moderated orders for review", () =>
    expect(initialOrderStatus("APPROVAL_REQUIRED")).toBe("PENDING_APPROVAL"));
});

describe("venue seating prices", () => {
  it("charges one fixed price for a whole table or sofa", () =>
    expect(seatingSelectionTotal("WHOLE_TABLE", 189000, 6)).toBe(189000));
  it("charges each selected chair when sold per seat", () =>
    expect(seatingSelectionTotal("PER_SEAT", 34900, 3)).toBe(104700));
  it("does not accept an empty chair selection", () =>
    expect(() => seatingSelectionTotal("PER_SEAT", 34900, 0)).toThrow());
});

describe("scheduled ticket pricing", () => {
  const salesStart = new Date("2026-07-01T00:00:00Z");
  const salesEnd = new Date("2026-09-01T00:00:00Z");
  it("uses the active scheduled tier", () => expect(effectiveTicketPrice({ priceMinor: 20000, pricingMode: "SCHEDULED", salesStart, salesEnd, priceTiers: [{ priceMinor: 12000, startsAt: salesStart, endsAt: new Date("2026-08-01T00:00:00Z") }, { priceMinor: 20000, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: salesEnd }] }, new Date("2026-07-15T00:00:00Z"))).toBe(12000));
  it("rejects a ticket outside its sale period", () => expect(() => effectiveTicketPrice({ priceMinor: 20000, pricingMode: "FIXED", salesStart, salesEnd, priceTiers: [] }, new Date("2026-09-02T00:00:00Z"))).toThrow("завершены"));
});

describe("admin price summary", () => {
  const salesStart = new Date("2026-07-01T00:00:00Z");
  const salesEnd = new Date("2026-09-01T00:00:00Z");
  const earlyEnd = new Date("2026-08-01T00:00:00Z");
  const tiers = [
    { priceMinor: 12000, startsAt: salesStart, endsAt: earlyEnd },
    { priceMinor: 20000, startsAt: earlyEnd, endsAt: salesEnd },
  ];

  it("reports the live tier price and the upcoming change for a scheduled category", () => {
    const result = describeCategoryPrice({ priceMinor: 20000, pricingMode: "SCHEDULED", salesStart, salesEnd, priceTiers: tiers }, new Date("2026-07-15T00:00:00Z"));
    expect(result.currentPriceMinor).toBe(12000);
    expect(result.scheduled).toBe(true);
    expect(result.nextTier?.priceMinor).toBe(20000);
    expect(result.nextTier?.startsAt).toEqual(earlyEnd);
  });

  it("never throws, returning a status label instead when there is no active price", () => {
    const result = describeCategoryPrice({ priceMinor: 20000, pricingMode: "FIXED", salesStart, salesEnd, priceTiers: [] }, new Date("2026-09-02T00:00:00Z"));
    expect(result.currentPriceMinor).toBeNull();
    expect(result.statusLabel).toContain("завершены");
  });

  it("reports a plain fixed price with no upcoming change", () => {
    const result = describeCategoryPrice({ priceMinor: 20000, pricingMode: "FIXED", salesStart, salesEnd, priceTiers: [] }, new Date("2026-07-15T00:00:00Z"));
    expect(result.currentPriceMinor).toBe(20000);
    expect(result.scheduled).toBe(false);
    expect(result.nextTier).toBeUndefined();
  });
});
