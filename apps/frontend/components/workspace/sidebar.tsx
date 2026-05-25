"use client";

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
  onClose
}: {
  open?: boolean;
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar lg:block">
        {content}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            type="button"
            onClick={onClose}
          />
          <aside className="relative h-full w-[min(20rem,calc(100vw-2rem))] border-r border-sidebar-border bg-sidebar shadow-panel">
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-primary/30 bg-primary/15 text-primary shadow-glow">
          <Boxes className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">CRM Polybags</div>
          <div className="truncate text-xs text-muted-foreground">Workspace</div>
        </div>
        <Button className="lg:hidden" size="icon" type="button" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {menuGroups.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);

          if (!groupItems.length) {
            return null;
          }

          return (
            <SidebarGroup key={group.key} title={group.label}>
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

export function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="px-3 text-[11px] font-semibold text-muted-foreground">{title}</div>
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
        "group flex h-10 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-all hover:border-sidebar-border hover:bg-sidebar-hover hover:text-foreground",
        active && "border-primary/35 bg-sidebar-active text-primary shadow-glow"
      )}
      onClick={onNavigate}
    >
      <item.icon className={cn("h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary", active && "text-primary")} />
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
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveHref(pathname: string, items: MenuItem[] = menuItems) {
  return [...items].sort((left, right) => right.href.length - left.href.length).find((item) => isActive(pathname, item.href))?.href;
}
