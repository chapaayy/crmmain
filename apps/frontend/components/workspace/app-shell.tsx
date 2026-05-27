"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "crm-sidebar-open";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);

    if (stored === "false") {
      setDesktopSidebarOpen(false);
    }
  }, []);

  function toggleDesktopSidebar() {
    setDesktopSidebarOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        desktopOpen={desktopSidebarOpen}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div
        className={cn(
          "min-w-0 transition-[padding] duration-500 crm-panel-motion",
          desktopSidebarOpen ? "lg:pl-[19.5rem]" : "lg:pl-0"
        )}
      >
        <Topbar
          sidebarOpen={desktopSidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          onToggleSidebar={toggleDesktopSidebar}
        />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}
