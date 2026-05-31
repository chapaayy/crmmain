"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Palette, Plus, Save, Search, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { AdminPermission, AdminRole } from "@/components/admin/admin-types";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/ui/role-badge";
import { getRoleDisplayName, normalizeRoleColor } from "@/lib/roles";

interface RolesResponse {
  roles: AdminRole[];
}

interface PermissionsResponse {
  permissions: AdminPermission[];
}

interface RoleFormState {
  name: string;
  color: string;
}

interface CreateRoleState {
  code: string;
  name: string;
  color: string;
}

const defaultCreateRoleState: CreateRoleState = {
  code: "CUSTOM_ROLE",
  name: "",
  color: "#22D3EE"
};

export function RolesAdmin() {
  const auth = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [activeRoleId, setActiveRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RoleFormState>({ name: "", color: "#22D3EE" });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState<CreateRoleState>(defaultCreateRoleState);

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? null;

  const filteredRoles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return roles;
    }

    return roles.filter((role) =>
      [getRoleDisplayName(role), role.code, role.description ?? ""].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [roles, search]);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        auth.api.request<RolesResponse>("/roles"),
        auth.api.request<PermissionsResponse>("/permissions")
      ]);

      setRoles(rolesResponse.roles);
      setPermissions(permissionsResponse.permissions);
      setActiveRoleId((current) => current || rolesResponse.roles[0]?.id || "");
    } catch (error) {
      toast({ title: "Не удалось загрузить роли", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  useEffect(() => {
    if (!activeRole) {
      return;
    }

    setForm({
      name: getRoleDisplayName(activeRole),
      color: normalizeRoleColor(activeRole.color, activeRole.code)
    });
    setSelectedPermissionIds(activeRole.permissions?.map((permission) => permission.id) ?? []);
  }, [activeRole]);

  async function syncCurrentUserRoleBadge() {
    try {
      await auth.refreshCurrentUser();
    } catch {
      // UI refresh for current user is best-effort only.
    }
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.code.trim()) {
      return;
    }

    setCreating(true);

    try {
      const response = await auth.api.request<{ role: AdminRole }>("/roles", {
        method: "POST",
        body: JSON.stringify({
          code: normalizeRoleCode(createForm.code),
          name: createForm.name.trim(),
          color: normalizeRoleColor(createForm.color)
        })
      });

      toast({ title: "Роль создана", variant: "success" });
      setCreateForm(defaultCreateRoleState);
      await load();
      setActiveRoleId(response.role.id);
    } catch (error) {
      toast({ title: "Не удалось создать роль", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function saveRole() {
    if (!activeRole || !form.name.trim()) {
      return;
    }

    setSaving(true);

    try {
      await auth.api.request(`/roles/${activeRole.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          color: normalizeRoleColor(form.color, activeRole.code)
        })
      });

      await auth.api.request(`/roles/${activeRole.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissionIds: selectedPermissionIds })
      });

      toast({ title: "Роль обновлена", variant: "success" });
      await load();
      await syncCurrentUserRoleBadge();
    } catch (error) {
      toast({ title: "Не удалось сохранить роль", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="roles.read">
      <main className="p-4 sm:p-6">
        <AdminPageHeader title="Роли" description="Настройка названия, цвета и разрешений роли." permission="roles.read" />

        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Список ролей</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Поиск роли" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка ролей
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRoles.length ? (
                    filteredRoles.map((role) => {
                      const active = role.id === activeRoleId;

                      return (
                        <button
                          key={role.id}
                          className={`flex w-full flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-primary/40 bg-sidebar-active" : "border-border/70 bg-card/60 hover:border-border hover:bg-card"}`}
                          type="button"
                          onClick={() => setActiveRoleId(role.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <RoleBadge roleInfo={role} />
                            <Badge variant="secondary">{role.permissions?.length ?? 0}</Badge>
                          </div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{role.code}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-5 text-sm text-muted-foreground">
                      По вашему поиску роли не найдены
                    </div>
                  )}
                </div>
              )}

              {auth.hasPermission("roles.manage") ? (
                <form className="space-y-3 border-t border-border/70 pt-4" onSubmit={createRole}>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Plus className="h-4 w-4 text-primary" />
                    Новая роль
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-role-name">Название роли</Label>
                    <Input
                      id="new-role-name"
                      placeholder="Например, Руководитель смены"
                      value={createForm.name}
                      onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-role-code">Код роли</Label>
                    <Input
                      id="new-role-code"
                      placeholder="SHIFT_SUPERVISOR"
                      value={createForm.code}
                      onChange={(event) => setCreateForm((current) => ({ ...current, code: normalizeRoleCode(event.target.value) }))}
                    />
                    <div className="text-xs text-muted-foreground">Нужен один раз для системы: только латиница, цифры и подчёркивания.</div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-role-color">Цвет плашки</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="new-role-color"
                        type="color"
                        value={createForm.color}
                        className="h-10 w-14 cursor-pointer rounded-xl border border-input bg-input p-1"
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, color: normalizeRoleColor(event.target.value) }))
                        }
                      />
                      <Input
                        value={createForm.color}
                        onChange={(event) => setCreateForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>

                  <Button className="w-full" disabled={creating || !createForm.name.trim() || !createForm.code.trim()} type="submit">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Создать роль
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Настройка роли</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeRole ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <RoleBadge roleInfo={{ ...activeRole, name: form.name, color: form.color }} className="text-sm" />
                    <Badge variant="outline">{activeRole.code}</Badge>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-2">
                      <Label htmlFor="role-name">Название роли</Label>
                      <Input
                        id="role-name"
                        disabled={!auth.hasPermission("roles.manage")}
                        maxLength={80}
                        placeholder="Например, Главный администратор"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role-color">Цвет плашки</Label>
                      <div className="flex items-center gap-3">
                        <input
                          id="role-color"
                          type="color"
                          value={form.color}
                          disabled={!auth.hasPermission("roles.manage")}
                          className="h-10 w-14 cursor-pointer rounded-xl border border-input bg-input p-1"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, color: normalizeRoleColor(event.target.value, activeRole.code) }))
                          }
                        />
                        <Input
                          disabled={!auth.hasPermission("roles.manage")}
                          value={form.color}
                          onChange={(event) => setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Palette className="h-4 w-4 text-primary" />
                      Разрешения роли
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {permissions.map((permission) => {
                        const checked = selectedPermissionIds.includes(permission.id);

                        return (
                          <label key={permission.id} className="flex items-start gap-2 rounded-xl border border-border/70 bg-card/60 p-3 text-sm">
                            <input
                              className="mt-1"
                              disabled={!auth.hasPermission("roles.manage")}
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setSelectedPermissionIds((current) =>
                                  event.target.checked ? [...current, permission.id] : current.filter((item) => item !== permission.id)
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block font-medium">{permission.key}</span>
                              <span className="block text-xs text-muted-foreground">{permission.name}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {auth.hasPermission("roles.manage") ? (
                    <Button disabled={saving || !form.name.trim()} type="button" onClick={() => void saveRole()}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Сохранить роль
                    </Button>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Выберите роль слева
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </PermissionGate>
  );
}

function normalizeRoleCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
