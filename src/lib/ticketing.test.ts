import { describe, expect, it } from "vitest";
import { classifyTicket, initialOrderStatus, orderNumber, seatingSelectionTotal, ticketCode } from "./ticketing";

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
