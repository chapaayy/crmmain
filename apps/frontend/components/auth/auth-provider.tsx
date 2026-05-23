"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import { defaultLocale, localeLabels, normalizeLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { AuthSession, CurrentUser } from "@/lib/types";
import { useToast } from "@/components/toast/toast-provider";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  accessToken: string | null;
  locale: Locale;
  api: ApiClient;
  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateLocale: (locale: Locale) => Promise<void>;
  hasPermission: (permission?: string) => boolean;
}

interface MeResponse {
  user: CurrentUser;
}

const SESSION_HINT_COOKIE = "crm_session_hint";
const LOCALE_STORAGE_KEY = "crm_locale";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const accessTokenRef = useRef<string | null>(null);
  const bootstrapPromiseRef = useRef<Promise<boolean> | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const setSession = useCallback((session: AuthSession) => {
    const nextLocale = normalizeLocale(session.user.locale);

    accessTokenRef.current = session.accessToken;
    setUser(normalizeUser({ ...session.user, locale: nextLocale }));
    setLocale(nextLocale);
    storeLocale(nextLocale);
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

    const nextLocale = normalizeLocale(response.user.locale);

    setUser(normalizeUser({ ...response.user, locale: nextLocale }));
    setLocale(nextLocale);
    storeLocale(nextLocale);
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

  const updateLocale = useCallback(
    async (nextLocale: Locale) => {
      const normalized = normalizeLocale(nextLocale);

      setLocale(normalized);
      storeLocale(normalized);
      setUser((current) => (current ? { ...current, locale: normalized } : current));

      if (!accessTokenRef.current) {
        return;
      }

      try {
        const response = await api.request<MeResponse>("/users/me/preferences", {
          method: "PATCH",
          body: JSON.stringify({ locale: normalized })
        });
        const savedLocale = normalizeLocale(response.user.locale);

        setUser((current) => (current ? { ...current, locale: savedLocale } : normalizeUser({ ...response.user, locale: savedLocale })));
        setLocale(savedLocale);
        storeLocale(savedLocale);
        toast({ title: normalized === "ru" ? "Язык сохранён" : "Language saved", description: localeLabels[savedLocale], variant: "success" });
      } catch (error) {
        toast({
          title: normalized === "ru" ? "Не удалось сохранить язык" : "Unable to save language",
          description: error instanceof Error ? error.message : undefined,
          variant: "error"
        });
      }
    },
    [api, toast]
  );

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
      locale,
      api,
      bootstrap,
      login,
      logout,
      logoutAll,
      updateLocale,
      hasPermission
    }),
    [api, bootstrap, hasPermission, locale, login, logout, logoutAll, status, updateLocale, user]
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
    locale: normalizeLocale(user.locale),
    permissions: user.permissions ?? []
  };
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

function storeLocale(locale: Locale) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

function setSessionHint() {
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; SameSite=Lax`;
}

function clearSessionHint() {
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
