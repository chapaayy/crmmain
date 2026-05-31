"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import { defaultLocale, localeLabels, normalizeLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { AuthSession, CurrentUser } from "@/lib/types";
import { useToast } from "@/components/toast/toast-provider";
import { getApiBaseUrl } from "@/lib/api-url";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  accessToken: string | null;
  locale: Locale;
  api: ApiClient;
  bootstrap: () => Promise<boolean>;
  refreshCurrentUser: () => Promise<CurrentUser | null>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateLocale: (locale: Locale) => Promise<void>;
  hasPermission: (permission?: string | string[]) => boolean;
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
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const accessTokenRef = useRef<string | null>(null);
  const bootstrapPromiseRef = useRef<Promise<boolean> | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const apiBaseUrl = getApiBaseUrl();

  const clearSession = useCallback((reason = "session_cleared") => {
    debugAuth(`logout reason: ${reason}`);
    ApiClient.clearResponseCache();
    accessTokenRef.current = null;
    setUser(null);
    setStatus("unauthenticated");
    clearSessionHint();
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    try {
      debugAuth("auth me started");
      const client = new ApiClient(apiBaseUrl, {
        getAccessToken: () => token
      });
      const response = await client.request<MeResponse>("/auth/me");

      const nextLocale = normalizeLocale(response.user.locale);

      setUser(normalizeUser({ ...response.user, locale: nextLocale }));
      setLocale(nextLocale);
      storeLocale(nextLocale);
      debugAuth("auth me success");
      return response.user;
    } catch (error) {
      debugAuth("auth me failed", error);
      throw error;
    }
  }, [apiBaseUrl]);

  const applySession = useCallback(async (session: AuthSession) => {
    accessTokenRef.current = session.accessToken;
    setSessionHint();

    if (isHydratedUser(session.user)) {
      const nextLocale = normalizeLocale(session.user.locale);

      setUser(normalizeUser({ ...session.user, locale: nextLocale }));
      setLocale(nextLocale);
      storeLocale(nextLocale);
    } else {
      await fetchMe(session.accessToken);
    }

    setStatus("authenticated");
    return session.accessToken;
  }, [fetchMe]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) {
      debugAuth("refresh already running; waiting for existing refresh");
      return refreshPromiseRef.current;
    }

    if (!apiBaseUrl) {
      clearSession("missing_api_base_url");
      return null;
    }

    refreshPromiseRef.current = (async () => {
      try {
        debugAuth("refresh started");
        const client = new ApiClient(apiBaseUrl);
        const session = await client.publicRequest<AuthSession>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({})
        });

        await applySession(session);
        debugAuth("refresh success");

        return session.accessToken;
      } catch (error) {
        if (isConfirmedAuthFailure(error)) {
          debugAuth("refresh failed with confirmed auth error", error);
          clearSession("refresh_auth_failed");
          return null;
        }

        debugAuth("refresh failed with network/temporary error", error);
        throw error;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [apiBaseUrl, applySession, clearSession]);

  const api = useMemo(
    () =>
      new ApiClient(apiBaseUrl, {
        getAccessToken: () => accessTokenRef.current,
        refreshAccessToken
      }),
    [apiBaseUrl, refreshAccessToken]
  );

  const refreshCurrentUser = useCallback(async () => {
    if (!accessTokenRef.current) {
      return null;
    }

    return fetchMe(accessTokenRef.current);
  }, [fetchMe]);

  const bootstrap = useCallback(async () => {
    if (accessTokenRef.current && user) {
      setStatus("authenticated");
      return true;
    }

    if (bootstrapPromiseRef.current) {
      return bootstrapPromiseRef.current;
    }

    setStatus("loading");
    bootstrapPromiseRef.current = (async () => {
      try {
        debugAuth("auth bootstrap started");

        if (accessTokenRef.current) {
          try {
            await fetchMe(accessTokenRef.current);
            setStatus("authenticated");
            return true;
          } catch (error) {
            if (isConfirmedAuthFailure(error) && !(error instanceof ApiClientError && error.status === 401)) {
              clearSession("auth_me_failed");
              return false;
            }

            if (!(error instanceof ApiClientError && error.status === 401)) {
              throw error;
            }

            debugAuth("access token expired; refreshing");
          }
        }

        const token = await refreshAccessToken();
        return Boolean(token);
      } finally {
        bootstrapPromiseRef.current = null;
      }
    })();

    return bootstrapPromiseRef.current;
  }, [clearSession, fetchMe, refreshAccessToken, user]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured");
      }

      setStatus("loading");

      try {
        const client = new ApiClient(apiBaseUrl);
        const session = await client.publicRequest<AuthSession>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        await applySession(session);
        toast({ title: "Signed in", variant: "success" });
      } catch (error) {
        if (error instanceof ApiClientError && error.isNetworkError) {
          debugAuth("login failed with network error; session was not cleared", error);
          setStatus(accessTokenRef.current ? "loading" : "unauthenticated");
        } else {
          clearSession("login_failed");
        }

        const message = error instanceof Error ? error.message : "Unable to sign in";
        toast({ title: "Login failed", description: message, variant: "error" });
        throw error;
      }
    },
    [apiBaseUrl, applySession, clearSession, toast]
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
    (permission?: string | string[]) => {
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

      const checkOne = (item: string) => Boolean(user.permissions?.some((permissionItem) => permissionItem.key === item));

      if (Array.isArray(permission)) {
        return permission.some((item) => checkOne(item));
      }

      return checkOne(permission);
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
      refreshCurrentUser,
      login,
      logout,
      logoutAll,
      updateLocale,
      hasPermission
    }),
    [api, bootstrap, hasPermission, locale, login, logout, logoutAll, refreshCurrentUser, status, updateLocale, user]
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

function isHydratedUser(user: CurrentUser | undefined): user is CurrentUser {
  return Boolean(user && Array.isArray(user.roles) && Array.isArray(user.permissions));
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

function isConfirmedAuthFailure(error: unknown) {
  return error instanceof ApiClientError && [400, 401, 403].includes(error.status);
}

function debugAuth(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    if (details) {
      console.debug(`[auth] ${message}`, details);
    } else {
      console.debug(`[auth] ${message}`);
    }
  }
}
