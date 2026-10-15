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

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

// a random id for one user action, e.g. one tap on "Place order".
// sent as Idempotency-Key so retries of that action never happen twice on the server
export const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

// stop waiting for a request that takes too long (very common on weak mobile networks)
const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// exponential backoff with jitter: wait ~0.3s, then ~1.2s, then ~4.8s
const backoff = (attempt: number) =>
  new Promise((r) => setTimeout(r, Math.random() * Math.min(5_000, 300 * 4 ** attempt)));

// the server is busy or restarting: worth trying again
const RETRY_STATUS = new Set([429, 502, 503, 504]);

interface RequestOptions {
  query?: Query;
  body?: unknown;
  idempotencyKey?: string;
}

const request = async <T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  retried = false
): Promise<T> => {
  // only retry what is safe to repeat: reads, and writes that carry an Idempotency-Key
  const canRetry = method === "GET" || !!options.idempotencyKey;
  let res: Response | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      res = await fetchWithTimeout(`${API_URL}${withQuery(path, options.query)}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (!canRetry || !RETRY_STATUS.has(res.status) || attempt === MAX_ATTEMPTS - 1) break;
    } catch {
      // no connection or timed out
      if (!canRetry || attempt === MAX_ATTEMPTS - 1) {
        throw new ApiError(0, "Can't reach Aynix. Check your internet connection and try again.");
      }
    }
    await backoff(attempt);
  }
  if (!res) throw new ApiError(0, "Can't reach Aynix. Check your internet connection and try again.");

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
  post: <T>(path: string, body?: unknown, opts: { idempotencyKey?: string } = {}) =>
    request<T>("POST", path, { body, ...opts }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
};

export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";
