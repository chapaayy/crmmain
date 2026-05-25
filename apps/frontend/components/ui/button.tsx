import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/50 bg-primary text-primary-foreground shadow-glow hover:border-primary hover:bg-primary/90",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-primary/30 hover:bg-muted",
        outline:
          "border border-border bg-card/70 text-foreground shadow-sm shadow-black/10 hover:border-primary/45 hover:bg-sidebar-hover hover:text-primary",
        ghost:
          "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground",
        destructive:
          "border border-destructive/50 bg-destructive/15 text-red-100 hover:bg-destructive/25 hover:text-white"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
