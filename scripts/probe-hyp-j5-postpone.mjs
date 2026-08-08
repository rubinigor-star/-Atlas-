const endpoint = "https://pay.hyp.co.il/p/";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} missing`);
  return value;
}

if (process.env.VERCEL_ENV !== "preview") {
  console.log("[Atlas HYP J5 probe] skipped outside preview");
  process.exit(0);
}

const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.atlas-one.co";
const params = new URLSearchParams({
  action: "APISign",
  What: "SIGN",
  KEY: required("HYP_API_KEY"),
  PassP: required("HYP_PASSP"),
  Masof: required("HYP_MASOF"),
  Amount: "1.00",
  Coin: "1",
  Info: "Atlas approval build probe",
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

try {
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { "User-Agent": "Atlas-One-HYP-Build-Probe/1.0", Accept: "text/plain, application/x-www-form-urlencoded, */*" },
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.text()).trim();
  const parsed = new URLSearchParams(body.replace(/^\?/, ""));
  const code = parsed.get("CCode") || parsed.get("Error") || parsed.get("error") || "";
  const accepted = response.ok && (!code || code === "0" || code === "000") && Boolean(parsed.get("signature"));
  console.log("[Atlas HYP J5 probe]", JSON.stringify({
    httpStatus: response.status,
    accepted,
    responseCode: code || null,
    action: parsed.get("action") || null,
    returnedJ5: parsed.get("J5") || null,
    returnedPostpone: parsed.get("Postpone") || null,
    hasSignature: Boolean(parsed.get("signature")),
    keys: Array.from(parsed.keys()).filter((key) => !["KEY", "PassP", "signature"].includes(key)),
  }));
  if (!accepted) process.exitCode = 2;
} catch (error) {
  console.error("[Atlas HYP J5 probe] failed", error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
