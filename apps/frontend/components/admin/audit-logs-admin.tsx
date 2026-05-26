"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { AuditLog, PaginatedResponse } from "@/components/admin/admin-types";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuditLogsAdmin() {
  const auth = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<AuditLog>["meta"]>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "15", search }).toString(), [page, search]);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<PaginatedResponse<AuditLog>>(`/audit-logs?${query}`);
      setLogs(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load audit logs", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  return (
    <PermissionGate permission="audit_logs.read">
      <main className="p-4 sm:p-6">
        <AdminPageHeader title="Audit Logs" description="Security and administration activity." permission="audit_logs.read" />
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Activity</CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search actor or entity"
                  value={search}
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading logs
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{log.entityType}</div>
                          <div className="text-xs text-muted-foreground">{log.entityId}</div>
                        </td>
                        <td className="px-4 py-3">{log.actor?.email ?? "system"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls meta={meta} onPageChange={setPage} />
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}
