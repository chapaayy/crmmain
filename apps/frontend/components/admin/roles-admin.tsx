"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search } from "lucide-react";
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

const roleCodes = ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "WAREHOUSE_MANAGER", "ACCOUNTANT", "VIEWER"];

interface RolesResponse {
  roles: AdminRole[];
}

interface PermissionsResponse {
  permissions: AdminPermission[];
}

export function RolesAdmin() {
  const auth = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [activeRoleId, setActiveRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleForm, setRoleForm] = useState({ code: "VIEWER", name: "", description: "" });
  const activeRole = roles.find((role) => role.id === activeRoleId);
  const selectedPermissionIds = useMemo(
    () => new Set(activeRole?.permissions?.map((permission) => permission.id) ?? []),
    [activeRole]
  );
  const filteredRoles = useMemo(
    () =>
      roles.filter((role) => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
          return true;
        }

        return [role.name, role.code, role.description ?? ""].some((value) => value.toLowerCase().includes(normalizedSearch));
      }),
    [roles, search]
  );

  const load = useCallback(async () => {
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
      toast({ title: "Unable to load roles", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.api.request("/roles", {
        method: "POST",
        body: JSON.stringify(roleForm)
      });
      toast({ title: "Role saved", variant: "success" });
      setRoleForm({ code: "VIEWER", name: "", description: "" });
      await load();
    } catch (error) {
      toast({ title: "Role save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function updateRole() {
    if (!activeRole) {
      return;
    }

    try {
      await auth.api.request(`/roles/${activeRole.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: activeRole.name,
          description: activeRole.description
        })
      });
      toast({ title: "Role updated", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Role update failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function updatePermissions(permissionIds: string[]) {
    if (!activeRole) {
      return;
    }

    try {
      await auth.api.request(`/roles/${activeRole.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissionIds })
      });
      toast({ title: "Permissions updated", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Permission update failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="roles.read">
      <main className="p-4 sm:p-6">
        <AdminPageHeader title="Roles" description="Role catalog and permission assignment." permission="roles.read" />
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search roles"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading roles
                </div>
              ) : (
                filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm ${activeRoleId === role.id ? "bg-accent" : ""}`}
                    type="button"
                    onClick={() => setActiveRoleId(role.id)}
                  >
                    <span className="font-medium">{role.name}</span>
                    <Badge variant="secondary">{role.permissions?.length ?? 0}</Badge>
                  </button>
                ))
              )}
              {auth.hasPermission("roles.manage") ? (
                <form className="space-y-3 border-t pt-3" onSubmit={createRole}>
                  <Label htmlFor="role-code">Role code</Label>
                  <select
                    id="role-code"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={roleForm.code}
                    onChange={(event) => setRoleForm({ ...roleForm, code: event.target.value, name: event.target.value })}
                  >
                    {roleCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <Input placeholder="Name" value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} />
                  <Input placeholder="Description" value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} />
                  <Button className="w-full" type="submit">
                    Save role
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {auth.hasPermission("roles.manage") ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeRole?.name ?? "Role"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeRole ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={activeRole.name}
                        onChange={(event) =>
                          setRoles((items) => items.map((role) => (role.id === activeRole.id ? { ...role, name: event.target.value } : role)))
                        }
                      />
                      <Input
                        value={activeRole.description ?? ""}
                        onChange={(event) =>
                          setRoles((items) =>
                            items.map((role) => (role.id === activeRole.id ? { ...role, description: event.target.value } : role))
                          )
                        }
                      />
                    </div>
                    <Button type="button" onClick={() => void updateRole()}>
                      <Save className="h-4 w-4" />
                      Save metadata
                    </Button>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {permissions.map((permission) => (
                        <label key={permission.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={selectedPermissionIds.has(permission.id)}
                            onChange={(event) => {
                              const next = new Set(selectedPermissionIds);
                              if (event.target.checked) {
                                next.add(permission.id);
                              } else {
                                next.delete(permission.id);
                              }
                              void updatePermissions(Array.from(next));
                            }}
                          />
                          <span>
                            <span className="block font-medium">{permission.key}</span>
                            <span className="text-xs text-muted-foreground">{permission.name}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Select a role</div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </PermissionGate>
  );
}
