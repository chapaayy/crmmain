import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { Observable, of, tap } from "rxjs";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type CacheableRequest = Request & {
  user?: {
    userId?: string;
    role?: string;
  };
};

const MAX_CACHE_ENTRIES = 1000;

@Injectable()
export class ShortResponseCacheInterceptor implements NestInterceptor {
  private static readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(config: ConfigService) {
    this.ttlMs = Math.max(0, config.get<number>("app.getCacheTtlMs", 3000));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CacheableRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    if (this.isMutation(request)) {
      if (!this.shouldInvalidateOnMutation(request)) {
        response.setHeader("X-CRM-Cache", "BYPASS");
        return next.handle();
      }

      return next.handle().pipe(
        tap(() => {
          ShortResponseCacheInterceptor.cache.clear();
          response.setHeader("X-CRM-Cache", "BYPASS");
        })
      );
    }

    if (!this.shouldCache(request)) {
      response.setHeader("X-CRM-Cache", "BYPASS");
      return next.handle();
    }

    const key = this.cacheKey(request);
    const now = Date.now();
    const cached = ShortResponseCacheInterceptor.cache.get(key);

    if (cached && cached.expiresAt > now) {
      response.setHeader("X-CRM-Cache", "HIT");
      return of(cached.value);
    }

    if (cached) {
      ShortResponseCacheInterceptor.cache.delete(key);
    }

    return next.handle().pipe(
      tap((value) => {
        this.put(key, value);
        response.setHeader("X-CRM-Cache", "MISS");
      })
    );
  }

  private isMutation(request: CacheableRequest) {
    return !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  }

  private shouldInvalidateOnMutation(request: CacheableRequest) {
    return !request.path.toLowerCase().startsWith("/auth/");
  }

  private shouldCache(request: CacheableRequest) {
    if (this.ttlMs <= 0 || request.method.toUpperCase() !== "GET") {
      return false;
    }

    const userId = request.user?.userId;

    if (!userId) {
      return false;
    }

    const path = request.path.toLowerCase();
    const url = request.originalUrl.toLowerCase();

    if (
      path === "/health" ||
      path.startsWith("/realtime/") ||
      url.includes("/download") ||
      url.includes("/export") ||
      url.includes("/reveal") ||
      url.includes("/access-logs")
    ) {
      return false;
    }

    return true;
  }

  private cacheKey(request: CacheableRequest) {
    const userId = request.user?.userId ?? "anonymous";
    const role = request.user?.role ?? "unknown";

    return `${userId}:${role}:${request.method}:${request.originalUrl}`;
  }

  private put(key: string, value: unknown) {
    const cache = ShortResponseCacheInterceptor.cache;

    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value as string | undefined;

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
  }
}
