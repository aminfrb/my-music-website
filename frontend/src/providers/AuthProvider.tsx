"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  gql,
  setTokens,
} from "@/lib/graphql";
import { LOGIN, LOGOUT, ME, REGISTER } from "@/lib/queries";
import type { AuthPayload, User } from "@/lib/types";

interface RegisterArgs {
  email: string;
  displayName: string;
  password: string;
  mobileNumber?: string;
  locale?: "en" | "fa";
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (args: RegisterArgs) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await gql<{ me: User | null }>(ME);
      setUser(data.me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await gql<{ login: AuthPayload }>(LOGIN, {
        input: { email, password },
      });
      setTokens(data.login.accessToken, data.login.refreshToken);
      setUser(data.login.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (args: RegisterArgs) => {
      const data = await gql<{ register: AuthPayload }>(REGISTER, {
        input: args,
      });
      setTokens(data.register.accessToken, data.register.refreshToken);
      setUser(data.register.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await gql(LOGOUT, { refreshToken });
    } catch {
      /* ignore network errors on logout */
    }
    clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshMe: loadMe,
    }),
    [user, loading, login, register, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
