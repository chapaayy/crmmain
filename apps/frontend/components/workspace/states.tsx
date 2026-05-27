import type { ComponentType } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ShimmerSkeleton({
  className,
  rows = 1
}: {
  className?: string;
  rows?: number;
}) {
  if (rows > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="shimmer h-4 rounded-full" style={{ width: `${Math.max(42, 96 - index * 14)}%` }} />
        ))}
      </div>
    );
  }

  return <div className={cn("shimmer h-4 rounded-full", className)} />;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-sm text-muted-foreground">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-glow">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div>{label}</div>
      <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
        <div className="shimmer h-full w-full rounded-full" />
      </div>
    </div>
  );
}

export function EmptyState({
  label,
  description,
  icon: Icon = Inbox
}: {
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/70">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{label}</div>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ErrorState({
  label = "Something went wrong",
  description,
  onRetry
}: {
  label?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-destructive/35 bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
