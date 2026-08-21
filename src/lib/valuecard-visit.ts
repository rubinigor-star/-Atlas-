import { db } from "@/lib/db";
import { getValueCardToken, searchValueCardMember } from "@/lib/valuecard";

type CommonInfo = {
  isError: boolean | null;
  returnCode: number | string | null;
  httpCode: number | string | null;
  message: string | null;
  printMessage: string | null;
};

export type ValueCardVisitResult =
  | { status: "COMMITTED"; memberId: number | null; cardNumber: string | null; queryTransactionId: number; transactionId: number | null }
  | { status: "SKIPPED"; reason: "NO_PHONE" | "INTEGRATION_DISABLED" | "NOT_MEMBER" | "NO_MEMBER_IDENTIFIER" }
  | { status: "FAILED"; reason: string };

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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function commonInfo(value: unknown): CommonInfo | null {
  const obj = objectValue(value);
  if (!obj) return null;
  const common = objectValue(obj.common ?? obj.Common);
  if (!common) return null;
  const asText = (input: unknown) => input === undefined || input === null ? null : String(input);
  return {
    isError: typeof (common.isError ?? common.IsError) === "boolean" ? Boolean(common.isError ?? common.IsError) : null,
    returnCode: (common.returnCode ?? common.ReturnCode ?? null) as number | string | null,
    httpCode: (common.httpCode ?? common.HttpCode ?? null) as number | string | null,
    message: asText(common.message ?? common.Message),
    printMessage: asText(common.printMessage ?? common.PrintMessage),
  };
}

function transactionIdFrom(value: unknown) {
  const obj = objectValue(value);
  if (!obj) return null;
  const raw = obj.transactionId ?? obj.TransactionId ?? obj.transactionID ?? obj.TransactionID;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function responseMemberCardNumber(value: unknown) {
  const obj = objectValue(value);
  if (!obj) return null;
  const raw = obj.memberCardNumber ?? obj.MemberCardNumber ?? obj.cardNumber ?? obj.CardNumber;
  return raw === undefined || raw === null || String(raw).trim() === "" ? null : String(raw).trim();
}

function bearer(token: string) {
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

async function postValueCard(token: string, path: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://valuecard.co.il/api${path}`, {
      method: "POST",
      headers: {
        Authorization: bearer(token),
        Accept: "application/json, text/plain",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? parsePayload(text) : null;
    const common = commonInfo(payload);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (common?.isError === true) throw new Error(common.printMessage || common.message || `ValueCard error ${common.returnCode ?? "unknown"}`);
    return { payload, common };
  } finally {
    clearTimeout(timer);
  }
}

export async function recordValueCardVisitForCustomer({
  organizationId,
  phone,
  referenceId,
  eventTitle,
}: {
  organizationId: string;
  phone?: string | null;
  referenceId: string;
  eventTitle?: string | null;
}): Promise<ValueCardVisitResult> {
  if (!phone?.trim()) return { status: "SKIPPED", reason: "NO_PHONE" };
  const token = await getValueCardToken(organizationId);
  if (!token) return { status: "SKIPPED", reason: "INTEGRATION_DISABLED" };
  const member = await searchValueCardMember(organizationId, phone);
  if (!member) return { status: "SKIPPED", reason: "NOT_MEMBER" };
  const clientIdentifier = member.cardNumber?.trim() || phone.replace(/\D/g, "");
  if (!clientIdentifier) return { status: "SKIPPED", reason: "NO_MEMBER_IDENTIFIER" };
  const transaction = { trans: [] as unknown[] };

  try {
    const query = await postValueCard(token, "/pos/benefits/GetBenefitsQuery", {
      clientIdentifier,
      transactionSum: 0,
      budgetToUse: -1,
      voidTransactionId: null,
      requestedPromoIds: [],
      transaction,
    });
    const queryTransactionId = transactionIdFrom(query.payload);
    if (!queryTransactionId) throw new Error("GetBenefitsQuery returned no transactionId");
    const queryCard = responseMemberCardNumber(query.payload);
    if (member.cardNumber && queryCard && queryCard !== member.cardNumber) {
      throw new Error(`ValueCard query member mismatch: expected card ${member.cardNumber}, got ${queryCard}`);
    }
    console.info("valuecard.visit.query", { referenceId, eventTitle, organizationId, memberId: member.memberId, memberCardNumber: member.cardNumber, queryTransactionId, common: query.common });

    const commit = await postValueCard(token, "/pos/benefits/GetBenefitsCommitQuery", {
      clientIdentifier,
      transactionSum: 0,
      queryTransactionId,
      transaction,
    });
    const transactionId = transactionIdFrom(commit.payload);
    const commitCard = responseMemberCardNumber(commit.payload);
    if (member.cardNumber && commitCard && commitCard !== member.cardNumber) {
      throw new Error(`ValueCard commit member mismatch: expected card ${member.cardNumber}, got ${commitCard}`);
    }
    console.info("valuecard.visit.commit", { referenceId, eventTitle, organizationId, memberId: member.memberId, memberCardNumber: member.cardNumber, queryTransactionId, transactionId, common: commit.common });
    return { status: "COMMITTED", memberId: member.memberId, cardNumber: member.cardNumber, queryTransactionId, transactionId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown ValueCard visit error";
    console.error("valuecard.visit.failed", { referenceId, organizationId, memberId: member.memberId, memberCardNumber: member.cardNumber, reason });
    return { status: "FAILED", reason };
  }
}

export async function recordValueCardVisitForTicket(ticketId: string): Promise<ValueCardVisitResult> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      order: {
        select: {
          publicId: true,
          customerPhone: true,
          event: { select: { organizationId: true, title: true } },
        },
      },
    },
  });
  if (!ticket) return { status: "SKIPPED", reason: "NO_PHONE" };
  return recordValueCardVisitForCustomer({
    organizationId: ticket.order.event.organizationId,
    phone: ticket.order.customerPhone,
    referenceId: ticket.order.publicId || ticketId,
    eventTitle: ticket.order.event.title,
  });
}
