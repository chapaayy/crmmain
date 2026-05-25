"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { bootstrap, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    setError(null);
    bootstrap()
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
        setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to restore session");
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
            {error}. Проверьте соединение с API и попробуйте еще раз.
          </p>
          <Button className="mt-4" type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" />
            Повторить
          </Button>
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
