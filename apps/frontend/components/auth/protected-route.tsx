"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { bootstrap, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    bootstrap().then((authenticated) => {
      if (!mounted) {
        return;
      }

      if (!authenticated) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [bootstrap, pathname, router]);

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
