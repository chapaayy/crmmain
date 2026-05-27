import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/10 text-primary",
        secondary: "border-border/80 bg-secondary/70 text-secondary-foreground",
        outline: "border-border/80 bg-background/45 text-muted-foreground",
        success: "border-success/35 bg-success/15 text-emerald-300",
        warning: "border-warning/35 bg-warning/15 text-amber-300",
        destructive: "border-destructive/35 bg-destructive/15 text-red-300",
        info: "border-info/35 bg-info/10 text-sky-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
