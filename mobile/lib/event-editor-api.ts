import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atlas-office-session";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://www.atlas-one.co").replace(/\/$/, "");

export type EditorCategory = {
  id: string; name: string; description: string; priceMinor: number; pricingMode: "FIXED" | "SCHEDULED"; capacity: number; sold: number; hidden: boolean; colorHex: string; maxPerOrder: number;
  salesStart: string; salesEnd: string; priceTiers: Array<{ id: string; label: string; priceMinor: number; startsAt: string; endsAt: string }>;
  currentPriceMinor: number | null; statusLabel: string; nextTierPriceMinor: number | null; nextTierStartsAt: string | null;
  marketingStrategy: { intensity: "CALM" | "STANDARD" | "ACTIVE" | "MAXIMUM"; showCountdown: boolean; showNextPrice: boolean; showStageRemaining: boolean; showTotalRemaining: boolean; showSoldCount: boolean };
  salesStrategy: "STANDARD" | "BUY_ONE_GET_ONE";
};
export type EditorLayoutObject = {
  id: string; label: string; zoneName: string; objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT"; seats: number; priceMode: "WHOLE_TABLE" | "PER_SEAT"; priceMinor: number;
  x: number; y: number; rotation: number; width: number; height: number; categoryId: string | null; reserved: boolean; seatAssignments: Array<{ position: number; categoryId: string | null }>;
};
export type GuestFieldKey = "firstName" | "lastName" | "phone" | "email" | "birthDate" | "city" | "facebook" | "instagram";
export type GuestFields = Record<GuestFieldKey, { visible: boolean; required: boolean }>;
export type BuyerQuestion = { id: string; label: string; type: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX" | "PHONE" | "EMAIL" | "DATE"; required: boolean; placeholder?: string; options?: string[] };
export type EditorEvent = {
  id: string; title: string; description: string; posterUrl: string; startsAt: string; status: string; salesMode: string; mapEnabled: boolean;
  venue: { name: string; city: string; address: string };
  presentation: { shortDescription: string; ageRestriction: string; doorsOpenTime: string; runtimeMinutes: number; intermissionCount: number; galleryEnabled: boolean; galleryUrls: string[]; faqEnabled: boolean; faq: Array<{ question: string; answer: string }> };
  media: Array<{ type: "VIDEO" | "LINK"; url: string; title?: string }>;
  eventTypes: string[];
  language: { primaryLanguage: string; catalogVisibility: string };
};
export type EventEditorState = {
  event: EditorEvent;
  permissions: string[];
  tickets: { categories: EditorCategory[] };
  map: { enabled: boolean; name: string; objects: EditorLayoutObject[]; locked: boolean };
  checkout: {
    salesMode: "INSTANT" | "APPROVAL_REQUIRED"; approvalInstructions: string; rejectionMessage: string; guestFields: GuestFields; questions: BuyerQuestion[];
    commercial: { useOrganizerDefaults: boolean; serviceFeePayer: "BUYER" | "ORGANIZER"; organizerServiceFeePayer: "BUYER" | "ORGANIZER"; salesFeePercentBps: number; salesFeeFixedMinor: number };
  };
  review: { archived: boolean; status: "DRAFT" | "PUBLISHED"; slug: string; mapEnabled: boolean; categoryCount: number; sold: number; capacity: number };
};

async function request<T>(eventId: string, options?: RequestInit) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/mobile/events/${encodeURIComponent(eventId)}/editor`, {
      ...options,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP_${response.status}`);
  return body as T;
}

export function loadEventEditor(eventId: string) { return request<EventEditorState>(eventId); }
export function patchEventEditor(eventId: string, action: Record<string, unknown>) {
  return request<EventEditorState>(eventId, { method: "PATCH", body: JSON.stringify(action) });
}
