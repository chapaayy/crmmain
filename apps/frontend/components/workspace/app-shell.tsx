"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { getHostMode } from "@/lib/domains";
import type { WorkspaceMode } from "@/lib/domains";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<WorkspaceMode>("crm");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMode(getHostMode(window.location.hostname));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mode={mode} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:pl-72">
        <Topbar mode={mode} onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}
