"use client";

import { useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:pl-72">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}
