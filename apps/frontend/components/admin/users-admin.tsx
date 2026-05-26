"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { AdminRole, AdminUser, PaginatedResponse } from "@/components/admin/admin-types";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RolesResponse {
  roles: AdminRole[];
}

export function UsersAdmin() {
  const auth = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<AdminUser>["meta"]>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", roleCode: "VIEWER" });
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "10", search }).toString(), [page, search]);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<AdminUser>>(`/users?${query}`),
        auth.api.request<RolesResponse>("/roles")
      ]);

      setUsers(usersResponse.data);
      setMeta(usersResponse.meta);
      setRoles(rolesResponse.roles);
    } catch (error) {
      toast({ title: "Unable to load users", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);

    try {
      await auth.api.request("/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          roleCodes: [form.roleCode]
        })
      });
      toast({ title: "User created", variant: "success" });
      setForm({ email: "", password: "", name: "", roleCode: "VIEWER" });
      await load();
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PermissionGate permission="users.read">
      <main className="p-4 sm:p-6">
        <AdminPageHeader title="Users" description="Accounts, roles, and access state." permission="users.read" />
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Directory</CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search users"
                    value={search}
                    onChange={(event) => {
                      setPage(1);
                      setSearch(event.target.value);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                          Loading users
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-3">
                            <Link className="font-medium text-primary hover:underline" href={`/admin/users/${user.id}`}>
                              {user.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </td>
                          <td className="px-4 py-3">{user.primaryRole}</td>
                          <td className="px-4 py-3">
                            <Badge variant={user.isActive ? "success" : "warning"}>{user.isActive ? "Active" : "Blocked"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls meta={meta} onPageChange={setPage} />
            </CardContent>
          </Card>

          {auth.hasPermission("users.create") ? (
            <Card>
              <CardHeader>
                <CardTitle>New user</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={createUser}>
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Name</Label>
                    <Input id="new-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email</Label>
                    <Input id="new-email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Password</Label>
                    <Input id="new-password" required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-role">Role</Label>
                    <select
                      id="new-role"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.roleCode}
                      onChange={(event) => setForm({ ...form, roleCode: event.target.value })}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button className="w-full" disabled={creating} type="submit">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create user
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </PermissionGate>
  );
}
