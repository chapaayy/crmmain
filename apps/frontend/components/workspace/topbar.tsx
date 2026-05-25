"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Languages, LogOut, Menu, Search, ShieldCheck, UserCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceMode } from "@/lib/domains";
import { localeLabels, supportedLocales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { menuItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { getActiveHref, getVisibleMenuItems, isActive } from "./sidebar";

export function Topbar({ mode, onOpenSidebar }: { mode: WorkspaceMode; onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const auth = useAuth();
  const title = useMemo(() => getCurrentTitle(pathname), [pathname]);
  const visibleItems = getVisibleMenuItems(auth, mode);
  const crumbs = title === "Dashboard" ? ["Overview", title] : ["Workspace", title];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/86 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button aria-label="Open menu" className="lg:hidden" size="icon" type="button" variant="outline" onClick={onOpenSidebar}>
          <Menu className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className={cn("truncate", index === crumbs.length - 1 && "text-primary")}>
                {crumb}
                {index < crumbs.length - 1 ? <span className="mx-2 text-muted-foreground/50">/</span> : null}
              </span>
            ))}
          </div>
          <h1 className="mt-0.5 truncate text-lg font-semibold tracking-normal text-foreground">{title}</h1>
        </div>

        <div className="relative hidden w-full max-w-sm xl:block">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="h-10 bg-card/60 pl-9" placeholder="Quick search" />
        </div>

        <MobileQuickNav items={visibleItems} pathname={pathname} />

        <Badge variant={mode === "admin" ? "default" : "secondary"} className="hidden gap-1.5 md:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          {auth.user?.primaryRole ?? auth.user?.role ?? "USER"}
        </Badge>

        <NotificationBell />

        <label className="hidden h-10 items-center gap-2 rounded-md border border-border bg-card/70 px-2 text-sm md:flex">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Language</span>
          <select
            aria-label="Language"
            className="bg-transparent text-sm text-foreground outline-none"
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

        <UserMenu />
      </div>
    </header>
  );
}

function MobileQuickNav({ items, pathname }: { items: ReturnType<typeof getVisibleMenuItems>; pathname: string }) {
  const activeHref = getActiveHref(pathname, items);

  return (
    <div className="group relative hidden md:block lg:hidden">
      <Button type="button" variant="outline">
        Menu
        <ChevronDown className="h-4 w-4" />
      </Button>
      <div className="absolute right-0 top-11 hidden w-72 rounded-lg border border-border bg-popover p-2 shadow-panel group-focus-within:block group-hover:block">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-sidebar-hover hover:text-foreground",
              item.href === activeHref && "bg-sidebar-active text-primary"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function UserMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const initials = (auth.user?.name || auth.user?.email || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative">
      <Button className="h-10 px-2 sm:px-3" type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials || <UserCircle className="h-4 w-4" />}
        </span>
        <span className="hidden max-w-32 truncate text-left sm:block">{auth.user?.name ?? auth.user?.email ?? "User"}</span>
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-border bg-popover p-2 shadow-panel">
          <div className="border-b border-border px-3 py-3">
            <div className="truncate text-sm font-medium">{auth.user?.name ?? "User"}</div>
            <div className="truncate text-xs text-muted-foreground">{auth.user?.email}</div>
          </div>
          <Link
            className="mt-2 flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
            href="/settings"
            onClick={() => setOpen(false)}
          >
            Profile settings
          </Link>
          <Button className="mt-1 w-full justify-start" type="button" variant="ghost" onClick={() => void auth.logout()}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function getCurrentTitle(pathname: string) {
  return (
    [...menuItems]
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => isActive(pathname, item.href))?.label ?? "Dashboard"
  );
}
