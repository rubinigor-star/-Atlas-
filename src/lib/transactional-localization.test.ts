import { describe, expect, it } from "vitest";
import { orderEmailCopy } from "@/lib/order-email";
import { cancellationCopy } from "@/lib/order-cancellation-email";
import { cancellationRequestCopy } from "@/lib/cancellation-request-email";
import { approvalRequestCopy } from "@/lib/order-status-email";
import { recoveryCopy, recoverySmsCopy } from "@/lib/recovery-channels";
import { ticketSmsCopy } from "@/lib/order-sms";
import { ticketCopy } from "@/lib/ticket-language";
import type { Locale } from "@/lib/i18n";

const surfaces = {
  ticketEmail: orderEmailCopy,
  cancellation: cancellationCopy,
  cancellationRequest: cancellationRequestCopy,
  approvalRequest: approvalRequestCopy,
  recovery: recoveryCopy,
  recoverySms: recoverySmsCopy,
  sms: ticketSmsCopy,
  ticket: ticketCopy,
};

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(strings);
}

describe("transactional localization leakage", () => {
  it("provides RU, HE and EN copy for every critical channel", () => {
    for (const dictionary of Object.values(surfaces)) {
      expect(Object.keys(dictionary).sort()).toEqual(["en", "he", "ru"]);
    }
  });

  it("keeps Hebrew and English system copy free of Cyrillic", () => {
    for (const [name, dictionary] of Object.entries(surfaces)) {
      expect(strings(dictionary.he).join(" "), `${name} HE`).not.toMatch(/[\u0400-\u04ff]/);
      expect(strings(dictionary.en).join(" "), `${name} EN`).not.toMatch(/[\u0400-\u04ff\u0590-\u05ff]/);
    }
  });

  it("keeps Russian system copy free of accidental Hebrew", () => {
    for (const [name, dictionary] of Object.entries(surfaces)) {
      expect(strings(dictionary.ru).join(" "), `${name} RU`).not.toMatch(/[\u0590-\u05ff]/);
    }
  });

  it("requires a non-empty customer copy surface in every locale", () => {
    for (const dictionary of Object.values(surfaces)) {
      for (const locale of ["ru", "he", "en"] satisfies Locale[]) {
        expect(strings(dictionary[locale]).filter(Boolean).length).toBeGreaterThan(2);
      }
    }
  });
});
