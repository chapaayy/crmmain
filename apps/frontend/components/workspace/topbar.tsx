"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Languages, LogOut, Menu, Search, ShieldCheck, UserCircle, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeLabels, supportedLocales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { menuItems } from "@/lib/navigation";
import { useDismissibleLayer } from "@/lib/use-dismissible-layer";
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

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-5 xl:px-6">
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
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-normal text-foreground">{title}</h1>
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
        <LanguageMenu />
        <UserMenu />
      </div>
    </header>
  );
}

function MobileQuickNav({ items, pathname }: { items: ReturnType<typeof getVisibleMenuItems>; pathname: string }) {
  const activeHref = getActiveHref(pathname, items);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useDismissibleLayer({
    open,
    onDismiss: close,
    refs: [triggerRef, panelRef]
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative hidden md:block lg:hidden">
      <Button ref={triggerRef} type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        Меню
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </Button>
      {open ? (
        <div ref={panelRef} className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-panel backdrop-blur-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-300 crm-panel-motion hover:bg-sidebar-hover hover:text-foreground",
                item.href === activeHref && "bg-sidebar-active text-primary"
              )}
              onClick={close}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LanguageMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<Locale | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useDismissibleLayer({
    open,
    onDismiss: close,
    refs: [triggerRef, panelRef]
  });

  async function handleLocaleChange(locale: Locale) {
    if (locale === auth.locale || saving) {
      setOpen(false);
      return;
    }

    setSaving(locale);

    try {
      await auth.updateLocale(locale);
      setOpen(false);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="relative hidden md:block">
      <Button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-10 min-w-[9rem] justify-between gap-2 px-3"
        type="button"
        variant="outline"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="truncate text-sm">{localeLabels[auth.locale]}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </Button>

      {open ? (
        <div ref={panelRef} className="absolute right-0 top-12 z-50 w-44 rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-panel backdrop-blur-xl">
          {supportedLocales.map((locale) => {
            const active = auth.locale === locale;

            return (
              <button
                key={locale}
                aria-pressed={active}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm transition-colors duration-200 crm-panel-motion",
                  active ? "bg-sidebar-active text-primary" : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
                )}
                disabled={Boolean(saving)}
                type="button"
                onClick={() => void handleLocaleChange(locale)}
              >
                <span>{localeLabels[locale]}</span>
                {active ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const initials = (auth.user?.name || auth.user?.email || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const close = useCallback(() => setOpen(false), []);

  useDismissibleLayer({
    open,
    onDismiss: close,
    refs: [triggerRef, panelRef]
  });

  return (
    <div className="relative">
      <Button ref={triggerRef} className="h-10 px-2 sm:px-3" type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        <span className="grid h-6 w-6 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
          {initials || <UserCircle className="h-4 w-4" />}
        </span>
        <span className="hidden max-w-32 truncate text-left sm:block">{auth.user?.name ?? auth.user?.email ?? "Пользователь"}</span>
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform duration-200 sm:block", open && "rotate-180")} />
      </Button>

      {open ? (
        <div ref={panelRef} className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-panel backdrop-blur-xl">
          <div className="border-b border-border/70 px-3 py-3">
            <div className="truncate text-sm font-medium">{auth.user?.name ?? "Пользователь"}</div>
            <div className="truncate text-xs text-muted-foreground">{auth.user?.email}</div>
          </div>
          <Link
            className="mt-2 flex h-10 items-center rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-300 crm-panel-motion hover:bg-sidebar-hover hover:text-foreground"
            href="/settings"
            onClick={close}
          >
            Настройки профиля
          </Link>
          <Button
            className="mt-1 w-full justify-start"
            type="button"
            variant="ghost"
            onClick={() => {
              close();
              void auth.logout();
            }}
          >
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
