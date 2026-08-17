import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CF_API = "https://api.cloudflare.com/client/v4";

type CfEnvelope<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
};

type TokenVerifyResult = {
  id?: string;
  status?: "active" | "disabled" | "expired" | string;
};

type ZoneResult = {
  id: string;
  name: string;
  status?: string;
};

function safeError(payload: CfEnvelope<unknown> | null, fallback: string) {
  const message = payload?.errors?.[0]?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export async function GET() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    return NextResponse.json(
      {
        connected: false,
        env: { token: Boolean(token), accountId: Boolean(accountId) },
        reason: "missing_environment_variables",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const verifyResponse = await fetch(`${CF_API}/accounts/${accountId}/tokens/verify`, {
      headers,
      cache: "no-store",
    });
    const verifyPayload = (await verifyResponse.json().catch(() => null)) as CfEnvelope<TokenVerifyResult> | null;

    if (!verifyResponse.ok || !verifyPayload?.success || verifyPayload.result?.status !== "active") {
      return NextResponse.json(
        {
          connected: false,
          env: { token: true, accountId: true },
          tokenStatus: verifyPayload?.result?.status ?? "invalid",
          reason: "token_verification_failed",
          detail: safeError(verifyPayload, `Cloudflare returned HTTP ${verifyResponse.status}`),
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const zonesUrl = new URL(`${CF_API}/zones`);
    zonesUrl.searchParams.set("per_page", "50");

    const zonesResponse = await fetch(zonesUrl, { headers, cache: "no-store" });
    const zonesPayload = (await zonesResponse.json().catch(() => null)) as CfEnvelope<ZoneResult[]> | null;

    if (!zonesResponse.ok || !zonesPayload?.success) {
      return NextResponse.json(
        {
          connected: false,
          env: { token: true, accountId: true },
          tokenStatus: verifyPayload.result?.status ?? "active",
          reason: "zone_access_failed",
          detail: safeError(zonesPayload, `Cloudflare returned HTTP ${zonesResponse.status}`),
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const zones = zonesPayload.result ?? [];

    return NextResponse.json(
      {
        connected: zones.length > 0,
        env: { token: true, accountId: true },
        tokenStatus: verifyPayload.result?.status ?? "active",
        zoneAccess: true,
        zoneCount: zones.length,
        zones: zones.map((zone) => ({ name: zone.name, status: zone.status ?? null })),
      },
      { status: zones.length > 0 ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Cloudflare connectivity check failed", error);
    return NextResponse.json(
      {
        connected: false,
        env: { token: true, accountId: true },
        reason: "request_failed",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
