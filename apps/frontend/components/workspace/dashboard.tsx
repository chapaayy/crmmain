"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Clock3,
  Loader2,
  PackageSearch,
  RefreshCw,
  ShieldAlert,
  Users,
  Warehouse
} from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/workspace/metric-card";
import { PageHeader } from "@/components/workspace/page-header";
import { EmptyState, ErrorState, LoadingState, ShimmerSkeleton } from "@/components/workspace/states";

interface AnalyticsDashboard {
  generatedAt: string;
  employees: {
    total: number;
    active: number;
    inactive: number;
    workedHours: number;
    unreadNotifications: number;
  };
  tasks: {
    total: number;
    overdue: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
    categories: number;
    lowStock: Array<{
      id: string;
      warehouse: { code: string; name: string };
      product: { id: string; sku: string; name: string; minOrderQty: number };
      variant: { id: string; sku: string; name: string } | null;
      available: number;
      unit: string;
      threshold: number;
    }>;
  };
  warehouse: {
    warehousesTotal: number;
    warehousesActive: number;
    stockItems: number;
    quantity: number;
    reserved: number;
    available: number;
    lowStock: Array<{
      id: string;
      warehouse: { code: string; name: string };
      product: { id: string; sku: string; name: string; minOrderQty: number };
      variant: { id: string; sku: string; name: string } | null;
      available: number;
      unit: string;
      threshold: number;
    }>;
    movementsToday: number;
  };
  payroll?: {
    visible: boolean;
    salaryFund: number | null;
    accrued: number | null;
    bonuses: number | null;
    penalties: number | null;
    net: number | null;
    paid: number | null;
    unpaid: number | null;
    workedHours: number | null;
    overtimeHours: number | null;
    unapprovedHours: number | null;
  };
}

const taskStatusLabels: Record<string, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
  CANCELLED: "Отменено"
};

export function Dashboard() {
  const auth = useAuth();
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    managerId: "",
    categoryId: ""
  });
  const canReadPayroll = auth.hasPermission(["payroll.read", "payroll.manage"]);
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
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await auth.api.request<AnalyticsDashboard>(`/analytics/dashboard${query ? `?${query}` : ""}`);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PermissionGate permission="analytics.read">
      <main className="crm-page">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
          <PageHeader
            breadcrumbs={["Обзор", "Аналитика"]}
            icon={<BarChart3 className="h-5 w-5" />}
            title="Аналитика"
            description="Сводка по сотрудникам, задачам, товарам, складу и зарплате."
          />
          <div className="crm-surface grid gap-2 rounded-2xl p-3 sm:grid-cols-2 xl:w-[760px] xl:grid-cols-[150px_150px_1fr_1fr_auto]">
            <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            <Input placeholder="ID сотрудника" value={filters.managerId} onChange={(event) => updateFilter("managerId", event.target.value)} />
            <Input placeholder="ID категории" value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)} />
            <Button className="w-full xl:w-10 xl:px-0" disabled={loading} type="button" variant="outline" onClick={() => void load()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="xl:sr-only">Обновить</span>
            </Button>
          </div>
        </div>

        {error ? <ErrorState label="Не удалось загрузить аналитику" description={error} onRetry={() => void load()} /> : null}

        {!error ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Users} label="Активные сотрудники" loading={loading} value={data?.employees.active ?? 0} note={`${data?.employees.total ?? 0} всего`} />
              <MetricCard icon={Clock3} label="Часы за период" loading={loading} value={`${formatNumber(data?.employees.workedHours ?? 0)} ч`} note={`${data?.employees.unreadNotifications ?? 0} уведомлений`} />
              <MetricCard icon={ShieldAlert} label="Просроченные задачи" loading={loading} value={data?.tasks.overdue ?? 0} note={`${data?.tasks.total ?? 0} задач`} tone={(data?.tasks.overdue ?? 0) > 0 ? "danger" : "success"} />
              <MetricCard icon={PackageSearch} label="Низкие остатки" loading={loading} value={data?.warehouse.lowStock.length ?? 0} note={`${formatQuantity(data?.warehouse.available ?? 0)} доступно`} tone="warning" />
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Warehouse} label="Склады" loading={loading} value={data?.warehouse.warehousesActive ?? 0} note={`${data?.warehouse.warehousesTotal ?? 0} всего`} />
              <MetricCard icon={PackageSearch} label="Складские позиции" loading={loading} value={data?.warehouse.stockItems ?? 0} note={`${formatQuantity(data?.warehouse.quantity ?? 0)} единиц`} />
              <MetricCard icon={RefreshCw} label="Движения сегодня" loading={loading} value={data?.warehouse.movementsToday ?? 0} note={`${formatQuantity(data?.warehouse.reserved ?? 0)} в резерве`} />
              <MetricCard icon={BarChart3} label="Товарные категории" loading={loading} value={data?.products.categories ?? 0} note={`${data?.products.active ?? 0} активных товаров`} />
            </section>

            {showPayroll ? (
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={BarChart3} label="Фонд зарплаты" loading={loading} value={formatMoney(data?.payroll?.salaryFund ?? 0)} note={`${formatMoney(data?.payroll?.net ?? 0)} к выплате`} />
                <MetricCard icon={BarChart3} label="Начислено" loading={loading} value={formatMoney(data?.payroll?.accrued ?? 0)} note={`${formatMoney(data?.payroll?.paid ?? 0)} выплачено`} />
                <MetricCard icon={BarChart3} label="Бонусы / штрафы" loading={loading} value={`${formatMoney(data?.payroll?.bonuses ?? 0)} / ${formatMoney(data?.payroll?.penalties ?? 0)}`} note={`${formatMoney(data?.payroll?.unpaid ?? 0)} осталось`} />
                <MetricCard icon={Clock3} label="Часы payroll" loading={loading} value={`${formatNumber(data?.payroll?.workedHours ?? 0)} ч`} note={`${formatNumber(data?.payroll?.overtimeHours ?? 0)} сверхурочно / ${formatNumber(data?.payroll?.unapprovedHours ?? 0)} не утверждено`} />
              </section>
            ) : null}

            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-surface/35">
                  <CardTitle>Задачи по статусам</CardTitle>
                  {data ? <Badge variant="outline">{data.tasks.total} задач</Badge> : null}
                </CardHeader>
                <CardContent className="pt-5">
                  {loading ? (
                    <LoadingState label="Загружаем статусы задач" />
                  ) : data && data.tasks.byStatus.some((item) => item.count > 0) ? (
                    <StatusChart items={data.tasks.byStatus} />
                  ) : (
                    <EmptyState label="Задач за период нет" icon={AlertCircle} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/60 bg-surface/35">
                  <CardTitle>Товары и склад</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
                  <MiniStat label="Товаров" loading={loading} value={data?.products.total ?? 0} />
                  <MiniStat label="Активных" loading={loading} value={data?.products.active ?? 0} />
                  <MiniStat label="В резерве" loading={loading} value={formatQuantity(data?.warehouse.reserved ?? 0)} />
                  <MiniStat label="Доступно" loading={loading} value={formatQuantity(data?.warehouse.available ?? 0)} />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ListCard title="Низкие остатки">
                {loading ? (
                  <LoadingState label="Загружаем склад" />
                ) : data && data.warehouse.lowStock.length > 0 ? (
                  <div className="space-y-3">
                    {data.warehouse.lowStock.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border/70 bg-muted/15 p-3">
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
                          Порог {item.threshold} {item.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={PackageSearch} label="Товаров с низким остатком нет" />
                )}
              </ListCard>

              <ListCard title="Статус payroll">
                {showPayroll ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniStat label="Начислено" loading={loading} value={formatMoney(data?.payroll?.accrued ?? 0)} />
                    <MiniStat label="К выплате" loading={loading} value={formatMoney(data?.payroll?.net ?? 0)} />
                    <MiniStat label="Выплачено" loading={loading} value={formatMoney(data?.payroll?.paid ?? 0)} />
                    <MiniStat label="Не выплачено" loading={loading} value={formatMoney(data?.payroll?.unpaid ?? 0)} />
                  </div>
                ) : (
                  <EmptyState icon={BarChart3} label="Блок payroll скрыт по правам доступа" />
                )}
              </ListCard>
            </section>
          </>
        ) : null}
      </main>
    </PermissionGate>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b border-border/60 bg-surface/35">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: number | string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/15 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{loading ? <ShimmerSkeleton className="h-7 w-16 rounded-lg" /> : value}</div>
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
            <div className="truncate text-sm text-muted-foreground">{taskStatusLabels[item.status] ?? item.status}</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-glow" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
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
  }).format(value ?? 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(value ?? 0);
}
