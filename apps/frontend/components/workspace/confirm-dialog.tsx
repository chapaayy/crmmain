"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-popover p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-warning/30 bg-warning/15 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={loading} type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button disabled={loading} type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
