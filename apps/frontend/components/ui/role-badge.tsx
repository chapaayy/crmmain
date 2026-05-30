import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { getRoleBadgeStyle, getRoleDisplayName } from "@/lib/roles";
import { cn } from "@/lib/utils";

type RoleLike =
  | string
  | {
      code?: string | null;
      name?: string | null;
      color?: string | null;
    };

interface RoleBadgeProps extends Omit<BadgeProps, "variant"> {
  roleInfo: RoleLike;
}

export function RoleBadge({ roleInfo, className, style, ...props }: RoleBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate normal-case tracking-[0.02em]", className)}
      style={{ ...getRoleBadgeStyle(roleInfo), ...style }}
      {...props}
    >
      {props.children}
      <span className="truncate">{getRoleDisplayName(roleInfo)}</span>
    </Badge>
  );
}
