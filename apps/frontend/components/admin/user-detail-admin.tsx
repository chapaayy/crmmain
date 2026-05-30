"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import type { AdminRole, AdminUser } from "@/components/admin/admin-types";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRoleDisplayName } from "@/lib/roles";

interface UserResponse {
  user: AdminUser;
}

interface RolesResponse {
  roles: AdminRole[];
}

export function UserDetailAdmin({ userId }: { userId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canUpdateUsers = auth.hasPermission("users.update");
  const canDeleteUsers = auth.hasPermission("users.delete");
  const canManageRoles = auth.hasPermission("roles.manage");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [userResponse, rolesResponse] = await Promise.all([
        auth.api.request<UserResponse>(`/users/${userId}`),
        auth.api.request<RolesResponse>("/roles")
      ]);

      setUser(userResponse.user);
      setRoles(rolesResponse.roles);
      const assignedRoleCodes = userResponse.user.roles?.map((role) => role.code) ?? [];
      setSelectedRoleCodes(assignedRoleCodes.length ? assignedRoleCodes : [userResponse.user.primaryRole]);
    } catch (error) {
      toast({ title: "Unable to load user", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, toast, userId]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (!canUpdateUsers) {
      return;
    }

    if (canManageRoles && selectedRoleCodes.length === 0) {
      toast({ title: "Select at least one role", variant: "error" });
      return;
    }

    setSaving(true);

    try {
      await auth.api.request(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone
        })
      });
      if (canManageRoles) {
        await auth.api.request(`/users/${userId}/roles`, {
          method: "POST",
          body: JSON.stringify({ roleCodes: selectedRoleCodes })
        });
      }
      toast({ title: "User saved", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword() {
    if (!password) {
      return;
    }

    try {
      await auth.api.request(`/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password })
      });
      setPassword("");
      toast({ title: "Password updated", variant: "success" });
    } catch (error) {
      toast({ title: "Password update failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function setActive(isActive: boolean) {
    try {
      await auth.api.request(`/users/${userId}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      });
      toast({ title: isActive ? "User activated" : "User blocked", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Status update failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function deleteUser() {
    try {
      await auth.api.request(`/users/${userId}`, { method: "DELETE" });
      toast({ title: "User deleted", variant: "success" });
      router.replace("/admin/users");
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <PermissionGate permission="users.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
              Users
            </Link>
          </Button>
        </div>
        {loading || !user ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading user
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>{user.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                  <Field disabled={!canUpdateUsers} label="Name" value={user.name} onChange={(value) => setUser({ ...user, name: value })} />
                  <Field disabled={!canUpdateUsers} label="Email" type="email" value={user.email} onChange={(value) => setUser({ ...user, email: value })} />
                  <Field disabled={!canUpdateUsers} label="First name" value={user.firstName ?? ""} onChange={(value) => setUser({ ...user, firstName: value })} />
                  <Field disabled={!canUpdateUsers} label="Last name" value={user.lastName ?? ""} onChange={(value) => setUser({ ...user, lastName: value })} />
                  <Field disabled={!canUpdateUsers} label="Phone" value={user.phone ?? ""} onChange={(value) => setUser({ ...user, phone: value })} />
                  {canManageRoles ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Roles</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedRoleCodes.includes(role.code)}
                              onChange={(event) =>
                                setSelectedRoleCodes((items) =>
                                  event.target.checked ? [...items, role.code] : items.filter((item) => item !== role.code)
                                )
                              }
                            />
                            {getRoleDisplayName(role)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {canUpdateUsers ? (
                    <div className="sm:col-span-2">
                      <Button disabled={saving} type="submit">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save changes
                      </Button>
                    </div>
                  ) : null}
                </form>
              </CardContent>
            </Card>

            {canUpdateUsers || canDeleteUsers ? (
              <Card>
                <CardHeader>
                  <CardTitle>Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {canUpdateUsers ? (
                      <Button type="button" variant={user.isActive ? "secondary" : "default"} onClick={() => void setActive(!user.isActive)}>
                        {user.isActive ? "Block" : "Activate"}
                      </Button>
                    ) : null}
                    {canDeleteUsers ? (
                      <Button type="button" variant="outline" onClick={() => void deleteUser()}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                  {canUpdateUsers ? (
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input id="new-password" minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                      <Button className="w-full" type="button" variant="outline" onClick={() => void updatePassword()}>
                        Update password
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </main>
    </PermissionGate>
  );
}

function Field({
  label,
  value,
  type = "text",
  disabled,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input disabled={disabled} id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
