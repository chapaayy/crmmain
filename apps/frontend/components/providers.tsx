"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/toast/toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
