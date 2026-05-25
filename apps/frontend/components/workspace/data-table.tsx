import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "./states";

export function DataTable({
  title,
  actions,
  filters,
  children,
  footer,
  loading,
  empty,
  emptyLabel = "No records found"
}: {
  title?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <Card>
      {title || actions ? (
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title ? <CardTitle>{title}</CardTitle> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4">
        {filters ? <div className="rounded-lg border border-border bg-muted/25 p-3">{filters}</div> : null}
        <div className="crm-table-wrap">
          {loading ? <LoadingState /> : empty ? <div className="p-4"><EmptyState label={emptyLabel} /></div> : children}
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}
