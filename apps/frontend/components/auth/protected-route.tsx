"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { bootstrap, status } = auth;
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    setError(null);
    setReady(false);
    retryBootstrap(bootstrap)
      .then((authenticated) => {
        if (!mounted) {
          return;
        }

        if (!authenticated) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        setReady(true);
      })
      .catch((bootstrapError) => {
        if (!mounted) {
          return;
        }

        setReady(false);
        setError(getBootstrapErrorMessage(bootstrapError));
      });

    return () => {
      mounted = false;
    };
  }, [attempt, bootstrap, pathname, router]);

  useEffect(() => {
    if (ready && status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, ready, router, status]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-panel">
          <AlertCircle className="mx-auto h-6 w-6 text-warning" />
          <h1 className="mt-3 text-base font-semibold">Не удалось восстановить сессию</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" />
              Повторить
            </Button>
            <Button type="button" variant="ghost" onClick={() => void auth.logout()}>
              Выйти
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

async function retryBootstrap(bootstrap: () => Promise<boolean>) {
  const delays = [0, 200, 500];
  let lastError: unknown;

  for (const delay of delays) {
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      return await bootstrap();
    } catch (error) {
      lastError = error;

      if (!isRetryableBootstrapError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function getBootstrapErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.isNetworkError) {
    return "Не удалось подключиться к API. Сессия не сброшена. Проверьте соединение и повторите.";
  }

  if (error instanceof ApiClientError && (error.status >= 500 || error.status === 429)) {
    return "API временно ответил ошибкой. Сессия не сброшена. Нажмите «Повторить», когда сервер будет доступен.";
  }

  if (error instanceof Error) {
    return `${error.message}. Проверьте соединение с API и попробуйте еще раз.`;
  }

  return "Не удалось восстановить сессию. Проверьте соединение с API и попробуйте еще раз.";
}

function isRetryableBootstrapError(error: unknown) {
  return error instanceof ApiClientError && (error.isNetworkError || error.status === 429 || error.status >= 500);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
