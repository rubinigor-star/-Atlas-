import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atlas-office-session";
const API_BASE_URL = "https://www.atlas-one.co";

export type MobileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffRole: string | null;
  jobTitle?: string | null;
  organization?: { id: string; name: string } | null;
  permissions?: string[];
  eventIds?: string[];
};

export type DashboardPayload = {
  user: MobileUser;
  summary: { revenueMinor: number; paidOrders: number; pendingRequests: number; activeEvents: number };
  events: Array<{
    id: string;
    title: string;
    startsAt: string;
    venue: { name: string; city: string };
    posterUrl: string | null;
    published: boolean;
    salesMode: string;
    mapEnabled: boolean;
    sold: number;
    capacity: number;
    checkedIn: number;
    checkInOpensAt: string;
    checkInClosesAt: string;
    checkInOpen: boolean;
    status: "PAST" | "PUBLISHED" | "DRAFT";
  }>;
  recentOrders: Array<{
    id: string;
    publicId: string;
    customerName: string;
    totalMinor: number;
    status: string;
    ticketCount: number;
    createdAt: string;
    event: { id: string; title: string };
  }>;
};

export type OperationGroup = "pending" | "approved" | "cancelled" | "abandoned";

export type EventOperationOrder = {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalMinor: number;
  currency: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  ticketCount: number;
  categories: Array<{ name: string; quantity: number; unitPriceMinor: number }>;
  usedTickets: number;
};

export type EventOperationsPayload = {
  event: {
    id: string;
    title: string;
    startsAt: string;
    posterUrl: string | null;
    venue: { name: string; city: string };
    revenueMinor: number;
    checkedIn: number;
  };
  counts: Record<OperationGroup, number>;
  group: OperationGroup;
  orders: EventOperationOrder[];
};

export type TicketValidationPayload = {
  result: "VALID" | "USED" | "CANCELLED" | "NOT_FOUND";
  ticketId?: string;
  eventId?: string;
  holderName?: string;
  categoryName?: string;
  event?: { id: string; title: string } | null;
};

async function request<T>(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error("[Atlas API] network failure", { url, error });
    throw new Error("NETWORK_ERROR");
  }

  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    console.error("[Atlas API] non-JSON response", { url, status: response.status, preview: raw.slice(0, 300) });
  }

  if (!response.ok) {
    console.error("[Atlas API] request failed", { url, status: response.status, body, preview: raw.slice(0, 300) });
    if (response.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
    const error = new Error(typeof body.error === "string" ? body.error : `HTTP_${response.status}`);
    Object.assign(error, { status: response.status, payload: body });
    throw error;
  }

  return body as T;
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: MobileUser }>("/api/mobile/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, result.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return result.user;
}

export async function currentUser() {
  return request<{ user: MobileUser }>("/api/mobile/auth/me").then((result) => result.user);
}

export async function getDashboard() {
  return request<DashboardPayload>("/api/mobile/dashboard");
}

export async function getEventOperations(eventId: string, group: OperationGroup = "pending") {
  return request<EventOperationsPayload>(`/api/mobile/events/${encodeURIComponent(eventId)}/operations?status=${group}`);
}

export async function validateTicket(eventId: string, code: string) {
  return request<TicketValidationPayload>("/api/mobile/tickets/validate", {
    method: "POST",
    body: JSON.stringify({ eventId, code }),
  });
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
