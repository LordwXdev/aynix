// talks to the Aynix backend
// keeps the tokens, adds them to every request, and refreshes them when they expire

const ACCESS_KEY = "aynix.admin.access";
const REFRESH_KEY = "aynix.admin.refresh";

// storage can be blocked (private mode), so never let it crash the app
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

let accessToken = store.get(ACCESS_KEY);
let refreshToken = store.get(REFRESH_KEY);
let onLoggedOut: () => void = () => {};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const tokens = {
  get access() {
    return accessToken;
  },
  get refresh() {
    return refreshToken;
  },
  get hasSession() {
    return !!refreshToken;
  },
  save(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    store.set(ACCESS_KEY, access);
    store.set(REFRESH_KEY, refresh);
  },
  clear() {
    accessToken = null;
    refreshToken = null;
    store.set(ACCESS_KEY, null);
    store.set(REFRESH_KEY, null);
  },
  onLoggedOut(handler: () => void) {
    onLoggedOut = handler;
  },
};

// only ONE refresh at a time: the backend treats a reused refresh token as theft
// and logs the user out everywhere, so parallel refreshes would kick us out
let refreshing: Promise<boolean> | null = null;

export const refreshSession = (): Promise<boolean> => {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch("/api/users/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokens.save(data.accessToken, data.refreshToken);
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

const buildUrl = (path: string, query?: Query) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const request = async <T>(
  method: string,
  path: string,
  options: { query?: Query; body?: unknown } = {},
  retried = false
): Promise<T> => {
  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  // access token expired: refresh once and try again
  if (res.status === 401 && !retried && refreshToken) {
    if (await refreshSession()) {
      return request<T>(method, path, options, true);
    }
    tokens.clear();
    onLoggedOut();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
};

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
};
