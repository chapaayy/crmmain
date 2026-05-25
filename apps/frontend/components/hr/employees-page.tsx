"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Employee, PaginatedResponse } from "./hr-types";
import { EmptyRow, LoadingRow, StatusBadge, formatMoney } from "./hr-ui";

export function EmployeesPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Employee>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    position: "",
    isActive: ""
  });
  const canCreate = auth.hasPermission("employees.create");
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "12" });

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
      const response = await auth.api.request<PaginatedResponse<Employee>>(`/employees?${query}`);
      setEmployees(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Не удалось загрузить сотрудников", description: error instanceof Error ? error.message : undefined, variant: "error" });
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
    <PermissionGate permission="employees.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Сотрудники</h2>
            <p className="text-sm text-muted-foreground">Карточки сотрудников, ставки, графики и история начислений.</p>
          </div>
          {canCreate ? (
            <Button asChild>
              <Link href="/employees/new">
                <Plus className="h-4 w-4" />
                Новый сотрудник
              </Link>
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Справочник</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Поиск по имени, табельному номеру, email" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <Input placeholder="Отдел" value={filters.department} onChange={(event) => updateFilter("department", event.target.value)} />
              <Input placeholder="Должность" value={filters.position} onChange={(event) => updateFilter("position", event.target.value)} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.isActive} onChange={(event) => updateFilter("isActive", event.target.value)}>
                <option value="">Все</option>
                <option value="true">Активные</option>
                <option value="false">Неактивные</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 font-medium">Отдел</th>
                    <th className="px-4 py-3 font-medium">Ставки</th>
                    <th className="px-4 py-3 font-medium">Учет</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <LoadingRow colSpan={5} label="Загрузка сотрудников" />
                  ) : employees.length === 0 ? (
                    <EmptyRow colSpan={5} label="Сотрудники не найдены" />
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-4 py-3">
                          <Link className="font-medium text-primary hover:underline" href={`/employees/${employee.id}`}>
                            {employee.lastName} {employee.firstName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {employee.employeeNumber} / {employee.user?.email ?? employee.email ?? "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{employee.department ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{employee.position ?? "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>Оклад: {formatMoney(employee.baseSalary)}</div>
                          <div>Час: {formatMoney(employee.hourlyRate)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{employee._count?.timeEntries ?? 0} часов</Badge>
                            <Badge variant="outline">{employee._count?.shifts ?? 0} смен</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={employee.isActive ? "ACTIVE" : "CLOSED"} />
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
