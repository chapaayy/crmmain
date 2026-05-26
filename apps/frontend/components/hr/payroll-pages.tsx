"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Download, HandCoins, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CommissionRule, Employee, PaginatedResponse, PayrollAdjustment, PayrollPeriod, PayrollRun } from "./hr-types";
import { EmptyRow, LoadingRow, StatusBadge, compactPayload, formatDate, formatMoney, formatNumber } from "./hr-ui";

const adjustmentTypes = ["BONUS", "PENALTY", "CORRECTION"];
const commissionSources = ["PAID_ORDERS", "COMPLETED_ORDERS", "PROFIT"];

export function PayrollPage() {
  return (
    <PermissionGate permission={["payroll.read", "payroll.manage"]}>
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Зарплата</h2>
          <p className="text-sm text-muted-foreground">Периоды, расчеты, утверждение, выплаты и экспорт отчета.</p>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PayrollNavCard title="Периоды" href="/payroll/periods" text="Месячные или произвольные периоды расчета." />
          <PayrollNavCard title="Расчеты" href="/payroll/runs" text="Запуск расчета, утверждение и выплата." />
          <PayrollNavCard title="Бонусы / штрафы" href="/payroll/adjustments" text="Разовые корректировки по сотрудникам." />
          <PayrollNavCard title="Правила комиссий" href="/payroll/commission-rules" text="Проценты менеджеров с продаж." />
        </section>
      </main>
    </PermissionGate>
  );
}

export function PayrollPeriodsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<PayrollPeriod>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", dateFrom: "", dateTo: "" });
  const canManage = auth.hasPermission("payroll.manage");
  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<PaginatedResponse<PayrollPeriod>>(`/payroll/periods?page=${page}&limit=15`);
      setPeriods(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Не удалось загрузить периоды", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, page, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/payroll/periods", {
        method: "POST",
        body: JSON.stringify(compactPayload(form))
      });
      toast({ title: "Период создан", variant: "success" });
      setForm({ name: "", dateFrom: "", dateTo: "" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать период", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="payroll.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Периоды зарплаты</h2>
          <p className="text-sm text-muted-foreground">Диапазоны дат для расчета начислений.</p>
        </div>
        {canManage ? (
          <Card>
            <CardHeader><CardTitle>Создать период</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void createPeriod(event)}>
                <Input placeholder="Название" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                <Input type="date" value={form.dateFrom} onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.target.value }))} />
                <Input type="date" value={form.dateTo} onChange={(event) => setForm((current) => ({ ...current, dateTo: event.target.value }))} />
                <Button type="submit"><Plus className="h-4 w-4" /> Создать</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Список периодов</CardTitle></CardHeader>
          <CardContent>
            <PayrollPeriodsTable loading={loading} periods={periods} meta={meta} onPageChange={setPage} />
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function PayrollRunsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<PayrollRun>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [periodId, setPeriodId] = useState("");
  const canManage = auth.hasPermission("payroll.manage");
  const canApprove = auth.hasPermission("payroll.approve");
  const canExport = auth.hasPermission("payroll.export");
  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [runsResponse, periodsResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<PayrollRun>>(`/payroll/runs?page=${page}&limit=15`),
        auth.api.request<PaginatedResponse<PayrollPeriod>>("/payroll/periods?limit=100")
      ]);
      setRuns(runsResponse.data);
      setMeta(runsResponse.meta);
      setPeriods(periodsResponse.data);
    } catch (error) {
      toast({ title: "Не удалось загрузить расчеты", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, page, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/payroll/runs", {
        method: "POST",
        body: JSON.stringify({ periodId })
      });
      toast({ title: "Расчет создан", variant: "success" });
      setPeriodId("");
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать расчет", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function runAction(id: string, path: string, title: string) {
    try {
      await auth.api.request(`/payroll/runs/${id}/${path}`, { method: "POST" });
      toast({ title, variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Действие не выполнено", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function exportRun(id: string) {
    try {
      const csv = await auth.api.requestText(`/payroll/runs/${id}/export`);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `payroll-${id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Экспорт не выполнен", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="payroll.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Расчеты зарплаты</h2>
            <p className="text-sm text-muted-foreground">Backend пересчитывает суммы, фронт только запускает операции.</p>
          </div>
          <Button disabled={loading} type="button" variant="outline" onClick={() => void load()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Обновить
          </Button>
        </div>
        {canManage ? (
          <Card>
            <CardHeader><CardTitle>Новый расчет</CardTitle></CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void createRun(event)}>
                <select className="h-10 rounded-md border bg-background px-3 text-sm sm:w-80" value={periodId} onChange={(event) => setPeriodId(event.target.value)}>
                  <option value="">Период</option>
                  {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
                </select>
                <Button type="submit"><Plus className="h-4 w-4" /> Создать</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Список расчетов</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Период</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Начислено</th>
                    <th className="px-4 py-3 font-medium">К выплате</th>
                    <th className="px-4 py-3 font-medium">Строки</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={6} label="Загрузка расчетов" /> : runs.length === 0 ? <EmptyRow colSpan={6} label="Расчетов нет" /> : runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-primary hover:underline" href={`/payroll/runs/${run.id}`}>{run.period.name}</Link>
                        <div className="text-xs text-muted-foreground">{formatDate(run.period.dateFrom)} - {formatDate(run.period.dateTo)}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-3">{formatMoney(run.totalGross)}</td>
                      <td className="px-4 py-3">{formatMoney(run.totalNet)}</td>
                      <td className="px-4 py-3">{run._count?.lines ?? run.lines?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canManage ? <Button size="sm" type="button" variant="outline" onClick={() => void runAction(run.id, "calculate", "Расчет выполнен")}><Calculator className="h-4 w-4" /> Рассчитать</Button> : null}
                          {canApprove ? <Button size="sm" type="button" variant="outline" onClick={() => void runAction(run.id, "approve", "Расчет утвержден")}><CheckCircle2 className="h-4 w-4" /> Утвердить</Button> : null}
                          {canManage ? <Button size="sm" type="button" variant="outline" onClick={() => void runAction(run.id, "mark-paid", "Отмечено как выплачено")}><HandCoins className="h-4 w-4" /> Выплачено</Button> : null}
                          {canManage ? <Button size="sm" type="button" variant="outline" onClick={() => void runAction(run.id, "cancel", "Расчет отменен")}><XCircle className="h-4 w-4" /> Отменить</Button> : null}
                          {canExport ? <Button size="sm" type="button" variant="outline" onClick={() => void exportRun(run.id)}><Download className="h-4 w-4" /> CSV</Button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
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

export function PayrollRunDetailPage({ runId }: { runId: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<{ run: PayrollRun }>(`/payroll/runs/${runId}`);
      setRun(response.run);
    } catch (error) {
      toast({ title: "Не удалось загрузить расчет", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, runId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  return (
    <PermissionGate permission="payroll.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <Button asChild variant="ghost"><Link href="/payroll/runs">Назад</Link></Button>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{run?.period.name ?? "Расчет зарплаты"}</h2>
        </div>
        <section className="grid gap-3 md:grid-cols-4">
          <Metric title="Начислено" value={formatMoney(run?.totalGross)} loading={loading} />
          <Metric title="Бонусы" value={formatMoney(run?.totalBonuses)} loading={loading} />
          <Metric title="Штрафы" value={formatMoney(run?.totalPenalties)} loading={loading} />
          <Metric title="К выплате" value={formatMoney(run?.totalNet)} loading={loading} />
        </section>
        <Card>
          <CardHeader><CardTitle>Строки начислений</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 font-medium">Часы</th>
                    <th className="px-4 py-3 font-medium">Оклад</th>
                    <th className="px-4 py-3 font-medium">Часы/смены</th>
                    <th className="px-4 py-3 font-medium">Бонус/штраф</th>
                    <th className="px-4 py-3 font-medium">Комиссия</th>
                    <th className="px-4 py-3 font-medium">К выплате</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={7} label="Загрузка строк" /> : !run?.lines?.length ? <EmptyRow colSpan={7} label="Строк начислений нет" /> : run.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">{line.employee.lastName} {line.employee.firstName}<div className="text-xs text-muted-foreground">{line.employee.employeeNumber}</div></td>
                      <td className="px-4 py-3">{formatNumber(line.workedHours)} / сверх {formatNumber(line.overtimeHours)}</td>
                      <td className="px-4 py-3">{formatMoney(line.baseSalaryAmount)}</td>
                      <td className="px-4 py-3">{formatMoney(Number(line.hourlyAmount) + Number(line.shiftAmount) + Number(line.overtimeAmount))}</td>
                      <td className="px-4 py-3">{formatMoney(line.bonusAmount)} / {formatMoney(line.penaltyAmount)}</td>
                      <td className="px-4 py-3">{formatMoney(line.commissionAmount)}</td>
                      <td className="px-4 py-3 font-medium">{formatMoney(line.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function PayrollAdjustmentsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<PayrollAdjustment>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employeeId: "", periodId: "", type: "BONUS", amount: "", reason: "" });
  const canManage = auth.hasPermission("payroll.manage");
  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [adjustmentsResponse, employeesResponse, periodsResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<PayrollAdjustment>>(`/payroll/adjustments?page=${page}&limit=15`),
        auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true"),
        auth.api.request<PaginatedResponse<PayrollPeriod>>("/payroll/periods?limit=100")
      ]);
      setAdjustments(adjustmentsResponse.data);
      setMeta(adjustmentsResponse.meta);
      setEmployees(employeesResponse.data);
      setPeriods(periodsResponse.data);
    } catch (error) {
      toast({ title: "Не удалось загрузить корректировки", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, page, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/payroll/adjustments", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) })
      });
      toast({ title: "Корректировка создана", variant: "success" });
      setForm((current) => ({ ...current, amount: "", reason: "" }));
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать корректировку", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="payroll.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div><h2 className="text-2xl font-semibold tracking-normal">Бонусы / штрафы</h2></div>
        {canManage ? (
          <Card>
            <CardHeader><CardTitle>Новая корректировка</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => void createAdjustment(event)}>
                <SelectEmployee employees={employees} value={form.employeeId} onChange={(value) => setForm((current) => ({ ...current, employeeId: value }))} />
                <SelectPeriod periods={periods} value={form.periodId} onChange={(value) => setForm((current) => ({ ...current, periodId: value }))} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                  {adjustmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <Input placeholder="Сумма" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                <Input placeholder="Причина" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
                <Button type="submit"><Plus className="h-4 w-4" /> Добавить</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Список</CardTitle></CardHeader>
          <CardContent>
            <SimpleAdjustmentsTable adjustments={adjustments} loading={loading} meta={meta} onPageChange={setPage} />
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function CommissionRulesPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<CommissionRule>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employeeId: "", name: "", source: "PAID_ORDERS", percent: "", minOrderAmount: "", productCategoryId: "" });
  const canManage = auth.hasPermission("salary_rules.manage");
  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [rulesResponse, employeesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<CommissionRule>>(`/commission-rules?page=${page}&limit=15`),
        auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true")
      ]);
      setRules(rulesResponse.data);
      setMeta(rulesResponse.meta);
      setEmployees(employeesResponse.data);
    } catch (error) {
      toast({ title: "Не удалось загрузить правила", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, page, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/commission-rules", {
        method: "POST",
        body: JSON.stringify(compactPayload({ ...form, percent: Number(form.percent), minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined }))
      });
      toast({ title: "Правило создано", variant: "success" });
      setForm((current) => ({ ...current, name: "", percent: "", minOrderAmount: "", productCategoryId: "" }));
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать правило", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission={["salary_rules.read", "salary_rules.manage"]}>
      <main className="space-y-4 p-4 sm:p-6">
        <div><h2 className="text-2xl font-semibold tracking-normal">Правила комиссий</h2></div>
        {canManage ? (
          <Card>
            <CardHeader><CardTitle>Новое правило</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(event) => void createRule(event)}>
                <SelectEmployee employees={employees} value={form.employeeId} onChange={(value) => setForm((current) => ({ ...current, employeeId: value }))} />
                <Input placeholder="Название" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}>
                  {commissionSources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <Input placeholder="%" type="number" value={form.percent} onChange={(event) => setForm((current) => ({ ...current, percent: event.target.value }))} />
                <Input placeholder="Мин. заказ" type="number" value={form.minOrderAmount} onChange={(event) => setForm((current) => ({ ...current, minOrderAmount: event.target.value }))} />
                <Input placeholder="ID категории" value={form.productCategoryId} onChange={(event) => setForm((current) => ({ ...current, productCategoryId: event.target.value }))} />
                <Button type="submit"><Plus className="h-4 w-4" /> Создать</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Список правил</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Название</th>
                    <th className="px-4 py-3 font-medium">Сотрудник/роль</th>
                    <th className="px-4 py-3 font-medium">Источник</th>
                    <th className="px-4 py-3 font-medium">%</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={5} label="Загрузка правил" /> : rules.length === 0 ? <EmptyRow colSpan={5} label="Правил нет" /> : rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3">{rule.name}</td>
                      <td className="px-4 py-3">{rule.employee ? `${rule.employee.lastName} ${rule.employee.firstName}` : rule.role?.name ?? "Общее"}</td>
                      <td className="px-4 py-3">{rule.source}</td>
                      <td className="px-4 py-3">{formatNumber(rule.percent)}%</td>
                      <td className="px-4 py-3"><StatusBadge status={rule.isActive ? "ACTIVE" : "CLOSED"} /></td>
                    </tr>
                  ))}
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

function PayrollNavCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>{text}</p>
        <Button asChild variant="outline"><Link href={href}>Открыть</Link></Button>
      </CardContent>
    </Card>
  );
}

function PayrollPeriodsTable({ periods, loading, meta, onPageChange }: { periods: PayrollPeriod[]; loading: boolean; meta?: PaginatedResponse<PayrollPeriod>["meta"]; onPageChange: (page: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Название</th>
            <th className="px-4 py-3 font-medium">Даты</th>
            <th className="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? <LoadingRow colSpan={3} label="Загрузка периодов" /> : periods.length === 0 ? <EmptyRow colSpan={3} label="Периодов нет" /> : periods.map((period) => (
            <tr key={period.id}>
              <td className="px-4 py-3">{period.name}</td>
              <td className="px-4 py-3">{formatDate(period.dateFrom)} - {formatDate(period.dateTo)}</td>
              <td className="px-4 py-3"><StatusBadge status={period.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls meta={meta} onPageChange={onPageChange} />
    </div>
  );
}

function SimpleAdjustmentsTable({ adjustments, loading, meta, onPageChange }: { adjustments: PayrollAdjustment[]; loading: boolean; meta?: PaginatedResponse<PayrollAdjustment>["meta"]; onPageChange: (page: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Сотрудник</th>
            <th className="px-4 py-3 font-medium">Период</th>
            <th className="px-4 py-3 font-medium">Тип</th>
            <th className="px-4 py-3 font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Причина</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? <LoadingRow colSpan={5} label="Загрузка корректировок" /> : adjustments.length === 0 ? <EmptyRow colSpan={5} label="Корректировок нет" /> : adjustments.map((adjustment) => (
            <tr key={adjustment.id}>
              <td className="px-4 py-3">{adjustment.employee ? `${adjustment.employee.lastName} ${adjustment.employee.firstName}` : "-"}</td>
              <td className="px-4 py-3">{adjustment.period?.name ?? "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={adjustment.type} /></td>
              <td className="px-4 py-3">{formatMoney(adjustment.amount)}</td>
              <td className="px-4 py-3 text-muted-foreground">{adjustment.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls meta={meta} onPageChange={onPageChange} />
    </div>
  );
}

function SelectEmployee({ employees, value, onChange }: { employees: Employee[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Сотрудник</option>
      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}</option>)}
    </select>
  );
}

function SelectPeriod({ periods, value, onChange }: { periods: PayrollPeriod[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Период</option>
      {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
    </select>
  );
}

function Metric({ title, value, loading }: { title: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-semibold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}</div></CardContent>
    </Card>
  );
}
