"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { Task, TaskPriority, TaskRelatedType, TasksResponse, TaskStatus } from "@/components/tasks/task-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function RelatedTasksCard({
  relatedType,
  relatedId,
  title = "Tasks"
}: {
  relatedType: TaskRelatedType;
  relatedId: string;
  title?: string;
}) {
  const auth = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    priority: "MEDIUM" as TaskPriority,
    dueAt: ""
  });
  const canCreate = auth.hasPermission("tasks.create");
  const canUpdate = auth.hasPermission("tasks.update");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        relatedType,
        relatedId,
        limit: "10"
      });
      const response = await auth.api.request<TasksResponse>(`/tasks?${params.toString()}`);
      setTasks(response.data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [auth.api, relatedId, relatedType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          priority: form.priority,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
          assigneeId: auth.user?.id,
          relatedType,
          relatedId
        })
      });
      setForm({ title: "", priority: "MEDIUM", dueAt: "" });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canCreate ? (
          <form className="grid gap-2 sm:grid-cols-[1fr_140px_150px_auto]" onSubmit={createTask}>
            <Input required placeholder="Task title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <Input type="date" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
            <Button disabled={saving} type="submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks
          </div>
        ) : tasks.length ? (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[task.assignedTo?.name, task.dueAt ? new Date(task.dueAt).toLocaleDateString() : undefined].filter(Boolean).join(" / ")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={task.priority === "HIGH" || task.priority === "URGENT" ? "warning" : "secondary"}>{task.priority}</Badge>
                  {canUpdate ? (
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-xs"
                      value={task.status}
                      onChange={(event) => void updateStatus(task.id, event.target.value as TaskStatus)}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant={task.status === "DONE" ? "success" : "secondary"}>{task.status}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No related tasks</div>
        )}
      </CardContent>
    </Card>
  );
}
