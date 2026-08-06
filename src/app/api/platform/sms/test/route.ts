import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getSms019ConfigurationStatus, sendSms019 } from "@/lib/sms-019";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ ok: true, configured: getSms019ConfigurationStatus() });
  } catch {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const phone = typeof payload.phone === "string" ? payload.phone : "";
  const message = typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : "Atlas One: SMS integration test completed successfully.";

  try {
    const result = await sendSms019({ phone, message, campaignName: "Atlas SMS integration test" });
    return NextResponse.json({
      ok: result.ok,
      providerHttpStatus: result.status,
      providerStatus: result.providerStatus ?? null,
      providerMessage: result.providerMessage ?? null,
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "SMS_SEND_FAILED",
    }, { status: 400 });
  }
}
