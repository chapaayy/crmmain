import type { ComponentType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  loading,
  tone = "primary"
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  loading?: boolean;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-md border",
              tone === "primary" && "border-primary/30 bg-primary/15 text-primary",
              tone === "success" && "border-success/30 bg-success/15 text-emerald-300",
              tone === "warning" && "border-warning/30 bg-warning/15 text-amber-300",
              tone === "danger" && "border-destructive/30 bg-destructive/15 text-red-300"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : value}
            </div>
            {note ? <div className="mt-1 truncate text-sm text-muted-foreground">{loading ? "Loading" : note}</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
