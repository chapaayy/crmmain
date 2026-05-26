"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clock3, Loader2, Plus, RefreshCw, Send, X } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Employee, PaginatedResponse, TimeEntry, WorkShift } from "./hr-types";
import { EmptyRow, LoadingRow, StatusBadge, compactPayload, formatDate, formatDateTime, fromDateTimeLocal } from "./hr-ui";

const shiftStatuses = ["PLANNED", "WORKED", "MISSED", "LATE", "SICK", "VACATION", "DAY_OFF"];

export function AttendancePage() {
  const auth = useAuth();
  const canViewShifts = auth.hasPermission(["attendance.read", "attendance.manage"]);

  return (
    <PermissionGate permission={["attendance.read", "attendance.manage", "attendance.own"]}>
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Рабочее время</h2>
          <p className="text-sm text-muted-foreground">Учет часов, табель и смены сотрудников.</p>
        </div>
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Табель часов</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Фиксация рабочих интервалов, отправка на утверждение, согласование HR или руководителем.</p>
              <Button asChild><Link href="/attendance/timesheet">Открыть табель</Link></Button>
            </CardContent>
          </Card>
          {canViewShifts ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Смены</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>Плановые и фактические смены, статусы выхода, отпусков, больничных и выходных.</p>
                <Button asChild variant="outline"><Link href="/attendance/shifts">Открыть смены</Link></Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>
    </PermissionGate>
  );
}

export function TimesheetPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<TimeEntry>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ employeeId: "", status: "", dateFrom: "", dateTo: "" });
  const [form, setForm] = useState({
    employeeId: "",
    date: new Date().toISOString().slice(0, 10),
    startedAt: "",
    endedAt: "",
    breakMinutes: "0",
    comment: ""
  });
  const canManage = auth.hasPermission("attendance.manage");
  const canCreateEntry = canManage || auth.hasPermission("attendance.own");
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "15" });

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
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
      const [entryResponse, employeesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<TimeEntry>>(`/time-entries?${query}`),
        canManage ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null)
      ]);

      setEntries(entryResponse.data);
      setMeta(entryResponse.meta);
      setEmployees(employeesResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить табель", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, canManage, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/time-entries", {
        method: "POST",
        body: JSON.stringify(
          compactPayload({
            employeeId: canManage ? form.employeeId : undefined,
            date: form.date,
            startedAt: fromDateTimeLocal(form.startedAt),
            endedAt: fromDateTimeLocal(form.endedAt),
            breakMinutes: Number(form.breakMinutes || 0),
            comment: form.comment
          })
        )
      });
      toast({ title: "Запись добавлена", variant: "success" });
      setForm((current) => ({ ...current, startedAt: "", endedAt: "", comment: "" }));
      await load();
    } catch (error) {
      toast({ title: "Не удалось добавить запись", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function action(id: string, path: string, title: string) {
    try {
      await auth.api.request(`/time-entries/${id}/${path}`, { method: "POST" });
      toast({ title, variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Действие не выполнено", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission={["attendance.read", "attendance.manage"]}>
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Табель</h2>
            <p className="text-sm text-muted-foreground">Рабочие часы и утверждение TimeEntry.</p>
          </div>
          <Button disabled={loading} type="button" variant="outline" onClick={() => void load()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Обновить
          </Button>
        </div>

        {canCreateEntry ? (
          <Card>
            <CardHeader><CardTitle>Добавить часы</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => void createEntry(event)}>
                {canManage ? (
                  <select className="h-10 rounded-md border bg-background px-3 text-sm xl:col-span-2" value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}>
                    <option value="">Сотрудник</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}</option>
                    ))}
                  </select>
                ) : null}
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                <Input type="datetime-local" value={form.startedAt} onChange={(event) => setForm((current) => ({ ...current, startedAt: event.target.value }))} />
                <Input type="datetime-local" value={form.endedAt} onChange={(event) => setForm((current) => ({ ...current, endedAt: event.target.value }))} />
                <Input min="0" type="number" value={form.breakMinutes} onChange={(event) => setForm((current) => ({ ...current, breakMinutes: event.target.value }))} />
                <Button type="submit"><Plus className="h-4 w-4" /> Добавить</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle>Записи</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {canManage ? (
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.employeeId} onChange={(event) => updateFilter("employeeId", event.target.value)}>
                  <option value="">Все сотрудники</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}</option>)}
                </select>
              ) : null}
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">Все статусы</option>
                <option value="DRAFT">Черновик</option>
                <option value="SUBMITTED">На утверждении</option>
                <option value="APPROVED">Утверждено</option>
                <option value="REJECTED">Отклонено</option>
              </select>
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Время</th>
                    <th className="px-4 py-3 font-medium">Часы</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={6} label="Загрузка табеля" /> : entries.length === 0 ? <EmptyRow colSpan={6} label="Записей нет" /> : entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3">{entry.employee ? `${entry.employee.lastName} ${entry.employee.firstName}` : "-"}</td>
                      <td className="px-4 py-3">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(entry.startedAt)} - {formatDateTime(entry.endedAt)}</td>
                      <td className="px-4 py-3">{(entry.totalMinutes / 60).toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canCreateEntry && entry.status === "DRAFT" ? <Button size="sm" type="button" variant="outline" onClick={() => void action(entry.id, "submit", "Отправлено")}><Send className="h-4 w-4" /> Отправить</Button> : null}
                          {canManage && entry.status !== "APPROVED" ? <Button size="sm" type="button" variant="outline" onClick={() => void action(entry.id, "approve", "Утверждено")}><Check className="h-4 w-4" /> Утвердить</Button> : null}
                          {canManage && entry.status !== "REJECTED" ? <Button size="sm" type="button" variant="outline" onClick={() => void action(entry.id, "reject", "Отклонено")}><X className="h-4 w-4" /> Отклонить</Button> : null}
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

export function ShiftsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<WorkShift>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ employeeId: "", status: "" });
  const [form, setForm] = useState({ employeeId: "", date: new Date().toISOString().slice(0, 10), status: "PLANNED", comment: "" });
  const canManage = auth.hasPermission("attendance.manage");
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "15" });

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
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
      const [shiftsResponse, employeesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<WorkShift>>(`/work-shifts?${query}`),
        auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true")
      ]);

      setShifts(shiftsResponse.data);
      setMeta(shiftsResponse.meta);
      setEmployees(employeesResponse.data);
    } catch (error) {
      toast({ title: "Не удалось загрузить смены", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/work-shifts", {
        method: "POST",
        body: JSON.stringify(compactPayload(form))
      });
      toast({ title: "Смена создана", variant: "success" });
      setForm((current) => ({ ...current, comment: "" }));
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать смену", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="attendance.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Смены</h2>
          <p className="text-sm text-muted-foreground">Плановые и фактические смены сотрудников.</p>
        </div>
        {canManage ? (
          <Card>
            <CardHeader><CardTitle>Создать смену</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => void createShift(event)}>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}>
                  <option value="">Сотрудник</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}</option>)}
                </select>
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {shiftStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <Input placeholder="Комментарий" value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
                <Button type="submit"><Plus className="h-4 w-4" /> Создать</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Список смен</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.employeeId} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, employeeId: event.target.value })); }}>
                <option value="">Все сотрудники</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, status: event.target.value })); }}>
                <option value="">Все статусы</option>
                {shiftStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">План</th>
                    <th className="px-4 py-3 font-medium">Факт</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={5} label="Загрузка смен" /> : shifts.length === 0 ? <EmptyRow colSpan={5} label="Смен нет" /> : shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="px-4 py-3">{shift.employee ? `${shift.employee.lastName} ${shift.employee.firstName}` : "-"}</td>
                      <td className="px-4 py-3">{formatDate(shift.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(shift.plannedStart)} - {formatDateTime(shift.plannedEnd)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(shift.actualStart)} - {formatDateTime(shift.actualEnd)}</td>
                      <td className="px-4 py-3"><StatusBadge status={shift.status} /></td>
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
