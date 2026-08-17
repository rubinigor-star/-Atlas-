import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function extract(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, error: "Preview only" }, { status: 404 });
  }

  const terminal = process.env.HYP_MASOF?.trim() || "";
  const user = process.env.HYP_API_KEY?.trim() || "";
  const password = process.env.HYP_PASSP?.trim() || "";
  if (!terminal || !user || !password) {
    return NextResponse.json({ ok: false, error: "Existing HYP variables are missing" }, { status: 500 });
  }

  const endpoint = "https://pay.hyp.co.il/xpo/Relay";
  const xml = `<ashrait><request><version>2000</version><language>Eng</language><dateTime/><requestId/><command>getSessionId</command><getSessionId><terminalNumber>${xmlEscape(terminal)}</terminalNumber></getSessionId></request></ashrait>`;
  const body = new URLSearchParams({ user, password, int_in: xml });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Atlas-One-HYP-XPO-Probe/1.0" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await response.text()).slice(0, 12000);
    const result = extract(text, "result");
    const message = extract(text, "message") || extract(text, "userMessage");
    const sessionId = extract(text, "sessionId");
    return NextResponse.json({
      ok: response.ok && (result === "000" || Boolean(sessionId)),
      httpStatus: response.status,
      result: result || null,
      message: message || null,
      hasSessionId: Boolean(sessionId),
      responseType: text.trim().startsWith("<") ? "xml" : "other",
      endpointHost: "pay.hyp.co.il",
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Probe failed", endpointHost: "pay.hyp.co.il" }, { status: 200 });
  }
}
