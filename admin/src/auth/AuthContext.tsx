import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api, ApiError, tokens } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(tokens.hasSession);

  // if we were logged in before, check the session is still good
  useEffect(() => {
    tokens.onLoggedOut(() => setUser(null));
    if (!tokens.hasSession) return;
    api
      .get<{ user: User }>("/api/users/me")
      .then(({ user }) => {
        if (user.role === "ADMIN") setUser(user);
        else tokens.clear();
      })
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const data = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      "/api/users/login",
      { phone, password }
    );
    if (data.user.role !== "ADMIN") {
      // log this session out again so the token is not left lying around
      await fetch("/api/users/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: data.refreshToken }),
      }).catch(() => {});
      throw new ApiError(403, "This account is not an admin");
    }
    tokens.save(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokens.refresh;
    if (refreshToken) {
      await api.post("/api/users/logout", { refreshToken }).catch(() => {});
    }
    tokens.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
