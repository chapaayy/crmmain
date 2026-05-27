import type { ApiErrorBody } from "@/lib/types";

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;
  isAuthError: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    options: { isNetworkError?: boolean; isAuthError?: boolean } = {}
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetworkError = options.isNetworkError ?? status === 0;
    this.isAuthError = options.isAuthError ?? [401, 403].includes(status);
  }
}

export interface ApiClientOptions {
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

export class ApiClient {
  static readonly responseCache = new Map<string, { expiresAt: number; value: unknown }>();
  static readonly inFlightGetRequests = new Map<string, Promise<unknown>>();
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => string | null;
  private readonly refreshAccessToken?: () => Promise<string | null>;

  constructor(baseUrl: string, options: ApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.refreshAccessToken = options.refreshAccessToken;
  }

  async request<T>(path: string, init: RequestInit = {}) {
    return this.fetchWithAuth<T>(path, init, true);
  }

  async requestText(path: string, init: RequestInit = {}) {
    return this.fetchTextWithAuth(path, init, true);
  }

  async requestBlob(path: string, init: RequestInit = {}) {
    return this.fetchBlobWithAuth(path, init, true);
  }

  async publicRequest<T>(path: string, init: RequestInit = {}) {
    return this.fetchJson<T>(path, init);
  }

  static clearResponseCache() {
    ApiClient.responseCache.clear();
    ApiClient.inFlightGetRequests.clear();
  }

  private async fetchWithAuth<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
    const accessToken = this.getAccessToken?.();
    const headers = new Headers(init.headers);
    const method = normalizeMethod(init.method);
    const cacheKey = this.getClientCacheKey(path, init, accessToken);

    if (isMutationMethod(method)) {
      ApiClient.clearResponseCache();
    }

    if (cacheKey) {
      const cached = ApiClient.responseCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        debugApi("client cache hit", path);
        return cached.value as T;
      }

      if (cached) {
        ApiClient.responseCache.delete(cacheKey);
      }

      const inFlight = ApiClient.inFlightGetRequests.get(cacheKey);

      if (inFlight) {
        debugApi("client request joins in-flight GET", path);
        return inFlight as Promise<T>;
      }
    }

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const requestPromise = (async () => {
      try {
        const response = await this.fetchJson<T>(path, { ...init, headers });

        if (cacheKey) {
          putClientCache(cacheKey, response);
        }

        return response;
      } catch (error) {
        if (
          canRefresh &&
          error instanceof ApiClientError &&
          error.status === 401 &&
          this.refreshAccessToken
        ) {
          debugApi("request waits for refresh", path);
          const refreshedToken = await this.refreshAccessToken();

          if (refreshedToken) {
            debugApi("queued request retry after refresh", path);
            return this.fetchWithAuth<T>(path, init, false);
          }
        }

        throw error;
      } finally {
        if (cacheKey) {
          ApiClient.inFlightGetRequests.delete(cacheKey);
        }
      }
    })();

    if (cacheKey) {
      ApiClient.inFlightGetRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  private async fetchTextWithAuth(path: string, init: RequestInit, canRefresh: boolean): Promise<string> {
    const accessToken = this.getAccessToken?.();
    const headers = new Headers(init.headers);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
      return await this.fetchText(path, { ...init, headers });
    } catch (error) {
      if (
        canRefresh &&
        error instanceof ApiClientError &&
        error.status === 401 &&
        this.refreshAccessToken
      ) {
        debugApi("text request waits for refresh", path);
        const refreshedToken = await this.refreshAccessToken();

        if (refreshedToken) {
          debugApi("queued text request retry after refresh", path);
          return this.fetchTextWithAuth(path, init, false);
        }
      }

      throw error;
    }
  }

  private async fetchBlobWithAuth(path: string, init: RequestInit, canRefresh: boolean): Promise<Blob> {
    const accessToken = this.getAccessToken?.();
    const headers = new Headers(init.headers);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
      return await this.fetchBlob(path, { ...init, headers });
    } catch (error) {
      if (
        canRefresh &&
        error instanceof ApiClientError &&
        error.status === 401 &&
        this.refreshAccessToken
      ) {
        debugApi("blob request waits for refresh", path);
        const refreshedToken = await this.refreshAccessToken();

        if (refreshedToken) {
          debugApi("queued blob request retry after refresh", path);
          return this.fetchBlobWithAuth(path, init, false);
        }
      }

      throw error;
    }
  }

  private getClientCacheKey(path: string, init: RequestInit, accessToken: string | null | undefined) {
    const method = normalizeMethod(init.method);
    const cacheControl = new Headers(init.headers).get("Cache-Control")?.toLowerCase();

    if (
      method !== "GET" ||
      !accessToken ||
      init.cache === "no-store" ||
      init.cache === "reload" ||
      cacheControl?.includes("no-cache") ||
      !isClientCacheablePath(path)
    ) {
      return null;
    }

    return `${this.baseUrl}:${accessToken}:${path}`;
  }

  private async fetchJson<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);

    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetchWithTransientRetry(
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers,
        credentials: "include"
      },
      path
    );
    const text = await response.text();
    const body = text ? parseBody<T | ApiErrorBody>(text) : undefined;

    if (!response.ok) {
      const errorBody = body as ApiErrorBody | undefined;
      throw createResponseError(response, path, text, errorBody);
    }

    return body as T;
  }

  private async fetchText(path: string, init: RequestInit = {}) {
    const response = await fetchWithTransientRetry(
      `${this.baseUrl}${path}`,
      {
        ...init,
        credentials: "include"
      },
      path
    );
    const text = await response.text();

    if (!response.ok) {
      const errorBody = parseBody<ApiErrorBody>(text);
      throw createResponseError(response, path, text, errorBody);
    }

    return text;
  }

  private async fetchBlob(path: string, init: RequestInit = {}) {
    const response = await fetchWithTransientRetry(
      `${this.baseUrl}${path}`,
      {
        ...init,
        credentials: "include"
      },
      path
    );

    if (!response.ok) {
      const text = await response.text();
      const errorBody = parseBody<ApiErrorBody>(text);
      throw createResponseError(response, path, text, errorBody);
    }

    return response.blob();
  }
}

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_RETRY_DELAYS_MS = [150, 350, 700, 1200];
const CLIENT_GET_CACHE_TTL_MS = 8_000;
const CLIENT_GET_CACHE_MAX_ENTRIES = 250;

function parseBody<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function fetchWithNetworkError(url: string, init: RequestInit, path: string) {
  try {
    return await fetch(url, init);
  } catch (error) {
    debugApi("network error without logout", path);
    const message = error instanceof Error ? error.message : "Failed to fetch";
    throw new ApiClientError(message, 0, "NETWORK_ERROR", undefined, { isNetworkError: true });
  }
}

async function fetchWithTransientRetry(url: string, init: RequestInit, path: string) {
  const canRetry = isRetryableMethod(init.method);
  const delays = canRetry ? [0, ...TRANSIENT_RETRY_DELAYS_MS] : [0];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const delay = delays[attempt] ?? 0;

    if (delay > 0) {
      await sleep(delay);
    }

    try {
      const response = await fetchWithNetworkError(url, init, path);

      if (!canRetry || !TRANSIENT_STATUS_CODES.has(response.status) || attempt === delays.length - 1) {
        return response;
      }

      debugApi(`transient HTTP ${response.status}; retrying`, path);
    } catch (error) {
      lastError = error;

      if (
        !canRetry ||
        !(error instanceof ApiClientError && error.isNetworkError) ||
        attempt === delays.length - 1
      ) {
        throw error;
      }

      debugApi("network error; retrying", path);
    }
  }

  throw lastError;
}

function createResponseError(response: Response, path: string, text: string, errorBody?: ApiErrorBody) {
  return new ApiClientError(
    buildResponseErrorMessage(response, path, text, errorBody),
    response.status,
    errorBody?.error?.code,
    errorBody?.error?.details ?? buildResponseErrorDetails(path, text)
  );
}

function buildResponseErrorMessage(response: Response, path: string, text: string, errorBody?: ApiErrorBody) {
  const serverMessage = errorBody?.error?.message ?? errorBody?.message;
  const statusLabel = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;

  if (serverMessage) {
    return `${serverMessage} (${statusLabel}, ${path})`;
  }

  const responseText = compactResponseText(text);

  return responseText ? `${statusLabel} on ${path}: ${responseText}` : `${statusLabel} on ${path}`;
}

function buildResponseErrorDetails(path: string, text: string) {
  const responseText = compactResponseText(text);

  return responseText ? { path, responseText } : { path };
}

function compactResponseText(text: string) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function isRetryableMethod(method?: string) {
  const normalizedMethod = normalizeMethod(method);

  return normalizedMethod === "GET" || normalizedMethod === "HEAD";
}

function normalizeMethod(method?: string) {
  return (method ?? "GET").toUpperCase();
}

function isMutationMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function isClientCacheablePath(path: string) {
  const normalized = path.toLowerCase();

  if (
    normalized.startsWith("/auth/") ||
    normalized.startsWith("/notifications") ||
    normalized.startsWith("/realtime/") ||
    normalized.includes("/download") ||
    normalized.includes("/export") ||
    normalized.includes("/reveal") ||
    normalized.includes("/access-logs")
  ) {
    return false;
  }

  return true;
}

function putClientCache(key: string, value: unknown) {
  const cache = ApiClient.responseCache;

  if (cache.size >= CLIENT_GET_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + CLIENT_GET_CACHE_TTL_MS,
    value
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debugApi(message: string, path: string) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[api] ${message}: ${path}`);
  }
}
