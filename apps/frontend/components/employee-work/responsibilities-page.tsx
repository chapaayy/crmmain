"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyRow, LoadingRow, StatusBadge } from "@/components/hr/hr-ui";
import type { Employee, PaginatedResponse, Responsibility, ResponsibilityAssignmentRole, ResponsibilityStatus, UserOption } from "./employee-work-types";
import { assignmentRoles, cleanPayload, Field, formatDateTime, formatEmployee, formatUser, responsibilityStatuses, SelectEmployee, SelectField, SelectUser, shortText, TextAreaField } from "./employee-work-ui";

interface ResponsibilityResponse {
  responsibility: Responsibility;
}

const emptyResponsibilityForm = {
  title: "",
  description: "",
  category: "",
  status: "ACTIVE" as ResponsibilityStatus,
  ownerUserId: "",
  ownerEmployeeId: ""
};

export function ResponsibilitiesPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Responsibility>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", category: "" });
  const [form, setForm] = useState(emptyResponsibilityForm);
  const canCreate = auth.hasPermission("responsibilities.create");
  const canDelete = auth.hasPermission("responsibilities.delete");
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
      const [responsibilitiesResponse, employeesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<Responsibility>>(`/responsibilities?${query}`),
        canCreate && auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null)
      ]);
      setResponsibilities(responsibilitiesResponse.data);
      setMeta(responsibilitiesResponse.meta);
      setEmployees(employeesResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить ответственности", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, canCreate, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function createResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/responsibilities", {
        method: "POST",
        body: JSON.stringify(cleanPayload(form))
      });
      toast({ title: "Ответственность создана", variant: "success" });
      setForm(emptyResponsibilityForm);
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать ответственность", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteResponsibility(id: string) {
    if (!window.confirm("Удалить ответственность?")) {
      return;
    }

    try {
      await auth.api.request(`/responsibilities/${id}`, { method: "DELETE" });
      toast({ title: "Ответственность удалена", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось удалить ответственность", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="responsibilities.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Ответственности</h2>
            <p className="text-sm text-muted-foreground">Постоянные зоны работы сотрудников, инструкции, чеклисты и связанные доступы.</p>
          </div>
          {canCreate ? (
            <Button asChild variant="outline">
              <Link href="/responsibilities/new">
                <Plus className="h-4 w-4" />
                Новая ответственность
              </Link>
            </Button>
          ) : null}
        </div>

        {canCreate ? (
          <Card>
            <CardHeader><CardTitle>Быстро создать</CardTitle></CardHeader>
            <CardContent>
              <ResponsibilityForm employees={employees} form={form} saving={saving} onChange={setForm} onSubmit={createResponsibility} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle>Список</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Поиск по названию, описанию или сотруднику" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">Все статусы</option>
                {responsibilityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Input placeholder="Категория" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ответственность</th>
                    <th className="px-4 py-3 font-medium">Владелец</th>
                    <th className="px-4 py-3 font-medium">Состав</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={5} label="Загрузка ответственностей" /> : responsibilities.length === 0 ? <EmptyRow colSpan={5} label="Ответственностей пока нет" /> : responsibilities.map((responsibility) => (
                    <tr key={responsibility.id}>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-primary hover:underline" href={`/responsibilities/${responsibility.id}`}>{responsibility.title}</Link>
                        <div className="text-xs text-muted-foreground">{responsibility.category ?? "Без категории"} / {shortText(responsibility.description)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatEmployee(responsibility.ownerEmployee)}</div>
                        <div className="text-xs text-muted-foreground">{formatUser(responsibility.ownerUser)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{responsibility._count?.assignments ?? responsibility.assignments?.length ?? 0} участников</Badge>
                          <Badge variant="outline">{responsibility._count?.tasks ?? responsibility.tasks?.length ?? 0} задач</Badge>
                          <Badge variant="outline">{responsibility._count?.secrets ?? responsibility.secrets?.length ?? 0} доступов</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={responsibility.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/responsibilities/${responsibility.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canDelete ? <Button size="sm" type="button" variant="outline" onClick={() => void deleteResponsibility(responsibility.id)}><Trash2 className="h-4 w-4" /></Button> : null}
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

export function ResponsibilityDetailPage({ responsibilityId }: { responsibilityId?: string }) {
  const isNew = !responsibilityId;
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [responsibility, setResponsibility] = useState<Responsibility | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyResponsibilityForm);
  const [assignmentForm, setAssignmentForm] = useState({ employeeId: "", userId: "", role: "PARTICIPANT" as ResponsibilityAssignmentRole });
  const [instructionForm, setInstructionForm] = useState({ title: "", content: "", format: "MARKDOWN" });
  const [checklistForm, setChecklistForm] = useState({ title: "", description: "", sortOrder: "", isRequired: "false" });
  const canEdit = isNew ? auth.hasPermission("responsibilities.create") : auth.hasPermission("responsibilities.update");
  const canAssign = auth.hasPermission("responsibilities.assign");
  const canManageInstructions = auth.hasPermission("instructions.manage");
  const canReadSecrets = auth.hasPermission("secrets.read_metadata");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [responsibilityResponse, employeesResponse, usersResponse] = await Promise.all([
        responsibilityId ? auth.api.request<ResponsibilityResponse>(`/responsibilities/${responsibilityId}`) : Promise.resolve(null),
        auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null),
        auth.hasPermission("users.read") ? auth.api.request<PaginatedResponse<UserOption>>("/users?limit=100") : Promise.resolve(null)
      ]);
      setEmployees(employeesResponse?.data ?? []);
      setUsers(usersResponse?.data ?? []);

      if (responsibilityResponse) {
        const next = responsibilityResponse.responsibility;
        setResponsibility(next);
        setForm({
          title: next.title,
          description: next.description ?? "",
          category: next.category ?? "",
          status: next.status,
          ownerUserId: next.ownerUserId ?? "",
          ownerEmployeeId: next.ownerEmployeeId ?? ""
        });
      }
    } catch (error) {
      toast({ title: "Не удалось загрузить ответственность", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, responsibilityId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function saveResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<ResponsibilityResponse>(isNew ? "/responsibilities" : `/responsibilities/${responsibilityId}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(cleanPayload(form))
      });
      toast({ title: isNew ? "Ответственность создана" : "Ответственность сохранена", variant: "success" });
      setResponsibility(response.responsibility);

      if (isNew) {
        router.replace(`/responsibilities/${response.responsibility.id}`);
      }
    } catch (error) {
      toast({ title: "Не удалось сохранить ответственность", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!responsibilityId) {
      return;
    }

    try {
      await auth.api.request(`/responsibilities/${responsibilityId}/assign`, {
        method: "POST",
        body: JSON.stringify(cleanPayload(assignmentForm))
      });
      toast({ title: "Участник добавлен", variant: "success" });
      setAssignmentForm({ employeeId: "", userId: "", role: "PARTICIPANT" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось назначить участника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function createInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!responsibilityId) {
      return;
    }

    try {
      await auth.api.request(`/responsibilities/${responsibilityId}/instructions`, {
        method: "POST",
        body: JSON.stringify(cleanPayload(instructionForm))
      });
      toast({ title: "Инструкция сохранена", variant: "success" });
      setInstructionForm({ title: "", content: "", format: "MARKDOWN" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось сохранить инструкцию", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function createChecklistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!responsibilityId) {
      return;
    }

    try {
      await auth.api.request(`/responsibilities/${responsibilityId}/checklist`, {
        method: "POST",
        body: JSON.stringify(cleanPayload({ ...checklistForm, sortOrder: checklistForm.sortOrder ? Number(checklistForm.sortOrder) : undefined, isRequired: checklistForm.isRequired === "true" }))
      });
      toast({ title: "Пункт добавлен", variant: "success" });
      setChecklistForm({ title: "", description: "", sortOrder: "", isRequired: "false" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось добавить пункт", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission={isNew ? "responsibilities.create" : "responsibilities.read"}>
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <Button type="button" variant="ghost" onClick={() => router.push("/responsibilities")}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{isNew ? "Новая ответственность" : responsibility?.title ?? "Ответственность"}</h2>
        </div>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Загрузка</CardContent></Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <section className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Основные данные</CardTitle></CardHeader>
                <CardContent>
                  <ResponsibilityForm disabled={!canEdit} employees={employees} form={form} saving={saving} onChange={setForm} onSubmit={saveResponsibility} />
                </CardContent>
              </Card>

              {!isNew ? (
                <Card>
                  <CardHeader><CardTitle>Инструкции</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {responsibility?.instructions?.length ? responsibility.instructions.map((instruction) => (
                      <div key={instruction.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{instruction.title}</div>
                            <div className="text-xs text-muted-foreground">v{instruction.version} / {instruction.format} / {formatDateTime(instruction.updatedAt)}</div>
                          </div>
                          <StatusBadge status={instruction.isActive ? "ACTIVE" : "CLOSED"} />
                        </div>
                        <div className="mt-3 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{instruction.content}</div>
                      </div>
                    )) : <div className="py-4 text-center text-sm text-muted-foreground">Инструкций пока нет</div>}
                    {canManageInstructions ? (
                      <form className="grid gap-3 border-t pt-4" onSubmit={(event) => void createInstruction(event)}>
                        <Field label="Название инструкции" value={instructionForm.title} onChange={(title) => setInstructionForm((current) => ({ ...current, title }))} />
                        <TextAreaField label="Markdown инструкция" rows={8} value={instructionForm.content} onChange={(content) => setInstructionForm((current) => ({ ...current, content }))} />
                        <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap">{instructionForm.content || "Preview появится здесь"}</div>
                        <Button type="submit"><Save className="h-4 w-4" /> Сохранить инструкцию</Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {!isNew ? (
                <Card>
                  <CardHeader><CardTitle>Связанные задачи</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted text-left text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Задача</th>
                            <th className="px-4 py-3 font-medium">Сотрудник</th>
                            <th className="px-4 py-3 font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {!responsibility?.tasks?.length ? <EmptyRow colSpan={3} label="Связанных задач нет" /> : responsibility.tasks.map((task) => (
                            <tr key={task.id}>
                              <td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={`/employee-tasks/${task.id}`}>{task.title}</Link></td>
                              <td className="px-4 py-3">{formatEmployee(task.assigneeEmployee)}</td>
                              <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button asChild className="mt-3" variant="outline"><Link href={`/employee-tasks/new?responsibilityId=${responsibilityId}`}><Plus className="h-4 w-4" /> Добавить задачу</Link></Button>
                  </CardContent>
                </Card>
              ) : null}
            </section>

            {!isNew ? (
              <aside className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Участники</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {responsibility?.assignments?.length ? responsibility.assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{assignment.employee ? formatEmployee(assignment.employee) : formatUser(assignment.user)}</span>
                          <Badge variant="outline">{assignment.role}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatUser(assignment.user)}</div>
                      </div>
                    )) : <div className="py-4 text-center text-sm text-muted-foreground">Участников пока нет</div>}
                    {canAssign ? (
                      <form className="space-y-3 border-t pt-3" onSubmit={(event) => void assign(event)}>
                        <SelectEmployee employees={employees} value={assignmentForm.employeeId} onChange={(employeeId) => setAssignmentForm((current) => ({ ...current, employeeId }))} />
                        {users.length ? <SelectUser users={users} value={assignmentForm.userId} onChange={(userId) => setAssignmentForm((current) => ({ ...current, userId }))} /> : null}
                        <SelectField label="Роль" value={assignmentForm.role} onChange={(role) => setAssignmentForm((current) => ({ ...current, role: role as ResponsibilityAssignmentRole }))}>
                          {assignmentRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                        </SelectField>
                        <Button className="w-full" type="submit" variant="outline">Назначить</Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Чеклист</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {responsibility?.checklistItems?.length ? responsibility.checklistItems.map((item) => (
                      <div key={item.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{item.sortOrder}. {item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.description ?? ""}</div>
                      </div>
                    )) : <div className="py-4 text-center text-sm text-muted-foreground">Чеклист пуст</div>}
                    {canEdit ? (
                      <form className="space-y-2 border-t pt-3" onSubmit={(event) => void createChecklistItem(event)}>
                        <Field label="Пункт" value={checklistForm.title} onChange={(title) => setChecklistForm((current) => ({ ...current, title }))} />
                        <Field label="Описание" value={checklistForm.description} onChange={(description) => setChecklistForm((current) => ({ ...current, description }))} />
                        <Field label="Порядок" type="number" value={checklistForm.sortOrder} onChange={(sortOrder) => setChecklistForm((current) => ({ ...current, sortOrder }))} />
                        <Button className="w-full" type="submit" variant="outline">Добавить пункт</Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>

                {canReadSecrets ? (
                  <Card>
                    <CardHeader><CardTitle>Доступы</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {responsibility?.secrets?.length ? responsibility.secrets.map((secret) => (
                        <div key={secret.id} className="rounded-md border p-3 text-sm">
                          <Link className="font-medium text-primary hover:underline" href={`/secrets/${secret.id}`}>{secret.title}</Link>
                          <div className="text-xs text-muted-foreground">{secret.type} / {secret.secretMasked ?? "без секрета"}</div>
                        </div>
                      )) : <div className="py-4 text-center text-sm text-muted-foreground">Доступов нет</div>}
                      <Button asChild className="w-full" variant="outline"><Link href={`/secrets/new?responsibilityId=${responsibilityId}`}>Добавить доступ</Link></Button>
                    </CardContent>
                  </Card>
                ) : null}
              </aside>
            ) : null}
          </div>
        )}
      </main>
    </PermissionGate>
  );
}

function ResponsibilityForm({
  form,
  saving,
  disabled,
  employees,
  onChange,
  onSubmit
}: {
  form: typeof emptyResponsibilityForm;
  saving: boolean;
  disabled?: boolean;
  employees: Employee[];
  onChange: (form: typeof emptyResponsibilityForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<typeof emptyResponsibilityForm>) => onChange({ ...form, ...patch });

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Field required label="Название" value={form.title} onChange={(title) => update({ title })} />
      <Field label="Категория" value={form.category} onChange={(category) => update({ category })} />
      <SelectField label="Статус" value={form.status} onChange={(status) => update({ status: status as ResponsibilityStatus })}>
        {responsibilityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </SelectField>
      <SelectEmployee employees={employees} value={form.ownerEmployeeId} onChange={(ownerEmployeeId) => update({ ownerEmployeeId })} />
      <div className="md:col-span-2">
        <TextAreaField label="Описание" value={form.description} onChange={(description) => update({ description })} />
      </div>
      {!disabled ? (
        <div className="md:col-span-2">
          <Button disabled={saving} type="submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      ) : null}
    </form>
  );
}
