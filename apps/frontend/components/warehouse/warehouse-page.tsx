"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Save, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import type { OrdersResponse, Warehouse, WarehousesResponse } from "@/components/warehouse/warehouse-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyWarehouseForm = {
  code: "",
  name: "",
  address: "",
  managerId: "",
  isActive: true
};

type OrderOperation = "reserve" | "release" | "ship";

const emptyOrderOperationForm = {
  operation: "reserve" as OrderOperation,
  orderId: "",
  warehouseId: "",
  note: ""
};

export function WarehousePage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<OrdersResponse["data"]>([]);
  const [form, setForm] = useState(emptyWarehouseForm);
  const [operationForm, setOperationForm] = useState(emptyOrderOperationForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningOperation, setRunningOperation] = useState(false);
  const canManage = auth.hasPermission("warehouse.manage");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [warehousesResponse, ordersResponse] = await Promise.allSettled([
        auth.api.request<WarehousesResponse>("/warehouses"),
        auth.api.request<OrdersResponse>("/orders?limit=100")
      ]);

      if (warehousesResponse.status === "fulfilled") {
        setWarehouses(warehousesResponse.value.warehouses);
        setOperationForm((current) => ({
          ...current,
          warehouseId: current.warehouseId || warehousesResponse.value.warehouses[0]?.id || ""
        }));
      }

      if (ordersResponse.status === "fulfilled") {
        setOrders(ordersResponse.value.data);
      }
    } catch (error) {
      toast({ title: "Unable to load warehouse data", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/warehouses", {
        method: "POST",
        body: JSON.stringify(cleanPayload(form))
      });
      setForm(emptyWarehouseForm);
      toast({ title: "Warehouse created", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteWarehouse(id: string) {
    try {
      await auth.api.request(`/warehouses/${id}`, { method: "DELETE" });
      toast({ title: "Warehouse deleted", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function runOrderOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunningOperation(true);

    const endpointByOperation = {
      reserve: "/warehouse/reserve",
      release: "/warehouse/release-reservation",
      ship: "/warehouse/ship-order"
    } as const;
    const endpoint = endpointByOperation[operationForm.operation];

    try {
      await auth.api.request(endpoint, {
        method: "POST",
        body: JSON.stringify(cleanPayload({
          orderId: operationForm.orderId,
          warehouseId: operationForm.warehouseId,
          note: operationForm.note
        }))
      });
      toast({ title: "Stock operation completed", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Operation failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setRunningOperation(false);
    }
  }

  return (
    <PermissionGate permission="warehouse.read">
      <main className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Warehouse</h2>
            <p className="text-sm text-muted-foreground">Warehouses, stock availability, and order stock operations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/warehouse/stock">
                Stock
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/warehouse/movements">
                Movements
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {canManage ? (
              <Button asChild variant="outline">
                <Link href="/warehouse/receipts">
                  Receipts
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <Button asChild variant="outline">
                <Link href="/warehouse/adjustments">
                  Adjustments
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <LoadingLine label="Loading warehouse" />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Warehouse cards</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {warehouses.length ? (
                    warehouses.map((warehouse) => (
                      <div key={warehouse.id} className="rounded-md border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{warehouse.name}</div>
                            <div className="text-sm text-muted-foreground">{warehouse.code}</div>
                          </div>
                          <Badge variant={warehouse.isActive ? "success" : "secondary"}>{warehouse.isActive ? "Active" : "Inactive"}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                          <div>{warehouse.address ?? "No address"}</div>
                          <div>{warehouse._count?.stockItems ?? 0} stock items / {warehouse._count?.orders ?? 0} orders</div>
                          <div>Manager: {warehouse.manager?.name ?? "-"}</div>
                        </div>
                        {canManage ? (
                          <Button className="mt-3" size="sm" type="button" variant="outline" onClick={() => void deleteWarehouse(warehouse.id)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">No warehouses yet</div>
                  )}
                </CardContent>
              </Card>

              {canManage ? (
                <Card>
                  <CardHeader>
                    <CardTitle>New warehouse</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={createWarehouse}>
                      <Field required label="Code" value={form.code} onChange={(code) => setForm((current) => ({ ...current, code }))} />
                      <Field required label="Name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
                      <Field label="Address" value={form.address} onChange={(address) => setForm((current) => ({ ...current, address }))} />
                      <Field label="Manager ID" value={form.managerId} onChange={(managerId) => setForm((current) => ({ ...current, managerId }))} />
                      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                        />
                        Active
                      </label>
                      <Button disabled={saving} type="submit">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Create warehouse
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {canManage ? (
              <Card>
                <CardHeader>
                  <CardTitle>Order stock operation</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3 md:grid-cols-[180px_1fr_1fr_1fr_auto]" onSubmit={runOrderOperation}>
                    <select
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={operationForm.operation}
                      onChange={(event) => setOperationForm((current) => ({ ...current, operation: event.target.value as OrderOperation }))}
                    >
                      <option value="reserve">Reserve</option>
                      <option value="release">Release reservation</option>
                      <option value="ship">Ship order</option>
                    </select>
                    <select
                      required
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={operationForm.orderId}
                      onChange={(event) => setOperationForm((current) => ({ ...current, orderId: event.target.value }))}
                    >
                      <option value="">Select order</option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.number} / {order.customer?.name ?? "-"} / {order.status}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={operationForm.warehouseId}
                      onChange={(event) => setOperationForm((current) => ({ ...current, warehouseId: event.target.value }))}
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} / {warehouse.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Note"
                      value={operationForm.note}
                      onChange={(event) => setOperationForm((current) => ({ ...current, note: event.target.value }))}
                    />
                    <Button disabled={runningOperation} type="submit">
                      {runningOperation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Run
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
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
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} value={value} onChange={(event) => onChange(event.target.value)} />
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
