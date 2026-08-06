const SMS_019_ENDPOINT = "https://019sms.co.il/api";

export type Sms019Result = {
  ok: boolean;
  status: number;
  providerStatus?: string | number | null;
  providerMessage?: string | null;
  raw?: unknown;
};

function requiredEnv(name: "SMS_019_USERNAME" | "SMS_019_API_TOKEN" | "SMS_019_SOURCE") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSms019ConfigurationStatus() {
  return {
    username: Boolean(process.env.SMS_019_USERNAME?.trim()),
    token: Boolean(process.env.SMS_019_API_TOKEN?.trim()),
    source: Boolean(process.env.SMS_019_SOURCE?.trim()),
  };
}

export function normalizeIsraeliMobilePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("972")) local = `0${local.slice(3)}`;
  if (local.startsWith("5") && local.length === 9) local = `0${local}`;

  if (!/^05\d{8}$/.test(local)) {
    throw new Error("INVALID_ISRAELI_MOBILE_PHONE");
  }

  return local;
}

function parseProviderPayload(value: unknown) {
  if (!value || typeof value !== "object") return { status: null, message: null };
  const record = value as Record<string, unknown>;
  const candidate = (record.sms && typeof record.sms === "object" ? record.sms : record) as Record<string, unknown>;
  return {
    status: candidate.status ?? record.status ?? null,
    message: typeof (candidate.message ?? record.message) === "string" ? String(candidate.message ?? record.message) : null,
  };
}

export async function sendSms019({ phone, message, campaignName }: { phone: string; message: string; campaignName?: string }) {
  const username = requiredEnv("SMS_019_USERNAME");
  const token = requiredEnv("SMS_019_API_TOKEN");
  const source = requiredEnv("SMS_019_SOURCE");
  const destination = normalizeIsraeliMobilePhone(phone);
  const cleanMessage = message.trim();

  if (!cleanMessage) throw new Error("SMS_MESSAGE_REQUIRED");
  if (cleanMessage.length > 1005) throw new Error("SMS_MESSAGE_TOO_LONG");
  if (!/^[A-Za-z0-9]{1,11}$/.test(source)) throw new Error("INVALID_SMS_SOURCE");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(SMS_019_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sms: {
          user: { username },
          source,
          destinations: { phone: destination },
          message: cleanMessage,
          ...(campaignName ? { campaign_name: campaignName.slice(0, 50) } : {}),
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let raw: unknown = text;
    try { raw = text ? JSON.parse(text) : null; } catch {}

    const provider = parseProviderPayload(raw);
    const providerStatus = provider.status;
    const providerAccepted = providerStatus === null || providerStatus === 0 || providerStatus === "0" || providerStatus === "success" || providerStatus === "SUCCESS";

    return {
      ok: response.ok && providerAccepted,
      status: response.status,
      providerStatus,
      providerMessage: provider.message,
      raw,
    } satisfies Sms019Result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_SMS_ERROR";
    return { ok: false, status: 0, providerMessage: message } satisfies Sms019Result;
  } finally {
    clearTimeout(timeout);
  }
}
