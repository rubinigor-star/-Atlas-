export type MarketingChannel = "EMAIL" | "SMS" | "WHATSAPP";
export type ConsentStatus = "UNKNOWN" | "GRANTED" | "REVOKED";

export type MarketingEligibilityInput = {
  consentStatus: ConsentStatus;
  suppressed: boolean;
  hasContact: boolean;
  contactValid: boolean;
};

export type MarketingEligibilityResult =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "NO_CONTACT"
        | "INVALID_CONTACT"
        | "NO_CONSENT"
        | "CONSENT_REVOKED"
        | "SUPPRESSED";
    };

/**
 * Fail-closed marketing eligibility.
 * Purchase history is deliberately not part of this decision: buying a ticket
 * never creates marketing consent. Transactional messages use a separate flow.
 */
export function evaluateMarketingEligibility(
  input: MarketingEligibilityInput,
): MarketingEligibilityResult {
  if (!input.hasContact) return { eligible: false, reason: "NO_CONTACT" };
  if (!input.contactValid) return { eligible: false, reason: "INVALID_CONTACT" };
  if (input.suppressed) return { eligible: false, reason: "SUPPRESSED" };
  if (input.consentStatus === "REVOKED") {
    return { eligible: false, reason: "CONSENT_REVOKED" };
  }
  if (input.consentStatus !== "GRANTED") {
    return { eligible: false, reason: "NO_CONSENT" };
  }
  return { eligible: true };
}

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizePhone(value: string | null | undefined) {
  return value?.replace(/[^\d+]/g, "") ?? "";
}

export function marketingIdentityKey(input: {
  guestId?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  if (input.guestId) return `guest:${input.guestId}`;
  const phone = normalizePhone(input.phone);
  if (phone) return `phone:${phone}`;
  return `email:${normalizeEmail(input.email)}`;
}
