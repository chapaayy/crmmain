"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { TextLocalizer } from "@/components/i18n/text-localizer";
import { ToastProvider } from "@/components/toast/toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <TextLocalizer />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
