import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  badge,
  breadcrumbs,
  icon,
  actions,
  className
}: {
  title: string;
  description?: string;
  badge?: string;
  breadcrumbs?: string[];
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("crm-surface rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-glow">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {breadcrumbs?.length ? (
              <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb}-${index}`} className={cn("truncate", index === breadcrumbs.length - 1 && "text-primary")}>
                    {crumb}
                    {index < breadcrumbs.length - 1 ? <span className="ml-1.5 text-muted-foreground/45">/</span> : null}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-normal text-foreground">{title}</h2>
              {badge ? <Badge variant="outline">{badge}</Badge> : null}
            </div>
            {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
