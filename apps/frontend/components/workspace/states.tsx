import type { ComponentType } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {label}
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
    <div className="rounded-lg border border-dashed border-border bg-muted/25 px-4 py-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted-foreground" />
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
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
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
