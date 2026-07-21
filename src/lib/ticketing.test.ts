import { describe, expect, it } from "vitest";
import { classifyTicket, orderNumber, ticketCode } from "./ticketing";
describe("ticket identity",()=>{it("creates non-sequential opaque codes",()=>{const a=ticketCode(),b=ticketCode();expect(a).not.toBe(b);expect(a.length).toBeGreaterThan(30)});it("creates readable unique orders",()=>expect(orderNumber()).toMatch(/^ATL-/));it("classifies missing tickets",()=>expect(classifyTicket()).toBe("NOT_FOUND"));});
