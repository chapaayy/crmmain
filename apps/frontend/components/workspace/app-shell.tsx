"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:pl-[19.5rem]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="min-h-[calc(100vh-4rem)] animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
