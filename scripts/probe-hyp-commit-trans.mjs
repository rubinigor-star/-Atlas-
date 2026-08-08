const endpoint = "https://pay.hyp.co.il/p/";
if (process.env.VERCEL_ENV !== "preview") process.exit(0);
function required(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} missing`); return value; }
const params = new URLSearchParams({
  action: "commitTrans",
  Masof: required("HYP_MASOF"),
  PassP: required("HYP_PASSP"),
  TransId: "999999999999999999999999999999",
  Amount: "1.00",
  SendHesh: "True",
  UTF8: "True",
  UTF8out: "True",
  sendHeshSMS: "False",
  heshDesc: "Atlas safe commitTrans format probe",
});
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Atlas-One-HYP-Commit-Probe/1.0", Accept: "text/plain, application/x-www-form-urlencoded, application/json, */*" },
    body: params,
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.text()).trim();
  let parsed;
  try { parsed = new URLSearchParams(body.replace(/^\?/, "")); } catch { parsed = new URLSearchParams(); }
  const code = parsed.get("CCode") || parsed.get("Error") || parsed.get("error") || parsed.get("Code") || "";
  const msg = parsed.get("ErrMsg") || parsed.get("Message") || parsed.get("message") || "";
  console.log("[Atlas HYP commitTrans safe probe]", JSON.stringify({ httpStatus: response.status, hasStructuredResponse: parsed.size > 0, code: code || null, message: msg.slice(0,120) || null, responseKeys: Array.from(parsed.keys()).filter(k => k !== "PassP") }));
} catch (error) {
  console.log("[Atlas HYP commitTrans safe probe] transport-failed", error instanceof Error ? error.message : String(error));
}
