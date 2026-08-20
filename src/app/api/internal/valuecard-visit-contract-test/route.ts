import { NextRequest, NextResponse } from "next/server";
import { getValueCardToken, searchValueCardMember } from "@/lib/valuecard";
import { db } from "@/lib/db";

const TOKEN = "valuecard-contract-20260820";
const TEST_PHONE = "0525565457";

function bearer(token: string) { return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`; }
function txId(payload: any) { const raw = payload?.transactionId ?? payload?.TransactionId ?? payload?.transactionID ?? payload?.TransactionID; const n = Number(raw); return Number.isFinite(n) && n > 0 ? n : null; }
async function post(token: string, path: string, body: unknown) {
  const response = await fetch(`https://valuecard.co.il/api${path}`, { method: "POST", headers: { Authorization: bearer(token), Accept: "application/json, text/plain", "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const text = await response.text();
  let payload: any = text;
  try { payload = JSON.parse(text); } catch {}
  return { status: response.status, ok: response.ok, payload };
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const event = await db.event.findUnique({ where: { slug: "scanner-test-20260820" }, select: { organizationId: true } });
  if (!event) return NextResponse.json({ error: "Scanner Test event not found" }, { status: 404 });
  const token = await getValueCardToken(event.organizationId);
  if (!token) return NextResponse.json({ error: "ValueCard integration disabled" }, { status: 409 });
  const member = await searchValueCardMember(event.organizationId, TEST_PHONE);
  if (!member) return NextResponse.json({ error: "Member not found", phone: TEST_PHONE }, { status: 404 });
  const clientIdentifier = TEST_PHONE;
  const transaction = { trans: [] };
  const query = await post(token, "/pos/benefits/GetBenefitsQuery", { clientIdentifier, transactionSum: 0, budgetToUse: -1, voidTransactionId: null, requestedPromoIds: [], transaction });
  const queryTransactionId = txId(query.payload);
  if (!query.ok || !queryTransactionId) return NextResponse.json({ stage: "query", member, query }, { status: 502 });
  const commit = await post(token, "/pos/benefits/GetBenefitsCommitQuery", { clientIdentifier, transactionSum: 0, queryTransactionId, transaction });
  return NextResponse.json({ stage: "commit", member, queryTransactionId, query, commit, transactionId: txId(commit.payload) });
}
