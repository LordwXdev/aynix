import { API_URL } from "./config";
import { secure } from "./storage";

const ACCESS = "aynix.access";
const REFRESH = "aynix.refresh";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onLoggedOut: () => void = () => {};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const session = {
  async load() {
    accessToken = await secure.get(ACCESS);
    refreshToken = await secure.get(REFRESH);
    return !!refreshToken;
  },
  async save(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await secure.set(ACCESS, access);
    await secure.set(REFRESH, refresh);
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await secure.set(ACCESS, null);
    await secure.set(REFRESH, null);
  },
  get access() {
    return accessToken;
  },
  get refresh() {
    return refreshToken;
  },
  onLoggedOut(handler: () => void) {
    onLoggedOut = handler;
  },
};

// only one refresh at a time: the backend treats a reused refresh token
// as stolen and logs the user out everywhere
let refreshing: Promise<boolean> | null = null;

export const refreshSession = (): Promise<boolean> => {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        await session.save(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
};

type Query = Record<string, string | number | boolean | undefined | null>;

const withQuery = (path: string, query?: Query) => {
  const parts = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `${path}?${parts.join("&")}` : path;
};

const request = async <T>(
  method: string,
  path: string,
  options: { query?: Query; body?: unknown } = {},
  retried = false
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${withQuery(path, options.query)}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach Aynix. Check your internet connection.");
  }

  // the short access token expired: get a new one and try again once
  if (res.status === 401 && !retried && refreshToken) {
    if (await refreshSession()) {
      return request<T>(method, path, options, true);
    }
    await session.clear();
    onLoggedOut();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Something went wrong");
  }
  return data as T;
};

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
};

export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";
