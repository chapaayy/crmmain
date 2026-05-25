"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EmployeeTask, Responsibility, SecretVaultItem } from "@/components/employee-work/employee-work-types";
import type { Employee, PaginatedResponse, UserOption } from "./hr-types";
import { StatusBadge, compactPayload, formatDate, formatMoney, fromDateTimeLocal, toDateTimeLocal, toInputDate } from "./hr-ui";

interface EmployeeResponse {
  employee: Employee;
}

type UsersResponse = PaginatedResponse<UserOption>;

const employmentTypes = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN", "OTHER"];
const scheduleTypes = ["FIVE_TWO", "TWO_TWO", "SHIFT", "FLEXIBLE", "CUSTOM"];

export function EmployeeEditor({ employeeId }: { employeeId?: string }) {
  const isNew = !employeeId;
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTask[]>([]);
  const [employeeSecrets, setEmployeeSecrets] = useState<SecretVaultItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    employeeNumber: "",
    firstName: "",
    lastName: "",
    middleName: "",
    phone: "",
    email: "",
    position: "",
    department: "",
    employmentType: "FULL_TIME",
    hireDate: "",
    fireDate: "",
    baseSalary: "",
    hourlyRate: "",
    shiftRate: "",
    commissionRate: "",
    isActive: "true"
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    type: "FIVE_TWO",
    workdayHours: "8",
    startsAt: "",
    endsAt: "",
    timezone: "Europe/Berlin"
  });
  const canCreate = auth.hasPermission("employees.create");
  const canUpdate = auth.hasPermission("employees.update");
  const canDelete = auth.hasPermission("employees.delete");
  const canEdit = isNew ? canCreate : canUpdate;
  const canReadResponsibilities = auth.hasPermission("responsibilities.read");
  const canReadEmployeeTasks = auth.hasPermission("employee_tasks.read");
  const canReadSecrets = auth.hasPermission("secrets.read_metadata");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [employeeResponse, usersResponse, responsibilitiesResponse, tasksResponse, secretsResponse] = await Promise.all([
        employeeId ? auth.api.request<EmployeeResponse>(`/employees/${employeeId}`) : Promise.resolve(null),
        auth.hasPermission("users.read") ? auth.api.request<UsersResponse>("/users?limit=100") : Promise.resolve(null),
        employeeId && canReadResponsibilities ? auth.api.request<{ data: Responsibility[] }>(`/employees/${employeeId}/responsibilities`) : Promise.resolve(null),
        employeeId && canReadEmployeeTasks ? auth.api.request<PaginatedResponse<EmployeeTask>>(`/employee-tasks?assigneeEmployeeId=${employeeId}&limit=5`) : Promise.resolve(null),
        employeeId && canReadSecrets ? auth.api.request<PaginatedResponse<SecretVaultItem>>(`/secrets?ownerEmployeeId=${employeeId}&limit=5`) : Promise.resolve(null)
      ]);

      if (employeeResponse) {
        const next = employeeResponse.employee;
        setEmployee(next);
        setForm({
          userId: next.userId,
          employeeNumber: next.employeeNumber,
          firstName: next.firstName,
          lastName: next.lastName,
          middleName: next.middleName ?? "",
          phone: next.phone ?? "",
          email: next.email ?? "",
          position: next.position ?? "",
          department: next.department ?? "",
          employmentType: next.employmentType,
          hireDate: toInputDate(next.hireDate),
          fireDate: toInputDate(next.fireDate),
          baseSalary: String(next.baseSalary ?? ""),
          hourlyRate: String(next.hourlyRate ?? ""),
          shiftRate: String(next.shiftRate ?? ""),
          commissionRate: String(next.commissionRate ?? ""),
          isActive: String(next.isActive)
        });
      }

      setUsers(usersResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);
      setEmployeeTasks(tasksResponse?.data ?? []);
      setEmployeeSecrets(secretsResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, canReadEmployeeTasks, canReadResponsibilities, canReadSecrets, employeeId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = compactPayload({
        ...form,
        isActive: form.isActive === "true",
        baseSalary: form.baseSalary ? Number(form.baseSalary) : undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        shiftRate: form.shiftRate ? Number(form.shiftRate) : undefined,
        commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined
      });

      if (isNew) {
        const response = await auth.api.request<EmployeeResponse>("/employees", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast({ title: "Сотрудник создан", variant: "success" });
        router.replace(`/employees/${response.employee.id}`);
      } else if (employeeId) {
        const response = await auth.api.request<EmployeeResponse>(`/employees/${employeeId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setEmployee(response.employee);
        toast({ title: "Сотрудник сохранен", variant: "success" });
      }
    } catch (error) {
      toast({ title: "Не удалось сохранить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!employeeId || !window.confirm("Удалить сотрудника?")) {
      return;
    }

    try {
      await auth.api.request(`/employees/${employeeId}`, { method: "DELETE" });
      toast({ title: "Сотрудник удален", variant: "success" });
      router.replace("/employees");
    } catch (error) {
      toast({ title: "Не удалось удалить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!employeeId) {
      return;
    }

    try {
      await auth.api.request(`/employees/${employeeId}/schedules`, {
        method: "POST",
        body: JSON.stringify(
          compactPayload({
            ...scheduleForm,
            workdayHours: Number(scheduleForm.workdayHours),
            startsAt: fromDateTimeLocal(scheduleForm.startsAt),
            endsAt: fromDateTimeLocal(scheduleForm.endsAt)
          })
        )
      });
      toast({ title: "График добавлен", variant: "success" });
      setScheduleForm({ name: "", type: "FIVE_TWO", workdayHours: "8", startsAt: "", endsAt: "", timezone: "Europe/Berlin" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось добавить график", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission={isNew ? "employees.create" : "employees.read"}>
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button type="button" variant="ghost" onClick={() => router.push("/employees")}>
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">{isNew ? "Новый сотрудник" : "Карточка сотрудника"}</h2>
          </div>
          {!isNew && canDelete ? (
            <Button type="button" variant="outline" onClick={() => void deleteEmployee()}>
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          ) : null}
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Загрузка
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Основные данные</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
                  {users.length ? (
                    <Field label="Пользователь">
                      <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.userId} onChange={(event) => updateField("userId", event.target.value)}>
                        <option value="">Выберите User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} / {user.email}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="User ID">
                      <Input disabled={!canEdit} value={form.userId} onChange={(event) => updateField("userId", event.target.value)} />
                    </Field>
                  )}
                  <Field label="Табельный номер">
                    <Input disabled={!canEdit} value={form.employeeNumber} onChange={(event) => updateField("employeeNumber", event.target.value)} />
                  </Field>
                  <Field label="Имя">
                    <Input disabled={!canEdit} value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                  </Field>
                  <Field label="Фамилия">
                    <Input disabled={!canEdit} value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                  </Field>
                  <Field label="Отчество">
                    <Input disabled={!canEdit} value={form.middleName} onChange={(event) => updateField("middleName", event.target.value)} />
                  </Field>
                  <Field label="Телефон">
                    <Input disabled={!canEdit} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input disabled={!canEdit} value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                  </Field>
                  <Field label="Должность">
                    <Input disabled={!canEdit} value={form.position} onChange={(event) => updateField("position", event.target.value)} />
                  </Field>
                  <Field label="Отдел">
                    <Input disabled={!canEdit} value={form.department} onChange={(event) => updateField("department", event.target.value)} />
                  </Field>
                  <Field label="Тип занятости">
                    <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.employmentType} onChange={(event) => updateField("employmentType", event.target.value)}>
                      {employmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Дата приема">
                    <Input disabled={!canEdit} type="date" value={form.hireDate} onChange={(event) => updateField("hireDate", event.target.value)} />
                  </Field>
                  <Field label="Дата увольнения">
                    <Input disabled={!canEdit} type="date" value={form.fireDate} onChange={(event) => updateField("fireDate", event.target.value)} />
                  </Field>
                  <Field label="Оклад">
                    <Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.baseSalary} onChange={(event) => updateField("baseSalary", event.target.value)} />
                  </Field>
                  <Field label="Почасовая ставка">
                    <Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.hourlyRate} onChange={(event) => updateField("hourlyRate", event.target.value)} />
                  </Field>
                  <Field label="Ставка за смену">
                    <Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.shiftRate} onChange={(event) => updateField("shiftRate", event.target.value)} />
                  </Field>
                  <Field label="% комиссии">
                    <Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.commissionRate} onChange={(event) => updateField("commissionRate", event.target.value)} />
                  </Field>
                  <Field label="Активность">
                    <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.isActive} onChange={(event) => updateField("isActive", event.target.value)}>
                      <option value="true">Активен</option>
                      <option value="false">Неактивен</option>
                    </select>
                  </Field>
                  {canEdit ? (
                    <div className="md:col-span-2">
                      <Button disabled={saving} type="submit">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Сохранить
                      </Button>
                    </div>
                  ) : null}
                </form>
              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ставки</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Оклад</span><span>{formatMoney(employee?.baseSalary)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Час</span><span>{formatMoney(employee?.hourlyRate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Смена</span><span>{formatMoney(employee?.shiftRate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Комиссия</span><span>{employee?.commissionRate ?? "-"}%</span></div>
                </CardContent>
              </Card>

              {!isNew ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Графики</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {employee?.schedules?.length ? (
                      employee.schedules.map((schedule) => (
                        <div key={schedule.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{schedule.name}</span>
                            <StatusBadge status={schedule.isActive ? "ACTIVE" : "CLOSED"} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{schedule.type} / {schedule.workdayHours} ч / {schedule.timezone}</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">Графики не добавлены</div>
                    )}
                    {canUpdate ? (
                      <form className="space-y-2 border-t pt-3" onSubmit={(event) => void createSchedule(event)}>
                        <Input placeholder="Название графика" value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} />
                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scheduleForm.type} onChange={(event) => setScheduleForm((current) => ({ ...current, type: event.target.value }))}>
                          {scheduleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <Input min="0" step="0.25" type="number" value={scheduleForm.workdayHours} onChange={(event) => setScheduleForm((current) => ({ ...current, workdayHours: event.target.value }))} />
                        <Input type="datetime-local" value={toDateTimeLocal(scheduleForm.startsAt)} onChange={(event) => setScheduleForm((current) => ({ ...current, startsAt: event.target.value }))} />
                        <Input type="datetime-local" value={toDateTimeLocal(scheduleForm.endsAt)} onChange={(event) => setScheduleForm((current) => ({ ...current, endsAt: event.target.value }))} />
                        <Button className="w-full" type="submit" variant="outline">Добавить график</Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {!isNew && canReadResponsibilities ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Ответственности</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {responsibilities.length ? (
                      responsibilities.map((responsibility) => (
                        <div key={responsibility.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <Link className="font-medium text-primary hover:underline" href={`/responsibilities/${responsibility.id}`}>{responsibility.title}</Link>
                            <StatusBadge status={responsibility.status} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{responsibility.category ?? "Без категории"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">Ответственностей пока нет</div>
                    )}
                    <Button asChild className="w-full" variant="outline"><Link href="/responsibilities/new">Добавить ответственность</Link></Button>
                  </CardContent>
                </Card>
              ) : null}

              {!isNew && canReadEmployeeTasks ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Задачи</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {employeeTasks.length ? (
                      employeeTasks.map((task) => (
                        <div key={task.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <Link className="font-medium text-primary hover:underline" href={`/employee-tasks/${task.id}`}>{task.title}</Link>
                            <StatusBadge status={task.status} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{task.priority} / {task.dueAt ? formatDate(task.dueAt) : "-"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">Задач пока нет</div>
                    )}
                    <Button asChild className="w-full" variant="outline"><Link href="/employee-tasks/new">Добавить задачу</Link></Button>
                  </CardContent>
                </Card>
              ) : null}

              {!isNew && canReadSecrets ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Доступы</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {employeeSecrets.length ? (
                      employeeSecrets.map((secret) => (
                        <div key={secret.id} className="rounded-md border p-3 text-sm">
                          <Link className="font-medium text-primary hover:underline" href={`/secrets/${secret.id}`}>{secret.title}</Link>
                          <div className="mt-1 text-xs text-muted-foreground">{secret.type} / {secret.secretMasked ?? "без секрета"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">Доступов пока нет</div>
                    )}
                    <Button asChild className="w-full" variant="outline"><Link href="/secrets/new">Добавить доступ</Link></Button>
                  </CardContent>
                </Card>
              ) : null}

              {!isNew ? (
                <Card>
                  <CardHeader>
                    <CardTitle>История начислений</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {employee?.payrollLines?.length ? (
                      employee.payrollLines.map((line) => (
                        <div key={line.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{line.payrollRun?.period?.name}</span>
                            <StatusBadge status={line.payrollRun?.status ?? "DRAFT"} />
                          </div>
                          <div className="mt-1 text-muted-foreground">{formatDate(line.payrollRun?.period?.dateFrom)} - {formatDate(line.payrollRun?.period?.dateTo)}</div>
                          <div className="mt-2 font-medium">{formatMoney(line.netAmount)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">Начислений пока нет</div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </aside>
          </div>
        )}
      </main>
    </PermissionGate>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
