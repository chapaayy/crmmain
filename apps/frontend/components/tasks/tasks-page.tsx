"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import type { Task, TaskPriority, TaskRelatedType, TasksResponse, TaskStatus } from "@/components/tasks/task-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const statuses: Array<TaskStatus | ""> = ["", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
const priorities: Array<TaskPriority | ""> = ["", "LOW", "MEDIUM", "HIGH", "URGENT"];
const relatedTypes: Array<TaskRelatedType | ""> = ["", "CUSTOMER", "LEAD", "ORDER", "PRODUCT"];

const emptyTaskForm = {
  title: "",
  description: "",
  status: "TODO" as TaskStatus,
  priority: "MEDIUM" as TaskPriority,
  dueAt: "",
  assigneeId: "",
  relatedType: "" as TaskRelatedType | "",
  relatedId: ""
};

type TaskFormState = typeof emptyTaskForm;

export function TasksPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<TasksResponse["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskFormState>({ ...emptyTaskForm, assigneeId: auth.user?.id ?? "" });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    mine: "true"
  });
  const canCreate = auth.hasPermission("tasks.create");
  const canUpdate = auth.hasPermission("tasks.update");
  const canDelete = auth.hasPermission("tasks.delete");
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20"
    });

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
      const response = await auth.api.request<TasksResponse>(`/tasks?${query}`);
      setTasks(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load tasks", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

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
      await auth.api.request("/tasks", {
        method: "POST",
        body: JSON.stringify(taskPayload(form))
      });
      setForm({ ...emptyTaskForm, assigneeId: auth.user?.id ?? "" });
      toast({ title: "Task created", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Task failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    try {
      await auth.api.request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (error) {
      toast({ title: "Status failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function deleteTask(taskId: string) {
    try {
      await auth.api.request(`/tasks/${taskId}`, { method: "DELETE" });
      toast({ title: "Task deleted", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="tasks.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Tasks</h2>
            <p className="text-sm text-muted-foreground">My work queue, assignments, and follow-ups.</p>
          </div>
        </div>

        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle>New task</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskForm form={form} saving={saving} onChange={setForm} onSubmit={createTask} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Task list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search tasks" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <Select value={filters.status} onChange={(value) => updateFilter("status", value)}>
                {statuses.map((status) => (
                  <option key={status || "all"} value={status}>
                    {status || "All statuses"}
                  </option>
                ))}
              </Select>
              <Select value={filters.priority} onChange={(value) => updateFilter("priority", value)}>
                {priorities.map((priority) => (
                  <option key={priority || "all"} value={priority}>
                    {priority || "All priorities"}
                  </option>
                ))}
              </Select>
              <Select value={filters.mine} onChange={(value) => updateFilter("mine", value)}>
                <option value="true">My tasks</option>
                <option value="">All tasks</option>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading tasks
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No tasks found
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-xs text-muted-foreground">{relatedLabel(task)}</div>
                        </td>
                        <td className="px-4 py-3">{task.assignedTo?.name ?? "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "warning" : "secondary"}>{task.priority}</Badge>
                        </td>
                        <td className="px-4 py-3">{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {canUpdate ? (
                            <Select value={task.status} onChange={(value) => void updateStatus(task.id, value as TaskStatus)}>
                              {statuses.filter(Boolean).map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge variant={task.status === "DONE" ? "success" : task.status === "CANCELLED" ? "warning" : "secondary"}>{task.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canDelete ? (
                            <Button size="sm" type="button" variant="outline" onClick={() => void deleteTask(task.id)}>
                              Delete
                            </Button>
                          ) : null}
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

function TaskForm({
  form,
  saving,
  onChange,
  onSubmit
}: {
  form: TaskFormState;
  saving: boolean;
  onChange: (form: TaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<TaskFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="grid gap-3 lg:grid-cols-4" onSubmit={onSubmit}>
      <Field required label="Title" value={form.title} onChange={(title) => update({ title })} />
      <SelectField label="Priority" value={form.priority} onChange={(priority) => update({ priority: priority as TaskPriority })}>
        {priorities.filter(Boolean).map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </SelectField>
      <SelectField label="Status" value={form.status} onChange={(status) => update({ status: status as TaskStatus })}>
        {statuses.filter(Boolean).map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </SelectField>
      <Field label="Due at" type="date" value={form.dueAt} onChange={(dueAt) => update({ dueAt })} />
      <Field label="Assignee ID" value={form.assigneeId} onChange={(assigneeId) => update({ assigneeId })} />
      <SelectField label="Related type" value={form.relatedType} onChange={(relatedType) => update({ relatedType: relatedType as TaskRelatedType | "" })}>
        {relatedTypes.map((type) => (
          <option key={type || "none"} value={type}>
            {type || "No relation"}
          </option>
        ))}
      </SelectField>
      <Field label="Related ID" value={form.relatedId} onChange={(relatedId) => update({ relatedId })} />
      <Field label="Description" value={form.description} onChange={(description) => update({ description })} />
      <div className="flex items-end">
        <Button className="w-full" disabled={saving} type="submit">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create task
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  type = "text",
  required,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  children,
  onChange
}: {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={onChange}>
        {children}
      </Select>
    </div>
  );
}

function Select({
  id,
  value,
  children,
  onChange
}: {
  id?: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <select id={id} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  );
}

function taskPayload(form: TaskFormState) {
  return cleanPayload({
    title: form.title,
    description: form.description,
    status: form.status,
    priority: form.priority,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
    assigneeId: form.assigneeId,
    relatedType: form.relatedType,
    relatedId: form.relatedId
  });
}

function relatedLabel(task: Task) {
  if (task.customer) {
    return `Customer: ${task.customer.companyName || task.customer.name}`;
  }

  if (task.lead) {
    return `Lead: ${task.lead.title || task.lead.name || task.relatedId}`;
  }

  if (task.order) {
    return `Order: ${task.order.number}`;
  }

  if (task.product) {
    return `Product: ${task.product.sku} ${task.product.name}`;
  }

  return task.relatedType && task.relatedId ? `${task.relatedType}: ${task.relatedId}` : "No relation";
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
