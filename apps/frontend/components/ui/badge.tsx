import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/16 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-background/50 text-muted-foreground",
        success: "border-success/35 bg-success/15 text-emerald-300",
        warning: "border-warning/35 bg-warning/15 text-amber-300",
        destructive: "border-destructive/35 bg-destructive/15 text-red-300",
        info: "border-sky-400/35 bg-sky-400/10 text-sky-300"
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
