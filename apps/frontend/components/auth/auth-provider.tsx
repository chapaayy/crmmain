"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { AuthSession, CurrentUser } from "@/lib/types";
import { useToast } from "@/components/toast/toast-provider";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  accessToken: string | null;
  api: ApiClient;
  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  hasPermission: (permission?: string) => boolean;
}

interface MeResponse {
  user: CurrentUser;
}

const SESSION_HINT_COOKIE = "crm_session_hint";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const bootstrapPromiseRef = useRef<Promise<boolean> | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const setSession = useCallback((session: AuthSession) => {
    accessTokenRef.current = session.accessToken;
    setUser(normalizeUser(session.user));
    setStatus("authenticated");
    setSessionHint();
  }, []);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setStatus("unauthenticated");
    clearSessionHint();
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    const client = new ApiClient(apiBaseUrl, {
      getAccessToken: () => token
    });
    const response = await client.request<MeResponse>("/auth/me");

    setUser(normalizeUser(response.user));
    return response.user;
  }, [apiBaseUrl]);

  const refreshAccessToken = useCallback(async () => {
    if (!apiBaseUrl) {
      clearSession();
      return null;
    }

    try {
      const client = new ApiClient(apiBaseUrl);
      const session = await client.publicRequest<AuthSession>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({})
      });

      accessTokenRef.current = session.accessToken;
      setSessionHint();
      await fetchMe(session.accessToken);
      setStatus("authenticated");

      return session.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [apiBaseUrl, clearSession, fetchMe]);

  const api = useMemo(
    () =>
      new ApiClient(apiBaseUrl, {
        getAccessToken: () => accessTokenRef.current,
        refreshAccessToken
      }),
    [apiBaseUrl, refreshAccessToken]
  );

  const bootstrap = useCallback(async () => {
    if (accessTokenRef.current && user) {
      setStatus("authenticated");
      return true;
    }

    if (bootstrapPromiseRef.current) {
      return bootstrapPromiseRef.current;
    }

    setStatus("loading");
    bootstrapPromiseRef.current = refreshAccessToken().then((token) => {
      bootstrapPromiseRef.current = null;
      return Boolean(token);
    });

    return bootstrapPromiseRef.current;
  }, [refreshAccessToken, user]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!apiBaseUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured");
      }

      setStatus("loading");

      try {
        const client = new ApiClient(apiBaseUrl);
        const session = await client.publicRequest<AuthSession>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        setSession(session);
        await fetchMe(session.accessToken);
        toast({ title: "Signed in", variant: "success" });
      } catch (error) {
        clearSession();
        const message = error instanceof Error ? error.message : "Unable to sign in";
        toast({ title: "Login failed", description: message, variant: "error" });
        throw error;
      }
    },
    [apiBaseUrl, clearSession, fetchMe, setSession, toast]
  );

  const logout = useCallback(async () => {
    try {
      await api.publicRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({})
      });
    } catch (error) {
      if (!(error instanceof ApiClientError && error.status === 400)) {
        toast({ title: "Logout failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
      }
    } finally {
      clearSession();
      router.replace("/login");
    }
  }, [api, clearSession, router, toast]);

  const logoutAll = useCallback(async () => {
    try {
      await api.request("/auth/logout-all", {
        method: "POST"
      });
      toast({ title: "All sessions closed", variant: "success" });
    } finally {
      clearSession();
      router.replace("/login");
    }
  }, [api, clearSession, router, toast]);

  const hasPermission = useCallback(
    (permission?: string) => {
      if (!permission) {
        return true;
      }

      if (!user) {
        return false;
      }

      const primaryRole = user.primaryRole ?? user.role;

      if (primaryRole === "SUPER_ADMIN" || user.roles?.some((role) => role.code === "SUPER_ADMIN")) {
        return true;
      }

      return Boolean(user.permissions?.some((item) => item.key === permission));
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken: accessTokenRef.current,
      api,
      bootstrap,
      login,
      logout,
      logoutAll,
      hasPermission
    }),
    [api, bootstrap, hasPermission, login, logout, logoutAll, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

function normalizeUser(user: CurrentUser): CurrentUser {
  return {
    ...user,
    primaryRole: user.primaryRole ?? user.role,
    permissions: user.permissions ?? []
  };
}

function setSessionHint() {
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; SameSite=Lax`;
}

function clearSessionHint() {
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
