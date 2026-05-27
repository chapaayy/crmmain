import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "./states";

export function DataTable({
  title,
  actions,
  filters,
  children,
  footer,
  loading,
  empty,
  emptyLabel = "No records found",
  error,
  onRetry
}: {
  title?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      {title || actions ? (
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-surface/45 sm:flex-row sm:items-center sm:justify-between">
          {title ? <CardTitle className="text-sm uppercase tracking-[0.08em] text-muted-foreground">{title}</CardTitle> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4">
        {filters ? <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">{filters}</div> : null}
        <div className="crm-table-wrap">
          {error ? (
            <div className="p-4"><ErrorState label="Не удалось загрузить таблицу" description={error} onRetry={onRetry} /></div>
          ) : loading ? (
            <LoadingState />
          ) : empty ? (
            <div className="p-4"><EmptyState label={emptyLabel} /></div>
          ) : children}
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}
