"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  Banknote,
  Boxes,
  ClipboardList,
  Loader2,
  PackageSearch,
  Percent,
  RefreshCw,
  Send,
  TrendingUp,
  Users
} from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AnalyticsDashboard {
  generatedAt: string;
  financeVisible: boolean;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    managerId: string | null;
    source: string | null;
    categoryId: string | null;
  };
  orders: {
    total: number;
    today: number;
    week: number;
    month: number;
    overdueTasks: number;
    shipmentsToday: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  sales: {
    financeVisible: boolean;
    salesTotal: number | null;
    averageCheck: number | null;
    unpaidInvoices: {
      count: number | null;
      total: number | null;
    };
    margin: number | null;
    marginRate: number | null;
  };
  leads: {
    total: number;
    new: number;
    converted: number;
    ordersFromLeads: number;
    conversionRate: number;
  };
  products: {
    popular: Array<{
      product: {
        id: string;
        sku: string;
        name: string;
        minOrderQty: number;
      };
      quantity: number;
      ordersCount: number;
      revenue: number | null;
    }>;
  };
  managers: {
    best: Array<{
      managerId: string | null;
      manager: {
        id: string;
        email: string;
        name: string;
      } | null;
      ordersCount: number;
      salesTotal: number | null;
    }>;
  };
  warehouse: {
    warehousesTotal: number;
    warehousesActive: number;
    stockItems: number;
    quantity: number;
    reserved: number;
    available: number;
    shipmentsToday: number;
    lowStock: Array<{
      id: string;
      warehouse: {
        id: string;
        code: string;
        name: string;
      };
      product: {
        id: string;
        sku: string;
        name: string;
        minOrderQty: number;
      };
      variant: {
        id: string;
        sku: string;
        name: string;
      } | null;
      quantity: number;
      reserved: number;
      available: number;
      unit: string;
      threshold: number;
    }>;
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  NEW: "New",
  MANAGER_PROCESSING: "Processing",
  WAITING_PAYMENT: "Waiting payment",
  PAID: "Paid",
  RESERVED: "Reserved",
  PICKING: "Picking",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded"
};

export function Dashboard() {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    managerId: "",
    source: "",
    categoryId: ""
  });
  const canReadFinance = auth.hasPermission("payments.read") || auth.hasPermission("analytics.read_finance");
  const showFinance = Boolean(data?.financeVisible && canReadFinance);
  const query = useMemo(() => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<AnalyticsDashboard>(`/analytics/dashboard${query ? `?${query}` : ""}`);
      setData(response);
    } catch (error) {
      toast({ title: "Unable to load dashboard", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PermissionGate permission="analytics.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Dashboard</h2>
            <p className="text-sm text-muted-foreground">Orders, leads, stock, and sales health for the selected period.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[900px] xl:grid-cols-[150px_150px_1fr_1fr_1fr_auto]">
            <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            <Input placeholder="Manager ID" value={filters.managerId} onChange={(event) => updateFilter("managerId", event.target.value)} />
            <Input placeholder="Source" value={filters.source} onChange={(event) => updateFilter("source", event.target.value)} />
            <Input placeholder="Category ID" value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)} />
            <Button className="w-full xl:w-10 xl:px-0" disabled={loading} type="button" variant="outline" onClick={() => void load()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="xl:sr-only">Refresh</span>
            </Button>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ClipboardList} label="Orders today" loading={loading} value={data?.orders.today ?? 0} note={`${data?.orders.week ?? 0} this week`} />
          <MetricCard icon={TrendingUp} label="Orders month" loading={loading} value={data?.orders.month ?? 0} note={`${data?.orders.total ?? 0} in filter`} />
          <MetricCard icon={Users} label="New leads" loading={loading} value={data?.leads.new ?? 0} note={`${formatPercent(data?.leads.conversionRate ?? 0)} conversion`} />
          <MetricCard icon={AlertCircle} label="Overdue tasks" loading={loading} value={data?.orders.overdueTasks ?? 0} note={`${data?.orders.shipmentsToday ?? 0} shipments today`} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Banknote}
            label="Sales"
            loading={loading}
            value={showFinance ? formatMoney(data?.sales.salesTotal ?? 0) : "Hidden"}
            note={showFinance ? `${formatMoney(data?.sales.averageCheck ?? 0)} avg check` : "Requires payments.read"}
          />
          <MetricCard
            icon={Percent}
            label="Margin"
            loading={loading}
            value={showFinance ? formatMoney(data?.sales.margin ?? 0) : "Hidden"}
            note={showFinance ? `${formatPercent(data?.sales.marginRate ?? 0)} margin rate` : "Finance hidden"}
          />
          <MetricCard
            icon={Send}
            label="Unpaid invoices"
            loading={loading}
            value={showFinance ? data?.sales.unpaidInvoices.count ?? 0 : "Hidden"}
            note={showFinance ? `${formatMoney(data?.sales.unpaidInvoices.total ?? 0)} unpaid` : "Finance hidden"}
          />
          <MetricCard
            icon={Boxes}
            label="Available stock"
            loading={loading}
            value={formatQuantity(data?.warehouse.available ?? 0)}
            note={`${formatQuantity(data?.warehouse.reserved ?? 0)} reserved`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Orders by status</CardTitle>
              {data ? <Badge variant="outline">{data.orders.total} orders</Badge> : null}
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingBlock label="Loading order statuses" />
              ) : data && data.orders.byStatus.some((item) => item.count > 0) ? (
                <StatusChart items={data.orders.byStatus} />
              ) : (
                <EmptyState label="No orders in this period" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead funnel</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Leads" loading={loading} value={data?.leads.total ?? 0} />
              <MiniStat label="Converted" loading={loading} value={data?.leads.converted ?? 0} />
              <MiniStat label="Orders from leads" loading={loading} value={data?.leads.ordersFromLeads ?? 0} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Popular products</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingBlock label="Loading products" />
              ) : data && data.products.popular.length > 0 ? (
                <div className="space-y-3">
                  {data.products.popular.map((item) => (
                    <div key={item.product.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.product.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{item.product.sku}</div>
                        </div>
                        <Badge variant="secondary">{formatQuantity(item.quantity)}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.ordersCount} lines</span>
                        <span>{showFinance ? formatMoney(item.revenue ?? 0) : "Revenue hidden"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={PackageSearch} label="No product sales yet" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best managers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingBlock label="Loading managers" />
              ) : data && data.managers.best.length > 0 ? (
                <div className="space-y-3">
                  {data.managers.best.map((item) => (
                    <div key={item.managerId ?? "unassigned"} className="rounded-md border p-3">
                      <div className="text-sm font-medium">{item.manager?.name ?? "Unassigned"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.manager?.email ?? "No manager selected"}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span>{item.ordersCount} orders</span>
                        <span className="text-muted-foreground">{showFinance ? formatMoney(item.salesTotal ?? 0) : "Sales hidden"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Users} label="No manager performance yet" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingBlock label="Loading stock" />
              ) : data && data.warehouse.lowStock.length > 0 ? (
                <div className="space-y-3">
                  {data.warehouse.lowStock.map((item) => (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.variant?.name ?? item.product.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.warehouse.code} / {item.variant?.sku ?? item.product.sku}
                          </div>
                        </div>
                        <Badge variant="warning">{formatQuantity(item.available)}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Threshold {item.threshold} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Boxes} label="No low stock items" />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </PermissionGate>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  loading
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  note: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}</div>
        <p className="mt-1 text-sm text-muted-foreground">{loading ? "Loading" : note}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}</div>
    </div>
  );
}

function StatusChart({ items }: { items: Array<{ status: string; count: number }> }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {items
        .filter((item) => item.count > 0)
        .map((item) => (
          <div key={item.status} className="grid gap-2 sm:grid-cols-[160px_1fr_52px] sm:items-center">
            <div className="truncate text-sm text-muted-foreground">{statusLabels[item.status] ?? item.status}</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
            </div>
            <div className="text-sm font-medium sm:text-right">{item.count}</div>
          </div>
        ))}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ label, icon: Icon = AlertCircle }: { label: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <Icon className="mx-auto mb-2 h-4 w-4" />
      {label}
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 3
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}%`;
}
