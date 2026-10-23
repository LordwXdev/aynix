import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, refreshSession, session } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: { name: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  // after opening a store or applying to drive, the role changes:
  // get a fresh token that carries the new role
  reloadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    session.onLoggedOut(() => setUser(null));
    (async () => {
      if (await session.load()) {
        try {
          const { user } = await api.get<{ user: User }>("/api/users/me");
          setUser(user);
        } catch {
          await session.clear();
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const data = await api.post<AuthResponse>("/api/users/login", { phone, password });
    await session.save(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (input: { name: string; phone: string; password: string }) => {
    const data = await api.post<AuthResponse>("/api/users/register", input);
    await session.save(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session.refresh;
    if (refreshToken) await api.post("/api/users/logout", { refreshToken }).catch(() => {});
    await session.clear();
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    await refreshSession();
    const { user } = await api.get<{ user: User }>("/api/users/me");
    setUser(user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, reloadUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
