import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShimmerSkeleton } from "./states";

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
    <Card className="group overflow-hidden bg-gradient-to-br from-card/95 to-surface/90 hover:border-primary/25">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition-all duration-200 group-hover:scale-[1.03]",
              tone === "primary" && "border-primary/30 bg-primary/10 text-primary shadow-glow",
              tone === "success" && "border-success/30 bg-success/15 text-emerald-300",
              tone === "warning" && "border-warning/30 bg-warning/15 text-amber-300",
              tone === "danger" && "border-destructive/30 bg-destructive/15 text-red-300"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {loading ? <ShimmerSkeleton className="h-7 w-28 rounded-lg" /> : value}
            </div>
            {note ? (
              <div className="mt-1 truncate text-sm text-muted-foreground">
                {loading ? <ShimmerSkeleton className="h-4 w-36" /> : note}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
