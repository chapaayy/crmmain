"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import type { PaginatedResponse, StockItem, WarehousesResponse } from "@/components/warehouse/warehouse-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function WarehouseStockPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehousesResponse["warehouses"]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<StockItem>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    warehouseId: ""
  });
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });

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
      const [stockResponse, warehousesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<StockItem>>(`/warehouse/stock?${query}`),
        auth.api.request<WarehousesResponse>("/warehouses")
      ]);
      setStock(stockResponse.data);
      setMeta(stockResponse.meta);
      setWarehouses(warehousesResponse.warehouses);
    } catch (error) {
      toast({ title: "Unable to load stock", description: error instanceof Error ? error.message : undefined, variant: "error" });
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
    <PermissionGate permission="warehouse.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-normal">Stock</h2>
          <p className="text-sm text-muted-foreground">Physical quantity, reserved quantity, and available stock.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Stock balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search product, SKU, warehouse"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filters.warehouseId}
                onChange={(event) => updateFilter("warehouseId", event.target.value)}
              >
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} / {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Warehouse</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Reserved</th>
                    <th className="px-4 py-3 font-medium">Available</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading stock
                      </td>
                    </tr>
                  ) : stock.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No stock items found
                      </td>
                    </tr>
                  ) : (
                    stock.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.variant?.name ?? item.product.name}</div>
                          <div className="text-xs text-muted-foreground">{item.variant?.sku ?? item.product.sku}</div>
                        </td>
                        <td className="px-4 py-3">{item.warehouse.code}</td>
                        <td className="px-4 py-3">{formatQuantity(item.quantity)} {item.unit}</td>
                        <td className="px-4 py-3">{formatQuantity(item.reservedQuantity)} {item.unit}</td>
                        <td className="px-4 py-3">
                          <Badge variant={item.available > 0 ? "success" : "warning"}>{formatQuantity(item.available)} {item.unit}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</td>
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

function formatQuantity(value: string | number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
