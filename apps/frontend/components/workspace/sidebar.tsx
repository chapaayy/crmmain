"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { menuItems } from "@/lib/navigation";
import type { WorkspaceMode } from "@/lib/domains";
import { cn } from "@/lib/utils";

export function Sidebar({ mode }: { mode: WorkspaceMode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(href));
  const isAdminRole = auth.user
    ? [auth.user.primaryRole, auth.user.role, ...(auth.user.roles?.map((role) => role.code) ?? [])].some(
        (role) => role === "SUPER_ADMIN" || role === "ADMIN"
      )
    : false;
  const items = menuItems.filter((item) => {
    if (mode === "crm" && item.adminOnly) {
      return false;
    }

    if (item.adminOnly && !isAdminRole) {
      return false;
    }

    return auth.hasPermission(item.permission);
  });

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Boxes className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-semibold">CRM Polybags</div>
          <div className="text-xs text-muted-foreground">{mode === "admin" ? "Admin" : "Workspace"}</div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {items.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-accent text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
