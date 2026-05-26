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

  private async fetchWithAuth<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
    const accessToken = this.getAccessToken?.();
    const headers = new Headers(init.headers);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
      return await this.fetchJson<T>(path, { ...init, headers });
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
    }
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

  private async fetchJson<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);

    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetchWithNetworkError(
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
      throw new ApiClientError(
        errorBody?.error?.message ?? errorBody?.message ?? "Request failed",
        response.status,
        errorBody?.error?.code,
        errorBody?.error?.details
      );
    }

    return body as T;
  }

  private async fetchText(path: string, init: RequestInit = {}) {
    const response = await fetchWithNetworkError(
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
      throw new ApiClientError(
        errorBody?.error?.message ?? errorBody?.message ?? "Request failed",
        response.status,
        errorBody?.error?.code,
        errorBody?.error?.details
      );
    }

    return text;
  }

  private async fetchBlob(path: string, init: RequestInit = {}) {
    const response = await fetchWithNetworkError(
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
      throw new ApiClientError(
        errorBody?.error?.message ?? errorBody?.message ?? "Request failed",
        response.status,
        errorBody?.error?.code,
        errorBody?.error?.details
      );
    }

    return response.blob();
  }
}

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

function debugApi(message: string, path: string) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[api] ${message}: ${path}`);
  }
}
