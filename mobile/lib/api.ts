import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atlas-office-session";
const apiBaseUrl = String(Constants.expoConfig?.extra?.apiBaseUrl || "").replace(/\/$/, "");

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

async function request<T>(path: string, options: RequestInit = {}) {
  if (!apiBaseUrl) throw new Error("API_URL_NOT_CONFIGURED");
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP_${response.status}`);
  return body as T;
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: MobileUser }>("/api/mobile/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, result.token);
  return result.user;
}

export async function currentUser() {
  return request<{ user: MobileUser }>("/api/mobile/auth/me").then((result) => result.user);
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
