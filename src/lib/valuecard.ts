import { db } from "@/lib/db";
import { decryptIntegrationSecret } from "@/lib/integration-secrets";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";
import { hasOrganizerClubConsent } from "@/lib/checkout-consent";
import { getOrderDemographics } from "@/lib/customer-demographics";
import { enrichValueCardMemberMissingFields } from "@/lib/valuecard-member-enrichment";

type IntegrationRow = { enabled: boolean; credentialsEncrypted: string | null };
export type ValueCardMember = { memberId: number | null; cardNumber: string | null; fullName: string | null };
export type ValueCardRegistrationResult = { created: boolean; member: ValueCardMember | null; reason?: string; updatedFields?: string[] };

function phoneVariants(input: string) {
  const digits = input.replace(/\D/g, "");
  const values = new Set<string>();
  if (!digits) return [];
  values.add(digits);
  if (digits.startsWith("972") && digits.length >= 11) values.add(`0${digits.slice(3)}`);
  if (digits.startsWith("0")) values.add(`972${digits.slice(1)}`);
  return [...values];
}

function primaryPhone(input: string) {
  const variants = phoneVariants(input);
  return variants.find((value) => value.startsWith("0")) ?? variants[0] ?? input.replace(/\D/g, "");
}

function parsePayload(text: string): unknown {
  let payload: unknown = text;
  for (let i = 0; i < 2; i += 1) {
    if (typeof payload !== "string") break;
    const trimmed = payload.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"'))) break;
    try { payload = JSON.parse(trimmed); } catch { break; }
  }
  return payload;
}

function commonInfo(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const common = (obj.common ?? obj.Common) as Record<string, unknown> | undefined;
  if (!common || typeof common !== "object") return null;
  return {
    isError: common.isError ?? common.IsError ?? null,
    returnCode: common.returnCode ?? common.ReturnCode ?? null,
    httpCode: common.httpCode ?? common.HttpCode ?? null,
    message: common.message ?? common.Message ?? null,
    printMessage: common.printMessage ?? common.PrintMessage ?? null,
  };
}

function findMember(value: unknown): ValueCardMember | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMember(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const common = (obj.common ?? obj.Common) as Record<string, unknown> | undefined;
  if (common && (common.isError === true || common.IsError === true)) return null;
  const cardValue = obj.memberCardNumber ?? obj.MemberCardNumber ?? obj.cardNumber ?? obj.CardNumber ?? obj.cardNum ?? obj.CardNum;
  const explicitMemberId = obj.memberId ?? obj.MemberId ?? obj.memberID ?? obj.MemberID ?? obj.MemberKey ?? obj.memberKey ?? obj.clubMemberId ?? obj.ClubMemberId ?? obj.clubMemberID ?? obj.ClubMemberID;
  const contextualId = cardValue !== undefined ? (obj.id ?? obj.Id ?? obj.ID) : undefined;
  const idValue = explicitMemberId ?? contextualId;
  if (idValue !== undefined || cardValue !== undefined) {
    const parsed = typeof idValue === "number" ? idValue : Number(idValue);
    return {
      memberId: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      cardNumber: cardValue ? String(cardValue) : null,
      fullName: String(obj.memberFullName ?? obj.MemberFullName ?? obj.fullName ?? obj.FullName ?? obj.name ?? obj.Name ?? "") || null,
    };
  }
  for (const [key, nested] of Object.entries(obj)) {
    if (key.toLowerCase() === "common") continue;
    if (nested && typeof nested === "object") {
      const found = findMember(nested);
      if (found) return found;
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string | URL, init: RequestInit) {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      lastResponse = response;
      if (![429, 471, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
    } finally {
      clearTimeout(timer);
    }
    await sleep(500 * (attempt + 1));
  }
  if (lastResponse) return lastResponse;
  throw new Error("ValueCard request failed without response");
}

export async function getValueCardToken(organizationId: string) {
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`SELECT "enabled","credentialsEncrypted" FROM "OrganizationIntegration" WHERE "organizationId"=${organizationId} AND "provider"='VALUECARD' LIMIT 1`;
  const row = rows[0];
  if (!row?.enabled || !row.credentialsEncrypted) {
    console.info("valuecard.lookup.disabled", { organizationId, enabled: Boolean(row?.enabled), configured: Boolean(row?.credentialsEncrypted) });
    return null;
  }
  return decryptIntegrationSecret(row.credentialsEncrypted);
}

export async function searchValueCardMember(organizationId: string, phone: string): Promise<ValueCardMember | null> {
  const token = await getValueCardToken(organizationId);
  if (!token) return null;
  const variants = phoneVariants(phone);
  for (let index = 0; index < variants.length; index += 1) {
    const cellPhone = variants[index];
    try {
      const url = new URL("https://valuecard.co.il/api/pos/club_member/SearchClubMember");
      url.searchParams.set("cellPhone", cellPhone);
      const response = await fetchWithRetry(url, {
        headers: { Authorization: token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`, Accept: "application/json, text/plain" },
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        console.info("valuecard.lookup.http_error", { organizationId, status: response.status, contentType, variant: index + 1 });
        continue;
      }
      const text = await response.text();
      if (!text) {
        console.info("valuecard.lookup.empty", { organizationId, status: response.status, contentType, variant: index + 1 });
        continue;
      }
      const payload = parsePayload(text);
      const member = findMember(payload);
      const common = commonInfo(payload);
      console.info("valuecard.lookup.result", { organizationId, status: response.status, contentType, variant: index + 1, found: Boolean(member), hasMemberId: Boolean(member?.memberId), common });
      if (member) return member;
    } catch (error) {
      console.info("valuecard.lookup.exception", { organizationId, variant: index + 1, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return null;
}

export async function searchValueCardMembers(organizationId: string, phones: string[]) {
  const unique = [...new Set(phones.filter(Boolean))];
  const pairs: Array<readonly [string, ValueCardMember | null]> = [];
  for (const phone of unique) {
    pairs.push([phone, await searchValueCardMember(organizationId, phone)] as const);
    await sleep(200);
  }
  return new Map(pairs);
}

export async function registerValueCardMember(input: {
  organizationId: string;
  firstName: string;
  lastName: string;
  cellPhone: string;
  email?: string | null;
  birthDate?: Date | null;
  gender?: "MALE" | "FEMALE" | null;
  city?: string | null;
}) {
  const token = await getValueCardToken(input.organizationId);
  if (!token) throw new Error("ValueCard integration is not enabled or configured");
  const authToken = token;
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("ValueCard registration requires first and last name");
  const cellPhone = primaryPhone(input.cellPhone);
  if (!cellPhone) throw new Error("ValueCard registration requires cellphone");
  const basePayload = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: input.birthDate && input.birthDate.getUTCFullYear() > 1900 ? input.birthDate.toISOString() : null,
    anniversaryDate: null,
    phone: "",
    cellPhone,
    email: input.email?.trim() || "",
    address: input.city?.trim() || "",
    city: input.city?.trim() || "",
    zipCode: "",
    comments: "Registered via Atlas approved order",
    gender: input.gender === "MALE" ? 1 : input.gender === "FEMALE" ? 2 : 0,
    clientIdentifier: null,
    marcomApproval: 1,
    registrationCode: null,
    termsConsent: 1,
    memberClassId: 0,
    extIdentifier: null,
    extField1: null,
    extField2: null,
    extField3: null,
  };

  async function attemptRegistration(payload: typeof basePayload) {
    const response = await fetchWithRetry("https://valuecard.co.il/api/pos/club_member/RegisterClubMemberEx", {
      method: "POST",
      headers: {
        Authorization: authToken.toLowerCase().startsWith("bearer ") ? authToken : `Bearer ${authToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await response.text();
    const parsed = text ? parsePayload(text) : null;
    const common = commonInfo(parsed);
    const member = findMember(parsed);
    console.info("valuecard.register.result", { organizationId: input.organizationId, status: response.status, found: Boolean(member), common });
    return { response, common, member };
  }

  let result = await attemptRegistration(basePayload);
  const duplicateEmail = result.common?.isError === true && (
    String(result.common?.returnCode ?? "") === "-1036" ||
    String(result.common?.message ?? "").includes("דואר אלקטרוני כבר קיים") ||
    String(result.common?.printMessage ?? "").includes("דואר אלקטרוני כבר קיים")
  );
  if (duplicateEmail && basePayload.email) {
    console.info("valuecard.register.retry_without_email", { organizationId: input.organizationId });
    await sleep(350);
    result = await attemptRegistration({ ...basePayload, email: "" });
  }

  if (!result.response.ok) throw new Error(`ValueCard registration HTTP ${result.response.status}`);
  if (result.common?.isError === true) throw new Error(String(result.common.printMessage || result.common.message || `ValueCard error ${result.common.returnCode ?? "unknown"}`));
  if (!result.member?.memberId && !result.member?.cardNumber) throw new Error("ValueCard registration succeeded without member identifier");

  if (result.member.memberId && input.city?.trim()) {
    await sleep(250);
    await enrichValueCardMemberMissingFields({
      token: authToken,
      memberId: result.member.memberId,
      atlas: {
        firstName: input.firstName,
        lastName: input.lastName,
        cellPhone,
        email: duplicateEmail ? null : input.email,
        birthDate: input.birthDate,
        gender: input.gender,
        city: input.city,
      },
    });
  }

  return result.member;
}

export async function enrollApprovedOrderInValueCard(publicId: string): Promise<ValueCardRegistrationResult> {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { select: { organizationId: true } } } });
  if (!order || order.status !== "PAID") return { created: false, member: null, reason: "ORDER_NOT_PAID" };
  if (!order.customerPhone) return { created: false, member: null, reason: "NO_PHONE" };
  const token = await getValueCardToken(order.event.organizationId);
  if (!token) return { created: false, member: null, reason: "INTEGRATION_DISABLED" };

  const consent = await hasOrganizerClubConsent(order.id);
  const existing = await searchValueCardMember(order.event.organizationId, order.customerPhone);
  const firstName = (order.customerFirstName || order.customerName.split(/\s+/)[0] || "").trim();
  const lastName = (order.customerLastName || order.customerName.split(/\s+/).slice(1).join(" ") || "").trim();
  const demographics = await getOrderDemographics(order.id).catch(() => null);

  if (existing) {
    if (!consent) return { created: false, member: existing, reason: "ALREADY_MEMBER_NO_UPDATE_CONSENT" };
    if (!existing.memberId) return { created: false, member: existing, reason: "ALREADY_MEMBER_NO_MEMBER_ID" };
    const enrichment = await enrichValueCardMemberMissingFields({
      token,
      memberId: existing.memberId,
      atlas: {
        firstName,
        lastName,
        cellPhone: order.customerPhone,
        email: order.customerEmail,
        birthDate: demographics?.birthDate || order.customerBirthDate,
        gender: demographics?.gender || null,
        city: order.customerCity,
      },
    });
    return {
      created: false,
      member: existing,
      reason: enrichment.updated ? "MEMBER_PROFILE_ENRICHED" : "ALREADY_MEMBER_COMPLETE",
      updatedFields: enrichment.updatedFields,
    };
  }

  if (!consent) return { created: false, member: null, reason: "NO_ORGANIZER_CLUB_CONSENT" };
  if (!firstName || !lastName) return { created: false, member: null, reason: "MISSING_NAME" };
  const member = await registerValueCardMember({
    organizationId: order.event.organizationId,
    firstName,
    lastName,
    cellPhone: order.customerPhone,
    email: order.customerEmail,
    birthDate: demographics?.birthDate || order.customerBirthDate,
    gender: demographics?.gender || null,
    city: order.customerCity,
  });
  return { created: true, member };
}
