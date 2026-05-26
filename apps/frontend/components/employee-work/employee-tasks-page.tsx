"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyRow, LoadingRow, StatusBadge } from "@/components/hr/hr-ui";
import type { Employee, EmployeeTask, PaginatedResponse, Responsibility, TaskPriority, TaskStatus, UserOption } from "./employee-work-types";
import { cleanPayload, Field, formatDateTime, formatEmployee, formatUser, SelectEmployee, SelectField, SelectUser, taskPriorities, taskStatuses, TextAreaField } from "./employee-work-ui";

interface TaskResponse {
  task: EmployeeTask;
}

const emptyTaskForm = {
  title: "",
  description: "",
  status: "TODO" as TaskStatus,
  priority: "MEDIUM" as TaskPriority,
  dueAt: "",
  assigneeUserId: "",
  assigneeEmployeeId: "",
  assigneeDepartment: "",
  responsibilityId: ""
};

type TaskFormState = typeof emptyTaskForm;

export function EmployeeTasksPage({ employeeId, responsibilityId }: { employeeId?: string; responsibilityId?: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<EmployeeTask>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    assigneeEmployeeId: employeeId ?? "",
    responsibilityId: responsibilityId ?? ""
  });
  const [form, setForm] = useState<TaskFormState>({ ...emptyTaskForm, assigneeEmployeeId: employeeId ?? "", responsibilityId: responsibilityId ?? "" });
  const canCreate = auth.hasPermission("employee_tasks.create");
  const canDelete = auth.hasPermission("employee_tasks.delete");
  const canAssign = auth.hasPermission("employee_tasks.assign");
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });

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
      const [tasksResponse, employeesResponse, responsibilitiesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<EmployeeTask>>(`/employee-tasks?${query}`),
        auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null),
        auth.hasPermission("responsibilities.read") ? auth.api.request<PaginatedResponse<Responsibility>>("/responsibilities?limit=100") : Promise.resolve(null)
      ]);
      setTasks(tasksResponse.data);
      setMeta(tasksResponse.meta);
      setEmployees(employeesResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить задачи сотрудников", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/employee-tasks", {
        method: "POST",
        body: JSON.stringify(taskPayload(form))
      });
      toast({ title: "Задача создана", variant: "success" });
      setForm({ ...emptyTaskForm, assigneeEmployeeId: employeeId ?? "", responsibilityId: responsibilityId ?? "" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать задачу", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(taskId: string, path: "complete" | "reopen") {
    try {
      await auth.api.request(`/employee-tasks/${taskId}/${path}`, { method: "POST" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось изменить задачу", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Удалить задачу?")) {
      return;
    }

    try {
      await auth.api.request(`/employee-tasks/${taskId}`, { method: "DELETE" });
      toast({ title: "Задача удалена", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось удалить задачу", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="employee_tasks.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Задачи сотрудников</h2>
            <p className="text-sm text-muted-foreground">Назначения по сотрудникам, отделам и зонам ответственности.</p>
          </div>
          {canCreate ? (
            <Button asChild variant="outline">
              <Link href="/employee-tasks/new">
                <Plus className="h-4 w-4" />
                Новая задача
              </Link>
            </Button>
          ) : null}
        </div>

        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle>Быстро создать</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeTaskForm canAssign={canAssign} employees={employees} responsibilities={responsibilities} form={form} saving={saving} onChange={setForm} onSubmit={createTask} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Список задач</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Поиск по задаче, отделу или ответственности" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">Все статусы</option>
                {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
                <option value="">Все приоритеты</option>
                {taskPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.assigneeEmployeeId} onChange={(event) => updateFilter("assigneeEmployeeId", event.target.value)}>
                <option value="">Все сотрудники</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{formatEmployee(employee)}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Задача</th>
                    <th className="px-4 py-3 font-medium">Назначена</th>
                    <th className="px-4 py-3 font-medium">Ответственность</th>
                    <th className="px-4 py-3 font-medium">Срок</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={6} label="Загрузка задач" /> : tasks.length === 0 ? <EmptyRow colSpan={6} label="Задач пока нет" /> : tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-primary hover:underline" href={`/employee-tasks/${task.id}`}>{task.title}</Link>
                        <div className="text-xs text-muted-foreground">{task.assigneeDepartment ?? task.description ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatEmployee(task.assigneeEmployee)}</div>
                        <div className="text-xs text-muted-foreground">{formatUser(task.assignedTo)}</div>
                      </td>
                      <td className="px-4 py-3">{task.responsibility ? <Link className="text-primary hover:underline" href={`/responsibilities/${task.responsibility.id}`}>{task.responsibility.title}</Link> : "-"}</td>
                      <td className="px-4 py-3">{formatDateTime(task.dueAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {task.status !== "DONE" ? <Button size="sm" type="button" variant="outline" onClick={() => void runAction(task.id, "complete")}><CheckCircle2 className="h-4 w-4" /> Готово</Button> : <Button size="sm" type="button" variant="outline" onClick={() => void runAction(task.id, "reopen")}><RotateCcw className="h-4 w-4" /> Вернуть</Button>}
                          {canDelete ? <Button size="sm" type="button" variant="outline" onClick={() => void deleteTask(task.id)}><Trash2 className="h-4 w-4" /></Button> : null}
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

export function EmployeeTaskDetailPage({ taskId }: { taskId?: string }) {
  const isNew = !taskId;
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState<EmployeeTask | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm);
  const canAssign = auth.hasPermission("employee_tasks.assign");
  const canEdit = isNew ? auth.hasPermission("employee_tasks.create") : auth.hasPermission("employee_tasks.update");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [taskResponse, employeesResponse, usersResponse, responsibilitiesResponse] = await Promise.all([
        taskId ? auth.api.request<TaskResponse>(`/employee-tasks/${taskId}`) : Promise.resolve(null),
        auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null),
        auth.hasPermission("users.read") ? auth.api.request<PaginatedResponse<UserOption>>("/users?limit=100") : Promise.resolve(null),
        auth.hasPermission("responsibilities.read") ? auth.api.request<PaginatedResponse<Responsibility>>("/responsibilities?limit=100") : Promise.resolve(null)
      ]);
      setEmployees(employeesResponse?.data ?? []);
      setUsers(usersResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);

      if (taskResponse) {
        setTask(taskResponse.task);
        setForm({
          title: taskResponse.task.title,
          description: taskResponse.task.description ?? "",
          status: taskResponse.task.status,
          priority: taskResponse.task.priority,
          dueAt: taskResponse.task.dueAt ? taskResponse.task.dueAt.slice(0, 10) : "",
          assigneeUserId: taskResponse.task.assigneeUserId ?? taskResponse.task.assignedToId ?? "",
          assigneeEmployeeId: taskResponse.task.assigneeEmployeeId ?? "",
          assigneeDepartment: taskResponse.task.assigneeDepartment ?? "",
          responsibilityId: taskResponse.task.responsibilityId ?? ""
        });
      }
    } catch (error) {
      toast({ title: "Не удалось загрузить задачу", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, taskId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<TaskResponse>(isNew ? "/employee-tasks" : `/employee-tasks/${taskId}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(taskPayload(form))
      });
      toast({ title: isNew ? "Задача создана" : "Задача сохранена", variant: "success" });
      setTask(response.task);

      if (isNew) {
        router.replace(`/employee-tasks/${response.task.id}`);
      }
    } catch (error) {
      toast({ title: "Не удалось сохранить задачу", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission={isNew ? "employee_tasks.create" : "employee_tasks.read"}>
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <Button type="button" variant="ghost" onClick={() => router.push("/employee-tasks")}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{isNew ? "Новая задача сотрудника" : task?.title ?? "Задача сотрудника"}</h2>
        </div>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Загрузка</CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Данные задачи</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeTaskForm canAssign={canAssign} disabled={!canEdit} employees={employees} users={users} responsibilities={responsibilities} form={form} saving={saving} onChange={setForm} onSubmit={submit} />
            </CardContent>
          </Card>
        )}
      </main>
    </PermissionGate>
  );
}

function EmployeeTaskForm({
  form,
  saving,
  disabled,
  canAssign,
  employees,
  users = [],
  responsibilities,
  onChange,
  onSubmit
}: {
  form: TaskFormState;
  saving: boolean;
  disabled?: boolean;
  canAssign: boolean;
  employees: Employee[];
  users?: UserOption[];
  responsibilities: Responsibility[];
  onChange: (form: TaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<TaskFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="grid gap-3 lg:grid-cols-4" onSubmit={onSubmit}>
      <Field required label="Название" value={form.title} onChange={(title) => update({ title })} />
      <SelectField label="Статус" value={form.status} onChange={(status) => update({ status: status as TaskStatus })}>
        {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </SelectField>
      <SelectField label="Приоритет" value={form.priority} onChange={(priority) => update({ priority: priority as TaskPriority })}>
        {taskPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
      </SelectField>
      <Field label="Срок" type="date" value={form.dueAt} onChange={(dueAt) => update({ dueAt })} />
      {canAssign ? <SelectEmployee employees={employees} value={form.assigneeEmployeeId} onChange={(assigneeEmployeeId) => update({ assigneeEmployeeId })} /> : null}
      {canAssign && users.length ? <SelectUser users={users} value={form.assigneeUserId} onChange={(assigneeUserId) => update({ assigneeUserId })} /> : null}
      <Field label="Отдел" value={form.assigneeDepartment} onChange={(assigneeDepartment) => update({ assigneeDepartment })} />
      <SelectField label="Ответственность" value={form.responsibilityId} onChange={(responsibilityId) => update({ responsibilityId })}>
        <option value="">Не привязана</option>
        {responsibilities.map((responsibility) => <option key={responsibility.id} value={responsibility.id}>{responsibility.title}</option>)}
      </SelectField>
      <div className="lg:col-span-4">
        <TextAreaField label="Описание" value={form.description} onChange={(description) => update({ description })} />
      </div>
      {!disabled ? (
        <div className="lg:col-span-4">
          <Button disabled={saving} type="submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function taskPayload(form: TaskFormState) {
  return cleanPayload({
    ...form,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined
  });
}
