import { describe, expect, it } from "vitest";
import { detectExternalTicketMapping, mapCsvRecordsToExternalTickets, parseCsv, parseOrganizerConsent } from "@/lib/external-ticket-csv";

describe("external ticket CSV", () => {
  it("parses semicolon files and quoted customer names", () => {
    const parsed = parseCsv('Barcode;Ticket ID;Name;Price\n"ABC-123";T-1;"Rubin, Igor";120.50\n');
    expect(parsed.delimiter).toBe(";");
    expect(parsed.headers).toEqual(["Barcode", "Ticket ID", "Name", "Price"]);
    expect(parsed.records[0]).toMatchObject({ Barcode: "ABC-123", "Ticket ID": "T-1", Name: "Rubin, Igor", Price: "120.50" });
  });

  it("detects a real barcode separately from external ticket id", () => {
    const mapping = detectExternalTicketMapping(["Ticket ID", "Barcode", "Name"]);
    expect(mapping.externalTicketId).toBe("Ticket ID");
    expect(mapping.scanCode).toBe("Barcode");
  });

  it("does not guess that Ticket ID is the QR payload", () => {
    const mapping = detectExternalTicketMapping(["Ticket ID", "Name", "Email"]);
    expect(mapping.externalTicketId).toBe("Ticket ID");
    expect(mapping.scanCode).toBeUndefined();
  });

  it("maps price to minor units and keeps the raw row as metadata", () => {
    const parsed = parseCsv("QR Code,Ticket Type,Price,Status\nQR-9,VIP,199.90,cancelled\n");
    const mapping = detectExternalTicketMapping(parsed.headers);
    const rows = mapCsvRecordsToExternalTickets(parsed.records, mapping);
    expect(rows[0]).toMatchObject({ scanCode: "QR-9", ticketType: "VIP", priceMinor: 19990, status: "CANCELLED" });
    expect(rows[0].metadata).toMatchObject({ "QR Code": "QR-9", "Ticket Type": "VIP" });
  });

  it("treats only explicit positive organizer consent as consent", () => {
    expect(parseOrganizerConsent("כן")).toBe(true);
    expect(parseOrganizerConsent("yes")).toBe(true);
    expect(parseOrganizerConsent("1")).toBe(true);
    expect(parseOrganizerConsent("לא")).toBe(false);
    expect(parseOrganizerConsent("")).toBe(false);
  });

  it("stores consent proof and first/last name in metadata", () => {
    const parsed = parseCsv("Barcode,שם פרטי,שם משפחה,נייד,אישור דיוור\nQR-1,Igor,Rubin,0501234567,כן\n");
    const mapping = detectExternalTicketMapping(parsed.headers);
    const rows = mapCsvRecordsToExternalTickets(parsed.records, mapping);
    expect(rows[0].holderName).toBe("Igor Rubin");
    expect(rows[0].metadata).toMatchObject({
      __atlasOrganizerConsent: true,
      __atlasConsentColumn: "אישור דיוור",
      __atlasFirstName: "Igor",
      __atlasLastName: "Rubin",
    });
  });
});
