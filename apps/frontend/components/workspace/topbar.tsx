"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Languages, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, UserCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels, supportedLocales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { menuItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { getActiveHref, getVisibleMenuItems, isActive } from "./sidebar";

export function Topbar({
  onOpenSidebar,
  onToggleSidebar,
  sidebarOpen
}: {
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const title = useMemo(() => getCurrentTitle(pathname), [pathname]);
  const visibleItems = getVisibleMenuItems(auth);
  const crumbs = title === "Главная" ? ["Обзор", title] : ["CRM Мешки", title];
  const hidden = useHeaderHeadroom();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl transition-transform duration-500 crm-panel-motion will-change-transform",
        hidden && "-translate-y-[calc(100%+1px)]"
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4 sm:px-5 xl:px-6">
        <Button aria-label="Открыть меню" className="lg:hidden" size="icon" type="button" variant="outline" onClick={onOpenSidebar}>
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          aria-label={sidebarOpen ? "Скрыть левое меню" : "Показать левое меню"}
          className="hidden lg:inline-flex"
          size="icon"
          type="button"
          variant="outline"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className={cn("truncate", index === crumbs.length - 1 && "text-primary")}>
                {crumb}
                {index < crumbs.length - 1 ? <span className="ml-1.5 text-muted-foreground/45">/</span> : null}
              </span>
            ))}
          </div>
          <h1 className="mt-0.5 truncate text-lg font-semibold tracking-normal text-foreground">{title}</h1>
        </div>

        <div className="relative hidden w-full max-w-sm xl:block">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="h-10 bg-card/70 pl-9" placeholder="Быстрый поиск" />
        </div>

        <MobileQuickNav items={visibleItems} pathname={pathname} />

        <Badge variant="secondary" className="hidden max-w-[12rem] gap-1.5 truncate md:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          {auth.user?.primaryRole ?? auth.user?.role ?? "USER"}
        </Badge>

        <NotificationBell />

        <label className="hidden h-10 items-center gap-2 rounded-xl border border-border/80 bg-card/70 px-2 text-sm shadow-sm shadow-black/10 transition-colors duration-300 crm-panel-motion hover:border-primary/35 md:flex">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Язык</span>
          <select
            aria-label="Язык"
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

function useHeaderHeadroom() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (currentY < 48) {
        setHidden(false);
      } else if (delta > 10 && currentY > 140) {
        setHidden(true);
      } else if (delta < -8) {
        setHidden(false);
      }

      lastY = currentY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

function MobileQuickNav({ items, pathname }: { items: ReturnType<typeof getVisibleMenuItems>; pathname: string }) {
  const activeHref = getActiveHref(pathname, items);

  return (
    <div className="group relative hidden md:block lg:hidden">
      <Button type="button" variant="outline">
        Меню
        <ChevronDown className="h-4 w-4" />
      </Button>
      <div className="absolute right-0 top-12 hidden w-72 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-panel backdrop-blur-xl group-focus-within:block group-hover:block">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-300 crm-panel-motion hover:bg-sidebar-hover hover:text-foreground",
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
        <span className="grid h-6 w-6 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
          {initials || <UserCircle className="h-4 w-4" />}
        </span>
        <span className="hidden max-w-32 truncate text-left sm:block">{auth.user?.name ?? auth.user?.email ?? "Пользователь"}</span>
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-panel backdrop-blur-xl">
          <div className="border-b border-border/70 px-3 py-3">
            <div className="truncate text-sm font-medium">{auth.user?.name ?? "Пользователь"}</div>
            <div className="truncate text-xs text-muted-foreground">{auth.user?.email}</div>
          </div>
          <Link
            className="mt-2 flex h-10 items-center rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-300 crm-panel-motion hover:bg-sidebar-hover hover:text-foreground"
            href="/settings"
            onClick={() => setOpen(false)}
          >
            Настройки профиля
          </Link>
          <Button className="mt-1 w-full justify-start" type="button" variant="ghost" onClick={() => void auth.logout()}>
            <LogOut className="h-4 w-4" />
            Выйти
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
      .find((item) => isActive(pathname, item.href))?.label ?? "Главная"
  );
}
