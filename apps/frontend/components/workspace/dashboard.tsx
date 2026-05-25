"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  ClipboardList,
  Clock3,
  HandCoins,
  Loader2,
  PackageSearch,
  Percent,
  RefreshCw,
  Send,
  TrendingUp,
  UserRoundCheck,
  Users
} from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/workspace/metric-card";
import { PageHeader } from "@/components/workspace/page-header";
import { EmptyState, LoadingState } from "@/components/workspace/states";

interface AnalyticsDashboard {
  generatedAt: string;
  financeVisible: boolean;
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
    available: number;
    reserved: number;
    shipmentsToday: number;
    lowStock: Array<{
      id: string;
      warehouse: {
        code: string;
      };
      product: {
        id: string;
        sku: string;
        name: string;
      };
      variant: {
        id: string;
        sku: string;
        name: string;
      } | null;
      available: number;
      unit: string;
      threshold: number;
    }>;
  };
  payroll?: {
    visible: boolean;
    salaryFund: number | null;
    accrued: number | null;
    bonuses: number | null;
    penalties: number | null;
    commissions: number | null;
    net: number | null;
    paid: number | null;
    unpaid: number | null;
    workedHours: number | null;
    overtimeHours: number | null;
    unapprovedHours: number | null;
  };
  employees?: {
    active: number;
    total: number;
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  NEW: "Новый",
  MANAGER_PROCESSING: "В обработке",
  WAITING_PAYMENT: "Ожидает оплату",
  PAID: "Оплачен",
  RESERVED: "Резерв",
  PICKING: "Сборка",
  SHIPPED: "Отгружен",
  DELIVERED: "Доставлен",
  COMPLETED: "Завершен",
  CANCELLED: "Отменен",
  REFUNDED: "Возврат"
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
  const canReadPayroll = auth.hasPermission(["payroll.read", "payroll.manage"]);
  const showFinance = Boolean(data?.financeVisible && canReadFinance);
  const showPayroll = Boolean(data?.payroll?.visible && canReadPayroll);
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
      <main className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <PageHeader title="Dashboard" description="Заказы, лиды, склад, финансы и зарплата за выбранный период." />
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
          <MetricCard icon={ClipboardList} label="Заказы сегодня" loading={loading} value={data?.orders.today ?? 0} note={`${data?.orders.week ?? 0} за неделю`} />
          <MetricCard
            icon={TrendingUp}
            label="Продажи за месяц"
            loading={loading}
            value={showFinance ? formatMoney(data?.sales.salesTotal ?? 0) : "Hidden"}
            note={showFinance ? `${formatMoney(data?.sales.averageCheck ?? 0)} средний чек` : "Requires payments.read"}
          />
          <MetricCard icon={Users} label="Новые лиды" loading={loading} value={data?.leads.new ?? 0} note={`${formatPercent(data?.leads.conversionRate ?? 0)} конверсия`} />
          <MetricCard
            icon={Send}
            label="Неоплаченные счета"
            loading={loading}
            value={showFinance ? data?.sales.unpaidInvoices.count ?? 0 : "Hidden"}
            note={showFinance ? `${formatMoney(data?.sales.unpaidInvoices.total ?? 0)} к оплате` : "Finance hidden"}
            tone="warning"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Send} label="Отгрузки сегодня" loading={loading} value={data?.orders.shipmentsToday ?? 0} note={`${data?.warehouse.shipmentsToday ?? 0} склад`} />
          <MetricCard icon={PackageSearch} label="Низкие остатки" loading={loading} value={data?.warehouse.lowStock.length ?? 0} note={`${formatQuantity(data?.warehouse.available ?? 0)} доступно`} tone="warning" />
          <MetricCard icon={AlertCircle} label="Просроченные задачи" loading={loading} value={data?.orders.overdueTasks ?? 0} note={`${data?.orders.total ?? 0} заказов в фильтре`} tone={(data?.orders.overdueTasks ?? 0) > 0 ? "danger" : "success"} />
          <MetricCard icon={UserRoundCheck} label="Активные сотрудники" loading={loading} value={data?.employees?.active ?? "—"} note={data?.employees ? `${data.employees.total} всего` : "HR metrics fallback"} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={HandCoins} label="Фонд зарплаты" loading={loading} value={showPayroll ? formatMoney(data?.payroll?.salaryFund ?? 0) : "Hidden"} note={showPayroll ? `${formatMoney(data?.payroll?.net ?? 0)} к выплате` : "Payroll hidden"} />
          <MetricCard icon={Banknote} label="Начислено" loading={loading} value={showPayroll ? formatMoney(data?.payroll?.accrued ?? 0) : "Hidden"} note={showPayroll ? `${formatMoney(data?.payroll?.paid ?? 0)} выплачено` : "Payroll hidden"} />
          <MetricCard icon={Percent} label="Комиссии менеджеров" loading={loading} value={showPayroll ? formatMoney(data?.payroll?.commissions ?? 0) : "Hidden"} note={showPayroll ? `${formatMoney(data?.payroll?.bonuses ?? 0)} бонусы / ${formatMoney(data?.payroll?.penalties ?? 0)} штрафы` : "Payroll hidden"} />
          <MetricCard icon={Clock3} label="Отработанные часы" loading={loading} value={showPayroll ? formatQuantity(data?.payroll?.workedHours ?? 0) : "Hidden"} note={showPayroll ? `${formatQuantity(data?.payroll?.overtimeHours ?? 0)} переработки / ${formatQuantity(data?.payroll?.unapprovedHours ?? 0)} не утверждено` : "Payroll hidden"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Заказы по статусам</CardTitle>
              {data ? <Badge variant="outline">{data.orders.total} orders</Badge> : null}
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState label="Loading order statuses" />
              ) : data && data.orders.byStatus.some((item) => item.count > 0) ? (
                <StatusChart items={data.orders.byStatus} />
              ) : (
                <EmptyState label="Заказов за период нет" icon={AlertCircle} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Воронка лидов</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Лиды" loading={loading} value={data?.leads.total ?? 0} />
              <MiniStat label="Конвертировано" loading={loading} value={data?.leads.converted ?? 0} />
              <MiniStat label="Заказы из лидов" loading={loading} value={data?.leads.ordersFromLeads ?? 0} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Популярные товары</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState label="Loading products" />
              ) : data && data.products.popular.length > 0 ? (
                <div className="space-y-3">
                  {data.products.popular.map((item) => (
                    <div key={item.product.id} className="rounded-md border border-border bg-muted/20 p-3">
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
                <EmptyState icon={PackageSearch} label="Продаж товаров пока нет" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Лучшие менеджеры</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState label="Loading managers" />
              ) : data && data.managers.best.length > 0 ? (
                <div className="space-y-3">
                  {data.managers.best.map((item) => (
                    <div key={item.managerId ?? "unassigned"} className="rounded-md border border-border bg-muted/20 p-3">
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
                <EmptyState icon={Users} label="Статистики по менеджерам пока нет" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Низкие остатки</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState label="Loading stock" />
              ) : data && data.warehouse.lowStock.length > 0 ? (
                <div className="space-y-3">
                  {data.warehouse.lowStock.map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
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
                <EmptyState icon={PackageSearch} label="Товаров с низким остатком нет" />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </PermissionGate>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : value}</div>
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
              <div className="h-full rounded-full bg-primary shadow-glow" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
            </div>
            <div className="text-sm font-medium sm:text-right">{item.count}</div>
          </div>
        ))}
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
