import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";
const REQUEST_TIMEOUT_MS = 15_000;

type HypEnvName = "HYP_MASOF" | "HYP_API_KEY" | "HYP_PASSP";

function required(name: HypEnvName) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sanitizeBody(body: string) {
  const secrets = [process.env.HYP_API_KEY, process.env.HYP_PASSP, process.env.HYP_MASOF]
    .filter((value): value is string => Boolean(value));

  return secrets.reduce((safe, secret) => safe.split(secret).join("[REDACTED]"), body).slice(0, 4_000);
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const params = new URLSearchParams({
      action: "APISign",
      What: "SIGN",
      KEY: required("HYP_API_KEY"),
      PassP: required("HYP_PASSP"),
      Masof: required("HYP_MASOF"),
    });

    console.info("hyp_apisign_probe_started", {
      endpoint: HYP_ENDPOINT,
      action: "APISign",
      what: "SIGN",
      hasApiKey: true,
      hasPassP: true,
      hasMasof: true,
    });

    const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "text/plain,text/html,application/x-www-form-urlencoded,*/*",
        "User-Agent": "Atlas-One-HYP-Probe/1.0",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const rawBody = await response.text();
    const safeBody = sanitizeBody(rawBody);
    const location = response.headers.get("location");

    console.info("hyp_apisign_probe_completed", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      hasLocation: Boolean(location),
      durationMs: Date.now() - startedAt,
      bodyPreview: safeBody.slice(0, 500),
    });

    return NextResponse.json({
      ok: response.ok || (response.status >= 300 && response.status < 400),
      request: {
        endpoint: HYP_ENDPOINT,
        action: "APISign",
        what: "SIGN",
        credentialsPresent: {
          apiKey: true,
          passP: true,
          masof: true,
        },
      },
      response: {
        status: response.status,
        contentType: response.headers.get("content-type"),
        location: location ? "[PRESENT]" : null,
        body: safeBody,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HYP APISign error";
    console.error("hyp_apisign_probe_failed", {
      message,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
