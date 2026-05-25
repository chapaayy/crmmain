"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Clipboard, Eye, EyeOff, KeyRound, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyRow, LoadingRow } from "@/components/hr/hr-ui";
import type { Employee, PaginatedResponse, Responsibility, SecretAccessLog, SecretRevealResponse, SecretVaultItem, SecretVaultItemType, UserOption } from "./employee-work-types";
import { cleanPayload, Field, formatDateTime, formatEmployee, formatUser, secretTypes, SelectEmployee, SelectField, SelectUser, shortText, TextAreaField } from "./employee-work-ui";

interface SecretResponse {
  secret: SecretVaultItem;
}

const emptySecretForm = {
  title: "",
  description: "",
  type: "LOGIN_PASSWORD" as SecretVaultItemType,
  url: "",
  username: "",
  login: "",
  phone: "",
  email: "",
  secret: "",
  notes: "",
  responsibilityId: "",
  ownerUserId: "",
  ownerEmployeeId: ""
};

type SecretFormState = typeof emptySecretForm;

export function SecretsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<SecretVaultItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<SecretVaultItem>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", responsibilityId: "" });
  const [form, setForm] = useState<SecretFormState>(emptySecretForm);
  const canCreate = auth.hasPermission("secrets.create");
  const canDelete = auth.hasPermission("secrets.delete");
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
    setLoading(true);

    try {
      const [secretsResponse, employeesResponse, responsibilitiesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<SecretVaultItem>>(`/secrets?${query}`),
        auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null),
        auth.hasPermission("responsibilities.read") ? auth.api.request<PaginatedResponse<Responsibility>>("/responsibilities?limit=100") : Promise.resolve(null)
      ]);
      setSecrets(secretsResponse.data);
      setMeta(secretsResponse.meta);
      setEmployees(employeesResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить доступы", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function createSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/secrets", {
        method: "POST",
        body: JSON.stringify(cleanPayload(form))
      });
      toast({ title: "Доступ создан", variant: "success" });
      setForm(emptySecretForm);
      await load();
    } catch (error) {
      toast({ title: "Не удалось создать доступ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSecret(id: string) {
    if (!window.confirm("Удалить доступ?")) {
      return;
    }

    try {
      await auth.api.request(`/secrets/${id}`, { method: "DELETE" });
      toast({ title: "Доступ удален", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось удалить доступ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="secrets.read_metadata">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Доступы / Secrets</h2>
            <p className="text-sm text-muted-foreground">Метаданные доступны в списках, секрет раскрывается только отдельным действием с аудитом.</p>
          </div>
          {canCreate ? (
            <Button asChild variant="outline">
              <Link href="/secrets/new">
                <Plus className="h-4 w-4" />
                Новый доступ
              </Link>
            </Button>
          ) : null}
        </div>

        {canCreate ? (
          <Card>
            <CardHeader><CardTitle>Быстро создать</CardTitle></CardHeader>
            <CardContent>
              <SecretForm employees={employees} responsibilities={responsibilities} form={form} saving={saving} onChange={setForm} onSubmit={createSecret} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle>Список доступов</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Поиск по названию, логину, ссылке" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
                <option value="">Все типы</option>
                {secretTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.responsibilityId} onChange={(event) => updateFilter("responsibilityId", event.target.value)}>
                <option value="">Все ответственности</option>
                {responsibilities.map((responsibility) => <option key={responsibility.id} value={responsibility.id}>{responsibility.title}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Доступ</th>
                    <th className="px-4 py-3 font-medium">Логин</th>
                    <th className="px-4 py-3 font-medium">Ответственность</th>
                    <th className="px-4 py-3 font-medium">Секрет</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? <LoadingRow colSpan={5} label="Загрузка доступов" /> : secrets.length === 0 ? <EmptyRow colSpan={5} label="Доступов пока нет" /> : secrets.map((secret) => (
                    <tr key={secret.id}>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-primary hover:underline" href={`/secrets/${secret.id}`}>{secret.title}</Link>
                        <div className="text-xs text-muted-foreground">{secret.type} / {shortText(secret.description)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{secret.login || secret.username || secret.email || "-"}</div>
                        <div className="text-xs text-muted-foreground">{secret.phone ?? secret.url ?? ""}</div>
                      </td>
                      <td className="px-4 py-3">{secret.responsibility ? <Link className="text-primary hover:underline" href={`/responsibilities/${secret.responsibility.id}`}>{secret.responsibility.title}</Link> : "-"}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{secret.secretMasked ?? "нет"}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/secrets/${secret.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canDelete ? <Button size="sm" type="button" variant="outline" onClick={() => void deleteSecret(secret.id)}><Trash2 className="h-4 w-4" /></Button> : null}
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

export function SecretDetailPage({ secretId }: { secretId?: string }) {
  const isNew = !secretId;
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [secret, setSecret] = useState<SecretVaultItem | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [logs, setLogs] = useState<SecretAccessLog[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReason, setRevealReason] = useState("");
  const [revealed, setRevealed] = useState<SecretRevealResponse | null>(null);
  const [form, setForm] = useState<SecretFormState>(emptySecretForm);
  const canEdit = isNew ? auth.hasPermission("secrets.create") : auth.hasPermission("secrets.update");
  const canReveal = auth.hasPermission("secrets.reveal");
  const canReadLogs = auth.hasPermission("secret_access_logs.read");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [secretResponse, employeesResponse, usersResponse, responsibilitiesResponse, logsResponse] = await Promise.all([
        secretId ? auth.api.request<SecretResponse>(`/secrets/${secretId}`) : Promise.resolve(null),
        auth.hasPermission("employees.read") ? auth.api.request<PaginatedResponse<Employee>>("/employees?limit=100&isActive=true") : Promise.resolve(null),
        auth.hasPermission("users.read") ? auth.api.request<PaginatedResponse<UserOption>>("/users?limit=100") : Promise.resolve(null),
        auth.hasPermission("responsibilities.read") ? auth.api.request<PaginatedResponse<Responsibility>>("/responsibilities?limit=100") : Promise.resolve(null),
        secretId && canReadLogs ? auth.api.request<{ data: SecretAccessLog[] }>(`/secrets/${secretId}/access-logs`) : Promise.resolve(null)
      ]);
      setEmployees(employeesResponse?.data ?? []);
      setUsers(usersResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);
      setLogs(logsResponse?.data ?? []);

      if (secretResponse) {
        const next = secretResponse.secret;
        setSecret(next);
        setForm({
          title: next.title,
          description: next.description ?? "",
          type: next.type,
          url: next.url ?? "",
          username: next.username ?? "",
          login: next.login ?? "",
          phone: next.phone ?? "",
          email: next.email ?? "",
          secret: "",
          notes: "",
          responsibilityId: next.responsibilityId ?? "",
          ownerUserId: next.ownerUserId ?? "",
          ownerEmployeeId: next.ownerEmployeeId ?? ""
        });
      }
    } catch (error) {
      toast({ title: "Не удалось загрузить доступ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, canReadLogs, secretId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<SecretResponse>(isNew ? "/secrets" : `/secrets/${secretId}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(cleanPayload(form))
      });
      toast({ title: isNew ? "Доступ создан" : "Доступ сохранен", variant: "success" });
      setSecret(response.secret);
      setForm((current) => ({ ...current, secret: "", notes: "" }));

      if (isNew) {
        router.replace(`/secrets/${response.secret.id}`);
      } else {
        await load();
      }
    } catch (error) {
      toast({ title: "Не удалось сохранить доступ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function revealSecret() {
    if (!secretId) {
      return;
    }

    try {
      const response = await auth.api.request<SecretRevealResponse>(`/secrets/${secretId}/reveal`, {
        method: "POST",
        body: JSON.stringify({ reason: revealReason })
      });
      setRevealed(response);
      toast({ title: "Секрет раскрыт, действие записано в журнал", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Не удалось раскрыть секрет", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  function closeRevealModal() {
    setRevealOpen(false);
    setRevealReason("");
    setRevealed(null);
  }

  async function copyValue(value: string | null) {
    if (!value) {
      return;
    }

    await navigator.clipboard?.writeText(value);
    toast({ title: "Скопировано", variant: "success" });
  }

  return (
    <PermissionGate permission={isNew ? "secrets.create" : "secrets.read_metadata"}>
      <main className="space-y-4 p-4 sm:p-6">
        <div>
          <Button type="button" variant="ghost" onClick={() => router.push("/secrets")}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{isNew ? "Новый доступ" : secret?.title ?? "Доступ"}</h2>
        </div>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Загрузка</CardContent></Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <Card>
              <CardHeader><CardTitle>Метаданные</CardTitle></CardHeader>
              <CardContent>
                <SecretForm disabled={!canEdit} employees={employees} users={users} responsibilities={responsibilities} form={form} saving={saving} onChange={setForm} onSubmit={saveSecret} />
              </CardContent>
            </Card>

            {!isNew ? (
              <aside className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Раскрытие секрета</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-muted-foreground">Просмотр будет записан в журнал доступа. Не сохраняйте раскрытый секрет в заметки, чат или localStorage.</div>
                    {canReveal ? (
                      <Button className="w-full" type="button" onClick={() => setRevealOpen(true)}><KeyRound className="h-4 w-4" /> Показать</Button>
                    ) : (
                      <div className="text-muted-foreground">Нет права secrets.reveal.</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Связи</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Сотрудник</span><span>{formatEmployee(secret?.ownerEmployee)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Пользователь</span><span>{formatUser(secret?.ownerUser)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ответственность</span><span>{secret?.responsibility ? <Link className="text-primary hover:underline" href={`/responsibilities/${secret.responsibility.id}`}>{secret.responsibility.title}</Link> : "-"}</span></div>
                  </CardContent>
                </Card>

                {canReadLogs ? (
                  <Card>
                    <CardHeader><CardTitle>Журнал доступа</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {logs.length ? logs.map((log) => (
                        <div key={log.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatUser(log.user)} / {log.reason ?? "-"}</div>
                        </div>
                      )) : <div className="py-4 text-center text-sm text-muted-foreground">Записей пока нет</div>}
                    </CardContent>
                  </Card>
                ) : null}
              </aside>
            ) : null}
          </div>
        )}
        <RevealSecretDialog
          open={revealOpen}
          reason={revealReason}
          revealed={revealed}
          onReasonChange={setRevealReason}
          onReveal={() => void revealSecret()}
          onClose={closeRevealModal}
          onCopy={copyValue}
        />
      </main>
    </PermissionGate>
  );
}

function SecretForm({
  form,
  saving,
  disabled,
  employees,
  users = [],
  responsibilities,
  onChange,
  onSubmit
}: {
  form: SecretFormState;
  saving: boolean;
  disabled?: boolean;
  employees: Employee[];
  users?: UserOption[];
  responsibilities: Responsibility[];
  onChange: (form: SecretFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<SecretFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Field required label="Название" value={form.title} onChange={(title) => update({ title })} />
      <SelectField label="Тип" value={form.type} onChange={(type) => update({ type: type as SecretVaultItemType })}>
        {secretTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </SelectField>
      <Field label="Ссылка" value={form.url} onChange={(url) => update({ url })} />
      <Field label="Username" value={form.username} onChange={(username) => update({ username })} />
      <Field label="Login" value={form.login} onChange={(login) => update({ login })} />
      <Field label="Email" value={form.email} onChange={(email) => update({ email })} />
      <Field label="Телефон" value={form.phone} onChange={(phone) => update({ phone })} />
      <SelectEmployee employees={employees} value={form.ownerEmployeeId} onChange={(ownerEmployeeId) => update({ ownerEmployeeId })} />
      {users.length ? <SelectUser users={users} value={form.ownerUserId} onChange={(ownerUserId) => update({ ownerUserId })} /> : null}
      <SelectField label="Ответственность" value={form.responsibilityId} onChange={(responsibilityId) => update({ responsibilityId })}>
        <option value="">Не привязан</option>
        {responsibilities.map((responsibility) => <option key={responsibility.id} value={responsibility.id}>{responsibility.title}</option>)}
      </SelectField>
      <div className="md:col-span-2">
        <TextAreaField label="Описание" value={form.description} onChange={(description) => update({ description })} />
      </div>
      <Field label="Секрет / пароль" value={form.secret} onChange={(secret) => update({ secret })} />
      <Field label="2FA notes" value={form.notes} onChange={(notes) => update({ notes })} />
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

function RevealSecretDialog({
  open,
  reason,
  revealed,
  onReasonChange,
  onReveal,
  onClose,
  onCopy
}: {
  open: boolean;
  reason: string;
  revealed: SecretRevealResponse | null;
  onReasonChange: (value: string) => void;
  onReveal: () => void;
  onClose: () => void;
  onCopy: (value: string | null) => void | Promise<void>;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-popover shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-warning/30 bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Показать секрет</h3>
              <p className="mt-1 text-sm text-muted-foreground">Просмотр будет записан в журнал доступа. Значение очищается при закрытии окна.</p>
            </div>
          </div>
          <Button aria-label="Close" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {!revealed ? (
            <>
              <TextAreaField label="Причина просмотра" value={reason} rows={3} placeholder="Например: нужно оплатить Telegram Ads" onChange={onReasonChange} />
              <Button className="w-full" type="button" onClick={onReveal}>
                <KeyRound className="h-4 w-4" />
                Показать и записать в журнал
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Секрет раскрыт</span>
                <Button size="sm" type="button" variant="outline" onClick={onClose}>
                  <EyeOff className="h-4 w-4" />
                  Скрыть
                </Button>
              </div>
              <SecretValue label="Secret" value={revealed.secret} onCopy={onCopy} />
              <SecretValue label="Notes" value={revealed.notes} onCopy={onCopy} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecretValue({ label, value, onCopy }: { label: string; value: string | null; onCopy: (value: string | null) => void | Promise<void> }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
        {value ? <Button size="sm" type="button" variant="outline" onClick={() => void onCopy(value)}><Clipboard className="h-4 w-4" /> Копировать</Button> : null}
      </div>
      <div className="break-all font-mono text-sm">{value ?? "-"}</div>
    </div>
  );
}
