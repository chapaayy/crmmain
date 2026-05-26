"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import type { PaginatedResponse, StockMovement, StockMovementType, WarehousesResponse } from "@/components/warehouse/warehouse-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const movementTypes: StockMovementType[] = [
  "RECEIPT",
  "SALE",
  "RESERVATION",
  "RELEASE_RESERVATION",
  "SHIPMENT",
  "RETURN",
  "ADJUSTMENT",
  "TRANSFER",
  "WRITEOFF"
];

export function WarehouseMovementsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<WarehousesResponse["warehouses"]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<StockMovement>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    warehouseId: "",
    type: "",
    dateFrom: "",
    dateTo: ""
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
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [movementResponse, warehousesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<StockMovement>>(`/warehouse/movements?${query}`),
        auth.api.request<WarehousesResponse>("/warehouses")
      ]);
      setMovements(movementResponse.data);
      setMeta(movementResponse.meta);
      setWarehouses(warehousesResponse.warehouses);
    } catch (error) {
      toast({ title: "Unable to load movements", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PermissionGate permission="warehouse.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-normal">Stock movements</h2>
          <p className="text-sm text-muted-foreground">Every receipt, reservation, release, shipment, adjustment, and writeoff.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Movement journal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-6">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search reference, product, order" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.warehouseId} onChange={(event) => updateFilter("warehouseId", event.target.value)}>
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} / {warehouse.name}
                  </option>
                ))}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
                <option value="">All types</option>
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Warehouse</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading movements
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No movements found
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-4 py-3"><Badge variant={movementVariant(movement.type)}>{movement.type}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{movement.variant?.name ?? movement.product.name}</div>
                          <div className="text-xs text-muted-foreground">{movement.variant?.sku ?? movement.product.sku}</div>
                        </td>
                        <td className="px-4 py-3">{movement.warehouse.code}</td>
                        <td className="px-4 py-3">{formatQuantity(movement.quantity)} {movement.unit}</td>
                        <td className="px-4 py-3">{movement.order?.number ?? movement.reference ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(movement.createdAt).toLocaleString()}</td>
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

function movementVariant(type: StockMovementType): "success" | "warning" | "secondary" {
  if (type === "RECEIPT" || type === "RETURN" || type === "RELEASE_RESERVATION") {
    return "success";
  }

  if (type === "WRITEOFF" || type === "SHIPMENT") {
    return "warning";
  }

  return "secondary";
}

function formatQuantity(value: string | number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
