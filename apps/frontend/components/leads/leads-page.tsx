"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { Lead, PaginatedResponse } from "@/components/customers/crm-types";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LeadsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Lead>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    managerId: "",
    source: "",
    status: ""
  });
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "12" });

    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        params.set(key, value);
      }
    }

    return params.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<PaginatedResponse<Lead>>(`/leads?${query}`);
      setLeads(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load leads", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PermissionGate permission="leads.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Leads</h2>
            <p className="text-sm text-muted-foreground">Incoming demand, qualification, and conversion.</p>
          </div>
          {auth.hasPermission("leads.create") ? (
            <Button asChild>
              <Link href="/leads/new">
                <Plus className="h-4 w-4" />
                New lead
              </Link>
            </Button>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, phone, email"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <Input placeholder="Manager ID" value={filters.managerId} onChange={(event) => updateFilter("managerId", event.target.value)} />
              <Input placeholder="Source" value={filters.source} onChange={(event) => updateFilter("source", event.target.value)} />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Next contact</th>
                    <th className="px-4 py-3 font-medium">Manager</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading leads
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                        No leads found
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="px-4 py-3">
                          <Link className="font-medium text-primary hover:underline" href={`/leads/${lead.id}`}>
                            {lead.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{[lead.phone, lead.email].filter(Boolean).join(" / ")}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.source ?? "-"}</td>
                        <td className="px-4 py-3">{lead.nextContactAt ? new Date(lead.nextContactAt).toLocaleString() : "-"}</td>
                        <td className="px-4 py-3">{lead.responsibleManager?.name ?? "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={lead.status === "WON" ? "success" : "secondary"}>{lead.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <PaginationControls meta={meta} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}
