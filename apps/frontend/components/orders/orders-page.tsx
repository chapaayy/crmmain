"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { Order, OrderStatus, PaginatedResponse } from "@/components/orders/order-types";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const statuses: OrderStatus[] = [
  "DRAFT",
  "NEW",
  "MANAGER_PROCESSING",
  "WAITING_PAYMENT",
  "PAID",
  "RESERVED",
  "PICKING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED"
];

export function OrdersPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Order>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    managerId: "",
    customerId: "",
    dateFrom: "",
    dateTo: ""
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
      const response = await auth.api.request<PaginatedResponse<Order>>(`/orders?${query}`);
      setOrders(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load orders", description: error instanceof Error ? error.message : undefined, variant: "error" });
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
    <PermissionGate permission="orders.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Orders</h2>
            <p className="text-sm text-muted-foreground">Customer orders, status flow, totals, and follow-up.</p>
          </div>
          {auth.hasPermission("orders.create") ? (
            <Button asChild>
              <Link href="/orders/new">
                <Plus className="h-4 w-4" />
                New order
              </Link>
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-6">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search order, customer, phone, INN"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <Input placeholder="Manager ID" value={filters.managerId} onChange={(event) => updateFilter("managerId", event.target.value)} />
              <Input placeholder="Customer ID" value={filters.customerId} onChange={(event) => updateFilter("customerId", event.target.value)} />
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Manager</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading orders
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No orders found
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3">
                          <Link className="font-medium text-primary hover:underline" href={`/orders/${order.id}`}>
                            {order.number}
                          </Link>
                          <div className="text-xs text-muted-foreground">{order._count?.items ?? 0} items</div>
                        </td>
                        <td className="px-4 py-3">{order.customer?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{order.manager?.name ?? "-"}</td>
                        <td className="px-4 py-3 font-medium">{formatMoney(order.total, order.currency)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
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

function statusVariant(status: OrderStatus): "success" | "warning" | "secondary" {
  if (status === "COMPLETED" || status === "PAID") {
    return "success";
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return "warning";
  }

  return "secondary";
}

function formatMoney(value: string | number, currency: string) {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
