"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { CategoriesResponse, ProductCategory } from "@/components/products/product-types";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  parentId: ""
};

export function ProductCategoriesPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canCreate = auth.hasPermission("products.create");
  const canUpdate = auth.hasPermission("products.update");
  const canDelete = auth.hasPermission("products.delete");
  const filteredCategories = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return categories;
    }

    return categories.filter((category) =>
      [category.name, category.slug, category.description ?? ""].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [categories, search]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<CategoriesResponse>("/product-categories");
      setCategories(response.categories);
    } catch (error) {
      toast({ title: "Unable to load categories", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const path = editingId ? `/product-categories/${editingId}` : "/product-categories";
      const method = editingId ? "PATCH" : "POST";
      const payload = categoryPayload(form, Boolean(editingId));

      await auth.api.request(path, {
        method,
        body: JSON.stringify(payload)
      });
      toast({ title: editingId ? "Category saved" : "Category created", variant: "success" });
      resetForm();
      await load();
    } catch (error) {
      toast({ title: "Category save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await auth.api.request(`/product-categories/${id}`, { method: "DELETE" });
      toast({ title: "Category deleted", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  function editCategory(category: ProductCategory) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parentId ?? ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <PermissionGate permission="products.read">
      <main className="space-y-4 p-4 sm:p-6">
        <Button asChild variant="outline">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
        </Button>
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Product categories</CardTitle>
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search categories" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Slug</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                          Loading categories
                        </td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          No categories found
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((category) => (
                        <tr key={category.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{category.name}</div>
                            <div className="text-xs text-muted-foreground">{category.description}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                          <td className="px-4 py-3">{category._count?.products ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {canUpdate ? (
                                <Button size="sm" type="button" variant="outline" onClick={() => editCategory(category)}>
                                  Edit
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button size="sm" type="button" variant="outline" onClick={() => void deleteCategory(category.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {canCreate || editingId ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{editingId ? "Edit category" : "New category"}</CardTitle>
                  {editingId ? (
                    <Button size="sm" type="button" variant="ghost" onClick={resetForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={save}>
                  <Field required label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
                  <Field label="Slug" value={form.slug} onChange={(slug) => setForm({ ...form, slug })} />
                  <Field label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
                  <div className="space-y-2">
                    <Label htmlFor="parentId">Parent</Label>
                    <select
                      id="parentId"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.parentId}
                      onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                    >
                      <option value="">No parent</option>
                      {categories
                        .filter((category) => category.id !== editingId)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button disabled={saving || Boolean(editingId && !canUpdate)} type="submit">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingId ? "Save category" : "Create category"}
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

function Field({
  label,
  value,
  required,
  onChange
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function categoryPayload(payload: Record<string, string>, editing: boolean) {
  const clean = cleanPayload(payload);

  if (editing) {
    clean.description = payload.description;
    clean.parentId = payload.parentId;
  }

  if (!payload.slug.trim()) {
    delete clean.slug;
  }

  return clean;
}

function cleanPayload(payload: Record<string, string>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value.trim() !== ""));
}
