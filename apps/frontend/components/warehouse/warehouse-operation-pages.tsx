"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import type { ProductVariant, ProductsResponse, WarehousesResponse } from "@/components/warehouse/warehouse-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyStockForm = {
  warehouseId: "",
  productVariantId: "",
  quantity: "",
  quantityDelta: "",
  unit: "pcs",
  reference: "",
  note: ""
};

export function WarehouseReceiptsPage() {
  return <WarehouseStockOperationPage mode="receipt" />;
}

export function WarehouseAdjustmentsPage() {
  return <WarehouseStockOperationPage mode="adjustment" />;
}

function WarehouseStockOperationPage({ mode }: { mode: "receipt" | "adjustment" }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<WarehousesResponse["warehouses"]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [form, setForm] = useState(emptyStockForm);
  const [writeoff, setWriteoff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [warehousesResponse, productsResponse] = await Promise.all([
        auth.api.request<WarehousesResponse>("/warehouses"),
        auth.api.request<ProductsResponse>("/products?limit=100&isActive=true")
      ]);
      setWarehouses(warehousesResponse.warehouses);
      setVariants(productsResponse.data.flatMap((product) => product.variants ?? []));
      setForm((current) => ({
        ...current,
        warehouseId: current.warehouseId || warehousesResponse.warehouses[0]?.id || ""
      }));
    } catch (error) {
      toast({ title: "Unable to load form data", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const endpoint = mode === "receipt" ? "/warehouse/receipt" : writeoff ? "/warehouse/writeoff" : "/warehouse/adjust";
    const payload =
      mode === "receipt" || writeoff
        ? {
            warehouseId: form.warehouseId,
            productVariantId: form.productVariantId,
            quantity: Number(form.quantity),
            unit: form.unit,
            reference: form.reference,
            note: form.note
          }
        : {
            warehouseId: form.warehouseId,
            productVariantId: form.productVariantId,
            quantityDelta: Number(form.quantityDelta),
            unit: form.unit,
            reference: form.reference,
            note: form.note
          };

    try {
      await auth.api.request(endpoint, {
        method: "POST",
        body: JSON.stringify(cleanPayload(payload))
      });
      toast({ title: mode === "receipt" ? "Receipt posted" : writeoff ? "Writeoff posted" : "Adjustment posted", variant: "success" });
      setForm((current) => ({
        ...emptyStockForm,
        warehouseId: current.warehouseId,
        unit: current.unit
      }));
    } catch (error) {
      toast({ title: "Operation failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="warehouse.manage">
      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-normal">{mode === "receipt" ? "Receipts" : "Adjustments"}</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "receipt" ? "Post stock receipts into a warehouse." : "Adjust stock quantities or write off available stock."}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "receipt" ? "New receipt" : "Stock adjustment"}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingLine label="Loading form" />
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="warehouse">Warehouse</Label>
                    <select
                      required
                      id="warehouse"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.warehouseId}
                      onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))}
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} / {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="variant">Product variant</Label>
                    {variants.length ? (
                      <select
                        required
                        id="variant"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={form.productVariantId}
                        onChange={(event) => setForm((current) => ({ ...current, productVariantId: event.target.value }))}
                      >
                        <option value="">Select variant</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.sku} / {variant.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input required value={form.productVariantId} onChange={(event) => setForm((current) => ({ ...current, productVariantId: event.target.value }))} />
                    )}
                  </div>
                  {mode === "adjustment" ? (
                    <label className="flex h-10 items-center gap-2 self-end rounded-md border px-3 text-sm">
                      <input type="checkbox" checked={writeoff} onChange={(event) => setWriteoff(event.target.checked)} />
                      Write off available stock
                    </label>
                  ) : null}
                  {mode === "receipt" || writeoff ? (
                    <Field required label="Quantity" min="0.001" type="number" value={form.quantity} onChange={(quantity) => setForm((current) => ({ ...current, quantity }))} />
                  ) : (
                    <Field required label="Quantity delta" type="number" value={form.quantityDelta} onChange={(quantityDelta) => setForm((current) => ({ ...current, quantityDelta }))} />
                  )}
                  <Field label="Unit" value={form.unit} onChange={(unit) => setForm((current) => ({ ...current, unit }))} />
                  <Field label="Reference" value={form.reference} onChange={(reference) => setForm((current) => ({ ...current, reference }))} />
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="note">Note</Label>
                    <textarea
                      id="note"
                      className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </div>
                </div>
                <Button disabled={saving} type="submit">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Post
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

function Field({
  label,
  value,
  type = "text",
  min,
  required,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  min?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} min={min} step={type === "number" ? "0.001" : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
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

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
