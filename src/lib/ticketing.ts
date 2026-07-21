import { randomBytes } from "crypto";
export function orderNumber(){ return `ATL-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`; }
export function ticketCode(){ return `ATLAS_${randomBytes(24).toString("base64url")}`; }
export type TicketState = "VALID"|"USED"|"CANCELLED"|"NOT_FOUND";
export function classifyTicket(status?: "VALID"|"USED"|"CANCELLED"):TicketState { return status ?? "NOT_FOUND"; }
