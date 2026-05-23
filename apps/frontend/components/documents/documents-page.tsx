"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import type { Document, DocumentType, PaginatedResponse } from "@/components/orders/order-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const documentTypes: Array<DocumentType | ""> = ["", "INVOICE", "COMMERCIAL_OFFER", "DELIVERY_NOTE", "ACT", "CONTRACT"];

export function DocumentsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Document>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    type: ""
  });
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20"
    });

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }

    return params.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<PaginatedResponse<Document>>(`/documents?${query}`);
      setDocuments(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load documents", description: error instanceof Error ? error.message : undefined, variant: "error" });
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

  async function downloadDocument(document: Document) {
    try {
      const blob = await auth.api.requestBlob(`/documents/${document.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = document.fileAsset?.originalName ?? `${document.number ?? document.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Download failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="documents.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-normal">Documents</h2>
          <p className="text-sm text-muted-foreground">Invoices, commercial offers, delivery notes, acts, and contracts.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Document list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-3">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by number, title, order, customer"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
                {documentTypes.map((type) => (
                  <option key={type || "all"} value={type}>
                    {type || "All types"}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading documents
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No documents found
                      </td>
                    </tr>
                  ) : (
                    documents.map((document) => (
                      <tr key={document.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{document.title}</div>
                          <div className="text-xs text-muted-foreground">{document.number ?? document.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          {document.orderId ? (
                            <Link className="text-primary hover:underline" href={`/orders/${document.orderId}`}>
                              {document.order?.number ?? document.orderId}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">{document.order?.customer?.companyName || document.order?.customer?.name || "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{document.type}</Badge>
                        </td>
                        <td className="px-4 py-3">{new Date(document.issuedAt ?? document.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" type="button" variant="outline" onClick={() => void downloadDocument(document)}>
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
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
