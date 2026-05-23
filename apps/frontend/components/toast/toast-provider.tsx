"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (nextToast: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => {
      const id = crypto.randomUUID();
      const item: Toast = {
        id,
        title: nextToast.title,
        description: nextToast.description,
        variant: nextToast.variant ?? "default"
      };

      setToasts((items) => [item, ...items].slice(0, 4));
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-card p-4 text-sm shadow-lg",
              item.variant === "success" && "border-emerald-200",
              item.variant === "error" && "border-destructive/30"
            )}
          >
            {item.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            ) : item.variant === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title}</div>
              {item.description ? <div className="mt-1 text-muted-foreground">{item.description}</div> : null}
            </div>
            <Button
              aria-label="Dismiss"
              className="-mr-2 -mt-2 h-8 w-8"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => dismiss(item.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
