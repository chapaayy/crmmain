"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { getHostMode } from "@/lib/domains";
import type { WorkspaceMode } from "@/lib/domains";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<WorkspaceMode>("crm");

  useEffect(() => {
    setMode(getHostMode(window.location.hostname));
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mode={mode} />
      <div className="min-w-0 flex-1">
        <Topbar mode={mode} />
        {children}
      </div>
    </div>
  );
}
