import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  badge,
  actions,
  className
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-2xl font-semibold tracking-normal text-foreground">{title}</h2>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
