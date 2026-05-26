"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, FileUp, Loader2, Plus, Search, Tags } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { CategoriesResponse, PaginatedResponse, Product, ProductCategory } from "@/components/products/product-types";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BooleanFilter = "all" | "true" | "false";

interface ProductFilters {
  search: string;
  categoryId: string;
  color: string;
  density: string;
  size: string;
  hasLiner: BooleanFilter;
  hasHandles: BooleanFilter;
  isActive: BooleanFilter;
  isCustomOrderAvailable: BooleanFilter;
}

export function ProductsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Product>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({
    search: "",
    categoryId: "",
    color: "",
    density: "",
    size: "",
    hasLiner: "all" as BooleanFilter,
    hasHandles: "all" as BooleanFilter,
    isActive: "all" as BooleanFilter,
    isCustomOrderAvailable: "all" as BooleanFilter
  });
  const canCreate = auth.hasPermission("products.create");
  const canImport = canCreate && auth.hasPermission("products.update");
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "12"
    });

    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== "all") {
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
      const [productsResponse, categoriesResponse] = await Promise.all([
        auth.api.request<PaginatedResponse<Product>>(`/products?${query}`),
        auth.api.request<CategoriesResponse>("/product-categories")
      ]);

      setProducts(productsResponse.data);
      setMeta(productsResponse.meta);
      setCategories(categoriesResponse.categories);
    } catch (error) {
      toast({ title: "Unable to load products", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter<K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function exportCsv() {
    try {
      const csv = await auth.api.requestText(`/products/export/csv?${query}`);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");

      link.href = url;
      link.download = "products.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);

    try {
      const csv = await file.text();
      const response = await auth.api.request<{ summary: { created: number; updated: number; restored: number; failed: number }; errors: string[] }>("/products/import/csv", {
        method: "POST",
        body: JSON.stringify({ csv })
      });

      toast({
        title: "CSV imported",
        description: `${response.summary.created} created, ${response.summary.updated} updated, ${response.summary.failed} failed`,
        variant: response.summary.failed ? "error" : "success"
      });
      await load();
    } catch (error) {
      toast({ title: "Import failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  return (
    <PermissionGate permission="products.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Products</h2>
            <p className="text-sm text-muted-foreground">Polypropylene bags, big bags, variants, and price catalog.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/products/categories">
                <Tags className="h-4 w-4" />
                Categories
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            {canImport ? (
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Import CSV
                <input accept=".csv,text/csv" className="sr-only" type="file" onChange={(event) => void importCsv(event)} />
              </label>
            ) : null}
            {canCreate ? (
              <>
                <Button asChild>
                  <Link href="/products/new">
                    <Plus className="h-4 w-4" />
                    New product
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by SKU, name, material"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <SelectFilter label="Category" value={filters.categoryId} onChange={(value) => updateFilter("categoryId", value)}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectFilter>
              <Input placeholder="Color" value={filters.color} onChange={(event) => updateFilter("color", event.target.value)} />
              <Input placeholder="Density" value={filters.density} onChange={(event) => updateFilter("density", event.target.value)} />
              <Input placeholder="Size" value={filters.size} onChange={(event) => updateFilter("size", event.target.value)} />
              <BooleanSelect label="Liner" value={filters.hasLiner} onChange={(value) => updateFilter("hasLiner", value)} />
              <BooleanSelect label="Handles" value={filters.hasHandles} onChange={(value) => updateFilter("hasHandles", value)} />
              <BooleanSelect label="Active" value={filters.isActive} onChange={(value) => updateFilter("isActive", value)} />
              <BooleanSelect label="Custom" value={filters.isCustomOrderAvailable} onChange={(value) => updateFilter("isCustomOrderAvailable", value)} />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Specs</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading products
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                        No products found
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <Link className="font-medium text-primary hover:underline" href={`/products/${product.id}`}>
                            {product.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </td>
                        <td className="px-4 py-3">{product.category.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {[product.size, product.density, product.color].filter(Boolean).join(" / ") || "No specs"}
                        </td>
                        <td className="px-4 py-3">{formatMoney(product.retailPrice ?? product.wholesalePrice)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={product.isActive ? "success" : "warning"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                            {product.hasLiner ? <Badge variant="secondary">liner</Badge> : null}
                            {product.hasHandles ? <Badge variant="secondary">handles</Badge> : null}
                            {product._count?.variants ? <Badge variant="outline">{product._count.variants} variants</Badge> : null}
                          </div>
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

function SelectFilter({
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
  const id = label.toLowerCase();

  return (
    <div className="space-y-2">
      <Label className="sr-only" htmlFor={id}>{label}</Label>
      <select id={id} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

function BooleanSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: BooleanFilter;
  onChange: (value: BooleanFilter) => void;
}) {
  return (
    <SelectFilter label={label} value={value} onChange={(next) => onChange(next as BooleanFilter)}>
      <option value="all">{label}: all</option>
      <option value="true">{label}: yes</option>
      <option value="false">{label}: no</option>
    </SelectFilter>
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
