"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import {
  emptyProductForm,
  formToProductPayload,
  ProductForm,
  productToForm
} from "@/components/products/product-form";
import type {
  CategoriesResponse,
  Product,
  ProductCategory,
  ProductFormState,
  ProductResponse,
  ProductVariant
} from "@/components/products/product-types";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProductCreatePage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<CategoriesResponse>("/product-categories");
      setCategories(response.categories);
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || response.categories[0]?.id || ""
      }));
    } catch (error) {
      toast({ title: "Unable to load categories", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<ProductResponse>("/products", {
        method: "POST",
        body: JSON.stringify(formToProductPayload(form))
      });
      toast({ title: "Product created", variant: "success" });
      router.replace(`/products/${response.product.id}`);
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="products.create">
      <main className="p-4 sm:p-6">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>New product</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingLine label="Loading categories" />
            ) : categories.length === 0 ? (
              <EmptyCategories />
            ) : (
              <ProductForm categories={categories} form={form} saving={saving} submitLabel="Create product" onChange={setForm} onSubmit={save} />
            )}
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function ProductDetailPage({ productId }: { productId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [variantForm, setVariantForm] = useState<ProductFormState>(emptyProductForm());
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const canUpdate = auth.hasPermission("products.update");
  const canCreate = auth.hasPermission("products.create");
  const canDelete = auth.hasPermission("products.delete");
  const canShowVariantForm = editingVariantId ? canUpdate : canCreate;

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [productResponse, categoriesResponse] = await Promise.all([
        auth.api.request<ProductResponse>(`/products/${productId}`),
        auth.api.request<CategoriesResponse>("/product-categories")
      ]);

      setProduct(productResponse.product);
      setCategories(categoriesResponse.categories);
      setForm(productToForm(productResponse.product));
      setVariantForm((current) => ({
        ...current,
        categoryId: current.categoryId || productResponse.product.categoryId
      }));
    } catch (error) {
      toast({ title: "Unable to load product", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, productId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<ProductResponse>(`/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(formToProductPayload(form))
      });
      setProduct(response.product);
      setForm(productToForm(response.product));
      toast({ title: "Product saved", variant: "success" });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    try {
      await auth.api.request(`/products/${productId}`, { method: "DELETE" });
      toast({ title: "Product deleted", variant: "success" });
      router.replace("/products");
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingVariant(true);

    try {
      const path = editingVariantId ? `/products/${productId}/variants/${editingVariantId}` : `/products/${productId}/variants`;
      const method = editingVariantId ? "PATCH" : "POST";

      await auth.api.request(path, {
        method,
        body: JSON.stringify(formToProductPayload(variantForm))
      });
      toast({ title: editingVariantId ? "Variant saved" : "Variant created", variant: "success" });
      resetVariantForm();
      await load();
    } catch (error) {
      toast({ title: "Variant save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSavingVariant(false);
    }
  }

  async function deleteVariant(variantId: string) {
    try {
      await auth.api.request(`/products/${productId}/variants/${variantId}`, { method: "DELETE" });
      toast({ title: "Variant deleted", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Variant delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  function editVariant(variant: ProductVariant) {
    setEditingVariantId(variant.id);
    setVariantForm(productToForm(variant));
  }

  function resetVariantForm() {
    setEditingVariantId(null);
    setVariantForm(emptyProductForm(product?.categoryId ?? categories[0]?.id ?? ""));
  }

  return (
    <PermissionGate permission="products.read">
      <main className="space-y-4 p-4 sm:p-6">
        <BackButton />
        {loading || !product ? (
          <LoadingLine label="Loading product" />
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">{product.name}</h2>
                <p className="text-sm text-muted-foreground">{product.sku}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={product.isActive ? "success" : "warning"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant="outline">{product.category.name}</Badge>
                {canDelete ? (
                  <Button type="button" variant="outline" onClick={() => void deleteProduct()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Product details</CardTitle>
              </CardHeader>
              <CardContent>
                {canUpdate ? (
                  <ProductForm categories={categories} form={form} saving={saving} submitLabel="Save product" onChange={setForm} onSubmit={saveProduct} />
                ) : (
                  <ProductSummary product={product} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Variant</th>
                        <th className="px-4 py-3 font-medium">Specs</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {product.variants?.length ? (
                        product.variants.map((variant) => (
                          <tr key={variant.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{variant.name}</div>
                              <div className="text-xs text-muted-foreground">{variant.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {[variant.size, variant.density, variant.color].filter(Boolean).join(" / ") || "No specs"}
                            </td>
                            <td className="px-4 py-3">{formatMoney(variant.retailPrice ?? variant.wholesalePrice)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                {canUpdate ? (
                                  <Button size="sm" type="button" variant="outline" onClick={() => editVariant(variant)}>
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </Button>
                                ) : null}
                                {canDelete ? (
                                  <Button size="sm" type="button" variant="outline" onClick={() => void deleteVariant(variant.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                            No variants yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {canShowVariantForm ? (
                  <div className="rounded-md border p-4">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{editingVariantId ? "Edit variant" : "New variant"}</h3>
                      {editingVariantId ? (
                        <Button size="sm" type="button" variant="ghost" onClick={resetVariantForm}>
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                    <ProductForm
                      categories={categories}
                      form={variantForm}
                      saving={savingVariant}
                      submitLabel={editingVariantId ? "Save variant" : "Create variant"}
                      onChange={setVariantForm}
                      onSubmit={saveVariant}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </PermissionGate>
  );
}

function BackButton() {
  return (
    <Button asChild variant="outline">
      <Link href="/products">
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>
    </Button>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyCategories() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Create at least one category before adding products.</p>
      <Button asChild variant="outline">
        <Link href="/products/categories">
          <Plus className="h-4 w-4" />
          Categories
        </Link>
      </Button>
    </div>
  );
}

function ProductSummary({ product }: { product: Product }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-3">
      <SummaryItem label="Category" value={product.category.name} />
      <SummaryItem label="Bag type" value={product.bagType} />
      <SummaryItem label="Specs" value={[product.size, product.density, product.color].filter(Boolean).join(" / ") || "-"} />
      <SummaryItem label="Material" value={product.material} />
      <SummaryItem label="Capacity" value={product.capacity ?? "-"} />
      <SummaryItem label="Retail price" value={formatMoney(product.retailPrice)} />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}
