import { retrieveRawInitData } from "@telegram-apps/sdk-react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** Помилка з HTTP-статусом — щоб UI міг відрізнити 401 від 404 і мережевого збою. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

/**
 * Бекенд не має окремої авторизації: особу він дістає з підписаного initData.
 * Тож заголовок чіпляємо до кожного запиту — публічні ендпоінти його просто ігнорують.
 */
export function getRawInitData(): string | null {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return null;
  }
  try {
    const raw = retrieveRawInitData();
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tg?.initData) return tg.initData;
  }
  return null;
}

export function hasTelegramAuth(): boolean {
  return Boolean(getRawInitData());
}

export const ADMIN_TOKEN_KEY = "doma_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function removeAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminAuth(): boolean {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return Boolean(getAdminToken());
  }
  return Boolean(getAdminToken()) || hasTelegramAuth();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = getRawInitData();
  if (raw) {
    headers["X-Telegram-Init-Data"] = raw;
  }
  const adminToken = getAdminToken();
  if (adminToken) {
    headers["X-Admin-Token"] = adminToken;
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // FastAPI віддає помилку як {"detail": "..."} або як список помилок валідації
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {
      /* тіло не JSON — лишаємо статус */
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
