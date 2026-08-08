import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";

function required(name: "HYP_MASOF" | "HYP_API_KEY" | "HYP_PASSP") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  try {
    const origin = new URL(req.url).origin;
    const params = new URLSearchParams({
      action: "APISign",
      What: "SIGN",
      KEY: required("HYP_API_KEY"),
      PassP: required("HYP_PASSP"),
      Masof: required("HYP_MASOF"),
      Amount: "1.00",
      Coin: "1",
      Info: "Atlas approval probe",
      Order: `ATLAS-PROBE-${Date.now()}`,
      ClientName: "Atlas",
      ClientLName: "Probe",
      PageLang: "HEB",
      UTF8: "True",
      UTF8out: "True",
      MoreData: "True",
      Sign: "True",
      Tash: "1",
      FixTash: "True",
      sendemail: "False",
      SendHesh: "False",
      Postpone: "True",
      J5: "True",
      tmp: process.env.HYP_TEMPLATE?.trim() || "1",
      ReturnUrl: `${origin}/api/payments/hyp/approval`,
      SuccessUrl: `${origin}/api/payments/hyp/approval`,
      ErrorUrl: `${origin}/api/payments/hyp/approval`,
      CancelUrl: `${origin}/api/payments/hyp/approval`,
    });

    const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
      headers: { "User-Agent": "Atlas-One-HYP-Probe/1.0", Accept: "text/plain, application/x-www-form-urlencoded, */*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.text()).trim();
    const parsed = new URLSearchParams(body.replace(/^\?/, ""));
    const code = parsed.get("CCode") || parsed.get("Error") || parsed.get("error") || "";
    const signature = parsed.get("signature") || "";

    return NextResponse.json({
      httpStatus: response.status,
      accepted: response.ok && (!code || code === "0" || code === "000") && Boolean(signature),
      responseCode: code || null,
      responseAction: parsed.get("action") || null,
      returnedJ5: parsed.get("J5") || null,
      returnedPostpone: parsed.get("Postpone") || null,
      hasSignature: Boolean(signature),
      returnedKeys: Array.from(parsed.keys()).filter((key) => !["KEY", "PassP", "signature"].includes(key)),
    });
  } catch (error) {
    return NextResponse.json({ accepted: false, error: error instanceof Error ? error.message : "probe-failed" }, { status: 500 });
  }
}
