"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { menuGroups, menuItems } from "@/lib/navigation";
import type { MenuItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  open,
  desktopOpen = true,
  onClose
}: {
  open?: boolean;
  desktopOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const items = getVisibleMenuItems(auth);

  const content = (
    <SidebarContent
      items={items}
      pathname={pathname}
      onNavigate={onClose}
      onClose={onClose}
    />
  );

  return (
    <>
      <aside
        className={cn(
          "fixed bottom-3 left-3 top-[4.25rem] z-40 hidden w-[18rem] overflow-hidden rounded-2xl border border-sidebar-border/90 bg-sidebar/95 shadow-panel shadow-black/35 backdrop-blur-xl transition-[transform,opacity] duration-500 crm-panel-motion will-change-transform lg:block",
          desktopOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(100%+1.5rem)] opacity-0"
        )}
      >
        {content}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 crm-panel-motion"
            type="button"
            onClick={onClose}
          />
          <aside className="relative m-3 h-[calc(100%-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-sidebar-border/90 bg-sidebar/95 shadow-panel transition-transform duration-500 crm-panel-motion">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function SidebarContent({
  items,
  pathname,
  onNavigate,
  onClose
}: {
  items: MenuItem[];
  pathname: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const activeHref = getActiveHref(pathname, items);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="pointer-events-none absolute -right-20 top-4 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-sidebar-border/80 px-4">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-glow">
          <Boxes className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">CRM Мешки</div>
          <div className="truncate text-xs text-muted-foreground">Рабочая область</div>
        </div>
        <Button className="lg:hidden" size="icon" type="button" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {menuGroups.map((group, index) => {
          const groupItems = items.filter((item) => item.group === group.key);

          if (!groupItems.length) {
            return null;
          }

          return (
            <SidebarGroup key={group.key} title={group.label} divided={index > 0}>
              {groupItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarGroup>
          );
        })}
      </nav>
    </div>
  );
}

export function SidebarGroup({
  title,
  children,
  divided
}: {
  title: string;
  children: ReactNode;
  divided?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", divided && "border-t border-dashed border-primary/15 pt-4")}>
      <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="h-3 w-0.5 rounded-full bg-primary/70" />
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function SidebarItem({
  item,
  active,
  onNavigate
}: {
  item: MenuItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-10 items-center gap-3 overflow-hidden rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-all duration-300 crm-panel-motion hover:translate-x-0.5 hover:border-primary/20 hover:bg-primary/8 hover:text-foreground",
        active && "border-primary/35 bg-sidebar-active/90 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_10px_28px_hsl(var(--primary)/0.08)]"
      )}
      onClick={onNavigate}
    >
      <span
        className={cn(
          "absolute inset-y-1 left-0 w-0.5 bg-transparent transition-colors duration-300 crm-panel-motion",
          active && "bg-primary"
        )}
      />
      <item.icon
        className={cn(
          "h-4 w-4 text-muted-foreground transition-all duration-300 crm-panel-motion group-hover:scale-105 group-hover:text-primary",
          active && "text-primary"
        )}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

export function getVisibleMenuItems(auth: ReturnType<typeof useAuth>) {
  const isAdminRole = auth.user
    ? [auth.user.primaryRole, auth.user.role, ...(auth.user.roles?.map((role) => role.code) ?? [])].some(
        (role) => role === "SUPER_ADMIN" || role === "ADMIN"
      )
    : false;

  return menuItems.filter((item) => {
    if (item.adminOnly && !isAdminRole) {
      return false;
    }

    return auth.hasPermission(item.permission);
  });
}

export function isActive(pathname: string, href: string) {
  if (href === "/home") {
    return pathname === "/" || pathname === "/home";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveHref(pathname: string, items: MenuItem[] = menuItems) {
  return [...items].sort((left, right) => right.href.length - left.href.length).find((item) => isActive(pathname, item.href))?.href;
}
