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
function authHeaders(): Record<string, string> {
  try {
    const raw = retrieveRawInitData();
    return raw ? { "X-Telegram-Init-Data": raw } : {};
  } catch {
    // Поза Telegram і без моку initData немає — публічні ендпоінти все одно працюють
    return {};
  }
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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
