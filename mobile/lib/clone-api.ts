import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atlas-office-session";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://www.atlas-one.co").replace(/\/$/, "");

export type CloneEventInput = {
  sourceEventId: string;
  title: string;
  slug: string;
  startsAt: string;
  doorsOpenAt: string;
  salesStart: string;
  salesEnd: string;
  venueName: string;
  city: string;
  address: string;
  copyGuestLists: boolean;
  copyPromoters: boolean;
  copyPromoCodes: boolean;
  copyReferralLinks: boolean;
};

export async function cloneEventMobile(input: CloneEventInput) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/mobile/events/clone`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP_${response.status}`);
  return body as { id: string; categories: number; zones: number; promoterLinks: number; promoCodes: number; referralLinks: number };
}
