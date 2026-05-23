"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages, LogOut, Menu, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { menuItems } from "@/lib/navigation";
import type { WorkspaceMode } from "@/lib/domains";
import { localeLabels, supportedLocales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Topbar({ mode }: { mode: WorkspaceMode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(href));
  const title = menuItems.find((item) => isActive(item.href))?.label;
  const isAdminRole = auth.user
    ? [auth.user.primaryRole, auth.user.role, ...(auth.user.roles?.map((role) => role.code) ?? [])].some(
        (role) => role === "SUPER_ADMIN" || role === "ADMIN"
      )
    : false;
  const visibleItems = menuItems.filter((item) => {
    if (mode === "crm" && item.adminOnly) {
      return false;
    }

    if (item.adminOnly && !isAdminRole) {
      return false;
    }

    return auth.hasPermission(item.permission);
  });

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <div className="group relative lg:hidden">
          <Button aria-label="Open menu" size="icon" type="button" variant="outline">
            <Menu className="h-4 w-4" />
          </Button>
          <div className="absolute left-0 top-11 hidden w-64 rounded-lg border bg-card p-2 shadow-lg group-focus-within:block group-hover:block">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive(item.href) && "bg-accent text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted-foreground">{mode === "admin" ? "Admin interface" : "CRM interface"}</div>
          <h1 className="truncate text-lg font-semibold tracking-normal">{title ?? "Dashboard"}</h1>
        </div>
        <Badge variant={mode === "admin" ? "default" : "secondary"} className="hidden gap-1.5 sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          {auth.user?.primaryRole ?? auth.user?.role ?? "USER"}
        </Badge>
        <div className="hidden min-w-0 text-right sm:block">
          <div className="truncate text-sm font-medium">{auth.user?.name}</div>
          <div className="truncate text-xs text-muted-foreground">{auth.user?.email}</div>
        </div>
        <NotificationBell />
        <label className="hidden h-10 items-center gap-2 rounded-md border bg-background px-2 text-sm sm:flex">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Language</span>
          <select
            aria-label="Language"
            className="bg-transparent text-sm outline-none"
            value={auth.locale}
            onChange={(event) => void auth.updateLocale(event.target.value as Locale)}
          >
            {supportedLocales.map((locale) => (
              <option key={locale} value={locale}>
                {localeLabels[locale]}
              </option>
            ))}
          </select>
        </label>
        <Button aria-label="Logout" size="icon" type="button" variant="outline" onClick={() => void auth.logout()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
