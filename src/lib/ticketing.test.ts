import { describe, expect, it } from "vitest";
import { classifyTicket, initialOrderStatus, orderNumber, ticketCode } from "./ticketing";

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
