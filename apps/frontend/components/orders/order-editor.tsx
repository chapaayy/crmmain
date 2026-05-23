"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Download, FileText, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import type { Customer } from "@/components/customers/crm-types";
import type { ProductVariant } from "@/components/products/product-types";
import { OrderForm, emptyOrderForm, orderPayload, orderToForm, type OrderFormState } from "@/components/orders/order-form";
import { RelatedTasksCard } from "@/components/tasks/related-tasks-card";
import type {
  CustomersResponse,
  Document,
  DocumentsResponse,
  Order,
  OrderItem,
  OrderResponse,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentsResponse,
  ProductsResponse
} from "@/components/orders/order-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const statuses: OrderStatus[] = [
  "DRAFT",
  "NEW",
  "MANAGER_PROCESSING",
  "WAITING_PAYMENT",
  "PAID",
  "RESERVED",
  "PICKING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED"
];
const paymentStatuses: PaymentStatus[] = ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERPAID", "REFUNDED"];
const paymentMethods: PaymentMethod[] = ["BANK_TRANSFER", "CASH", "CARD", "ONLINE", "OTHER"];

const emptyItemForm = {
  productVariantId: "",
  quantity: "1",
  unitPrice: "",
  discount: "0",
  unit: "pcs",
  notes: ""
};
const emptyPaymentForm = {
  amount: "",
  method: "BANK_TRANSFER" as PaymentMethod,
  status: "PAID" as PaymentStatus,
  paidAt: new Date().toISOString().slice(0, 10),
  note: ""
};

type ItemFormState = typeof emptyItemForm;
type PaymentFormState = typeof emptyPaymentForm;

export function OrderCreatePage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<OrderFormState>(emptyOrderForm(auth.user?.id ?? ""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<CustomersResponse>("/customers?limit=100");
      setCustomers(response.data);
      setForm((current) => ({
        ...current,
        customerId: current.customerId || response.data[0]?.id || ""
      }));
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [auth.api]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<OrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify(orderPayload(form))
      });
      toast({ title: "Order created", variant: "success" });
      router.replace(`/orders/${response.order.id}`);
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="orders.create">
      <main className="p-4 sm:p-6">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>New order</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingLine label="Loading customers" />
            ) : (
              <OrderForm customers={customers} form={form} saving={saving} submitLabel="Create order" onChange={setForm} onSubmit={save} />
            )}
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [form, setForm] = useState<OrderFormState>(emptyOrderForm());
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus>("DRAFT");
  const [statusComment, setStatusComment] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const canUpdate = auth.hasPermission("orders.update");
  const canChangeStatus = auth.hasPermission("orders.change_status");
  const canReadPayments = auth.hasPermission("payments.read");
  const canManagePayments = auth.hasPermission("payments.manage");
  const canReadDocuments = auth.hasPermission("documents.read");
  const canManageDocuments = auth.hasPermission("documents.manage");
  const canReadTasks = auth.hasPermission("tasks.read");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const orderResponse = await auth.api.request<OrderResponse>(`/orders/${orderId}`);
      setOrder(orderResponse.order);
      setForm(orderToForm(orderResponse.order));
      setStatus(orderResponse.order.status);

      const [customersResponse, productsResponse] = await Promise.allSettled([
        auth.api.request<CustomersResponse>("/customers?limit=100"),
        auth.api.request<ProductsResponse>("/products?limit=100&isActive=true")
      ]);

      if (customersResponse.status === "fulfilled") {
        setCustomers(customersResponse.value.data);
      }

      if (productsResponse.status === "fulfilled") {
        setVariants(productsResponse.value.data.flatMap((product) => product.variants ?? []));
      }

      const [paymentsResponse, documentsResponse] = await Promise.allSettled([
        canReadPayments ? auth.api.request<PaymentsResponse>(`/orders/${orderId}/payments`) : Promise.resolve({ payments: [] }),
        canReadDocuments ? auth.api.request<DocumentsResponse>(`/documents?orderId=${orderId}&limit=100`) : Promise.resolve({ data: [] })
      ]);

      if (paymentsResponse.status === "fulfilled") {
        setPayments(paymentsResponse.value.payments);
      }

      if (documentsResponse.status === "fulfilled") {
        setDocuments(documentsResponse.value.data);
      }
    } catch (error) {
      toast({ title: "Unable to load order", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, canReadDocuments, canReadPayments, orderId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const localTotals = useMemo(() => (order ? estimateTotals(order.items ?? [], form) : null), [order, form]);
  const itemPreview = useMemo(() => {
    const quantity = Number(itemForm.quantity || 0);
    const unitPrice = Number(itemForm.unitPrice || 0);
    const discount = Number(itemForm.discount || 0);

    return Math.max(0, quantity * unitPrice - discount);
  }, [itemForm]);

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<OrderResponse>(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(orderPayload(form))
      });
      setOrder(response.order);
      setForm(orderToForm(response.order));
      toast({ title: "Order saved", variant: "success" });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder() {
    try {
      await auth.api.request(`/orders/${orderId}`, { method: "DELETE" });
      toast({ title: "Order deleted", variant: "success" });
      router.replace("/orders");
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingItem(true);

    try {
      const path = editingItemId ? `/orders/${orderId}/items/${editingItemId}` : `/orders/${orderId}/items`;
      const method = editingItemId ? "PATCH" : "POST";
      const response = await auth.api.request<OrderResponse>(path, {
        method,
        body: JSON.stringify(itemPayload(itemForm))
      });

      setOrder(response.order);
      setForm(orderToForm(response.order));
      resetItemForm();
      toast({ title: editingItemId ? "Item saved" : "Item added", variant: "success" });
    } catch (error) {
      toast({ title: "Item save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    try {
      const response = await auth.api.request<OrderResponse>(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
      setOrder(response.order);
      setForm(orderToForm(response.order));
      toast({ title: "Item deleted", variant: "success" });
    } catch (error) {
      toast({ title: "Item delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await auth.api.request<OrderResponse>(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, comment: statusComment })
      });
      setOrder(response.order);
      setStatus(response.order.status);
      setStatusComment("");
      toast({ title: "Status updated", variant: "success" });
    } catch (error) {
      toast({ title: "Status change failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!comment.trim()) {
      return;
    }

    try {
      await auth.api.request(`/orders/${orderId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment })
      });
      setComment("");
      toast({ title: "Comment added", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Comment failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (Number(paymentForm.amount) <= 0) {
      toast({ title: "Payment amount is required", variant: "error" });
      return;
    }

    setSavingPayment(true);

    try {
      await auth.api.request(`/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify(cleanPayload({
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          status: paymentForm.status,
          paidAt: paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : undefined,
          note: paymentForm.note
        }))
      });
      setPaymentForm(emptyPaymentForm);
      toast({ title: "Payment saved", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Payment failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSavingPayment(false);
    }
  }

  async function createOrderDocument(kind: "invoice" | "commercial-offer") {
    setSavingDocument(true);

    try {
      const response = await auth.api.request<{ document: Document }>(`/orders/${orderId}/documents/${kind}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      toast({ title: response.document.title, description: "PDF document is ready", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Document failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSavingDocument(false);
    }
  }

  async function downloadDocument(document: Document) {
    try {
      const blob = await auth.api.requestBlob(`/documents/${document.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = document.fileAsset?.originalName ?? `${document.number ?? document.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Download failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  function selectVariant(productVariantId: string) {
    const variant = variants.find((item) => item.id === productVariantId);
    setItemForm((current) => ({
      ...current,
      productVariantId,
      unitPrice: variant ? String(defaultVariantPrice(variant)) : current.unitPrice
    }));
  }

  function editItem(item: OrderItem) {
    setEditingItemId(item.id);
    setItemForm({
      productVariantId: item.variantId ?? "",
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discount: String(item.discount),
      unit: item.unit,
      notes: item.notes ?? ""
    });
  }

  function resetItemForm() {
    setEditingItemId(null);
    setItemForm(emptyItemForm);
  }

  return (
    <PermissionGate permission="orders.read">
      <main className="space-y-4 p-4 sm:p-6">
        <BackButton />
        {loading || !order ? (
          <LoadingLine label="Loading order" />
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">{order.number}</h2>
                <p className="text-sm text-muted-foreground">{order.customer?.name} / {formatMoney(order.total, order.currency)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                {canUpdate ? (
                  <Button type="button" variant="outline" onClick={() => void deleteOrder()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle>Order card</CardTitle>
                </CardHeader>
                <CardContent>
                  {canUpdate ? (
                    <OrderForm customers={customers} form={form} saving={saving} submitLabel="Save order" onChange={setForm} onSubmit={saveOrder} />
                  ) : (
                    <OrderSummary order={order} />
                  )}
                </CardContent>
              </Card>
              <TotalsCard order={order} localTotals={localTotals} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.items?.length ? (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Item</th>
                            <th className="px-3 py-2 font-medium">Qty</th>
                            <th className="px-3 py-2 font-medium">Price</th>
                            <th className="px-3 py-2 font-medium">Total</th>
                            <th className="px-3 py-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {order.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">{item.sku}</div>
                              </td>
                              <td className="px-3 py-2">{Number(item.quantity).toLocaleString()} {item.unit}</td>
                              <td className="px-3 py-2">{formatMoney(item.unitPrice, order.currency)}</td>
                              <td className="px-3 py-2 font-medium">{formatMoney(item.total, order.currency)}</td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-2">
                                  {canUpdate ? <Button size="sm" type="button" variant="outline" onClick={() => editItem(item)}>Edit</Button> : null}
                                  {canUpdate ? <Button size="sm" type="button" variant="outline" onClick={() => void deleteItem(item.id)}>Delete</Button> : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No items yet</div>
                  )}
                </CardContent>
              </Card>

              {canUpdate ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{editingItemId ? "Edit item" : "Add item"}</CardTitle>
                      {editingItemId ? (
                        <Button size="sm" type="button" variant="ghost" onClick={resetItemForm}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ItemForm
                      form={itemForm}
                      previewTotal={itemPreview}
                      saving={savingItem}
                      variants={variants}
                      onSelectVariant={selectVariant}
                      onChange={setItemForm}
                      onSubmit={saveItem}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {(canReadPayments || canReadDocuments) ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {canReadPayments ? (
                  <PaymentsCard
                    canManage={canManagePayments}
                    form={paymentForm}
                    order={order}
                    payments={payments}
                    saving={savingPayment}
                    onChange={setPaymentForm}
                    onSubmit={createPayment}
                  />
                ) : null}

                {canReadDocuments ? (
                  <DocumentsCard
                    canManage={canManageDocuments}
                    documents={documents}
                    saving={savingDocument}
                    onCreate={createOrderDocument}
                    onDownload={downloadDocument}
                  />
                ) : null}
              </div>
            ) : null}

            {canReadTasks ? <RelatedTasksCard relatedType="ORDER" relatedId={order.id} title="Order tasks" /> : null}

            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Status history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canChangeStatus ? (
                    <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={changeStatus}>
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={status}
                        onChange={(event) => setStatus(event.target.value as OrderStatus)}
                      >
                        {statuses.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <Input placeholder="Status comment" value={statusComment} onChange={(event) => setStatusComment(event.target.value)} />
                      <Button type="submit">Change</Button>
                    </form>
                  ) : null}
                  {order.statusHistory?.length ? (
                    order.statusHistory.map((item) => (
                      <div key={item.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{item.previousStatus ?? "START"} -> {item.status}</div>
                        <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()} / {item.changedBy?.name ?? "system"}</div>
                        {item.comment ? <div className="mt-1 text-muted-foreground">{item.comment}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No status history yet</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canUpdate ? (
                    <form className="space-y-3" onSubmit={addComment}>
                      <textarea
                        className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                      <Button type="submit">
                        <Plus className="h-4 w-4" />
                        Add comment
                      </Button>
                    </form>
                  ) : null}
                  {order.comments?.length ? (
                    order.comments.map((item) => (
                      <div key={item.id} className="rounded-md border p-3 text-sm">
                        <div>{item.body}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.author?.name ?? "user"} / {new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No comments yet</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </PermissionGate>
  );
}

function ItemForm({
  form,
  variants,
  previewTotal,
  saving,
  onSelectVariant,
  onChange,
  onSubmit
}: {
  form: ItemFormState;
  variants: ProductVariant[];
  previewTotal: number;
  saving?: boolean;
  onSelectVariant: (productVariantId: string) => void;
  onChange: (form: ItemFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<ItemFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="variant">Product variant</Label>
        {variants.length ? (
          <select
            required
            id="variant"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.productVariantId}
            onChange={(event) => onSelectVariant(event.target.value)}
          >
            <option value="">Select variant</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.sku} / {variant.name}
              </option>
            ))}
          </select>
        ) : (
          <Input required id="variant" value={form.productVariantId} onChange={(event) => update({ productVariantId: event.target.value })} />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field required label="Quantity" min="0.001" type="number" value={form.quantity} onChange={(quantity) => update({ quantity })} />
        <Field label="Unit price" min="0" type="number" value={form.unitPrice} onChange={(unitPrice) => update({ unitPrice })} />
        <Field label="Discount" min="0" type="number" value={form.discount} onChange={(discount) => update({ discount })} />
        <Field label="Unit" value={form.unit} onChange={(unit) => update({ unit })} />
      </div>
      <Field label="Notes" value={form.notes} onChange={(notes) => update({ notes })} />
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        UI estimate: <span className="font-medium">{previewTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <Button disabled={saving} type="submit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save item
      </Button>
    </form>
  );
}

function TotalsCard({ order, localTotals }: { order: Order; localTotals: { subtotal: number; discount: number; tax: number; total: number } | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <TotalLine label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
        <TotalLine label="Discount" value={formatMoney(order.discount, order.currency)} />
        <TotalLine label="Tax" value={formatMoney(order.tax, order.currency)} />
        <TotalLine strong label="Backend total" value={formatMoney(order.total, order.currency)} />
        {localTotals ? (
          <div className="rounded-md border bg-muted/40 p-3">
            UI estimate after unsaved header changes: {formatMoney(localTotals.total, order.currency)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentsCard({
  order,
  payments,
  form,
  canManage,
  saving,
  onChange,
  onSubmit
}: {
  order: Order;
  payments: Payment[];
  form: PaymentFormState;
  canManage: boolean;
  saving: boolean;
  onChange: (form: PaymentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<PaymentFormState>) => onChange({ ...form, ...patch });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Payments</CardTitle>
          <Badge variant={order.paymentStatus === "PAID" || order.paymentStatus === "OVERPAID" ? "success" : "secondary"}>{order.paymentStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <SummaryItem label="Order total" value={formatMoney(order.total, order.currency)} />
          <SummaryItem label="Paid" value={formatMoney(order.paidAmount, order.currency)} />
          <SummaryItem label="Balance" value={formatMoney(Math.max(0, Number(order.total) - Number(order.paidAmount)), order.currency)} />
        </div>

        {canManage ? (
          <form className="grid gap-3 md:grid-cols-5" onSubmit={onSubmit}>
            <Field required label="Amount" min="0.01" type="number" value={form.amount} onChange={(amount) => update({ amount })} />
            <SelectField label="Method" value={form.method} onChange={(method) => update({ method: method as PaymentMethod })}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </SelectField>
            <SelectField label="Status" value={form.status} onChange={(status) => update({ status: status as PaymentStatus })}>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SelectField>
            <Field label="Paid at" type="date" value={form.paidAt} onChange={(paidAt) => update({ paidAt })} />
            <div className="flex items-end">
              <Button className="w-full" disabled={saving} type="submit">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Add
              </Button>
            </div>
            <div className="md:col-span-5">
              <Field label="Note" value={form.note} onChange={(note) => update({ note })} />
            </div>
          </form>
        ) : null}

        {payments.length ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{payment.method}</td>
                    <td className="px-3 py-2">
                      <Badge variant={payment.status === "PAID" || payment.status === "OVERPAID" ? "success" : "secondary"}>{payment.status}</Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{formatMoney(payment.amount, payment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No payments yet</div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsCard({
  documents,
  canManage,
  saving,
  onCreate,
  onDownload
}: {
  documents: Document[];
  canManage: boolean;
  saving: boolean;
  onCreate: (kind: "invoice" | "commercial-offer") => void;
  onDownload: (document: Document) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Documents</CardTitle>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} size="sm" type="button" variant="outline" onClick={() => onCreate("commercial-offer")}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Offer
              </Button>
              <Button disabled={saving} size="sm" type="button" onClick={() => onCreate("invoice")}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Invoice
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {documents.length ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Document</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{document.title}</div>
                      <div className="text-xs text-muted-foreground">{document.number ?? document.id}</div>
                    </td>
                    <td className="px-3 py-2">{document.type}</td>
                    <td className="px-3 py-2">{new Date(document.issuedAt ?? document.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" type="button" variant="outline" onClick={() => onDownload(document)}>
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No documents yet</div>
        )}
      </CardContent>
    </Card>
  );
}

function TotalLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-3">
      <SummaryItem label="Customer" value={order.customer?.name ?? "-"} />
      <SummaryItem label="Manager" value={order.manager?.name ?? "-"} />
      <SummaryItem label="Due date" value={order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "-"} />
      <SummaryItem label="Currency" value={order.currency} />
      <SummaryItem label="Discount" value={`${order.discountType} ${order.discountValue}`} />
      <SummaryItem label="Tax rate" value={`${order.taxRate}%`} />
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

function BackButton() {
  return (
    <Button asChild variant="outline">
      <Link href="/orders">
        <ArrowLeft className="h-4 w-4" />
        Orders
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
      <Input
        required={required}
        id={id}
        min={min}
        step={type === "number" ? "0.001" : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
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
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function itemPayload(form: ItemFormState) {
  return cleanPayload({
    productVariantId: form.productVariantId,
    quantity: Number(form.quantity),
    unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
    discount: form.discount ? Number(form.discount) : 0,
    unit: form.unit,
    notes: form.notes
  });
}

function estimateTotals(items: OrderItem[], form: OrderFormState) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
  const discountValue = Number(form.discountValue || 0);
  const discount = form.discountType === "PERCENT" ? (subtotal * discountValue) / 100 : form.discountType === "FIXED" ? Math.min(discountValue, subtotal) : 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * Number(form.taxRate || 0)) / 100;

  return {
    subtotal,
    discount,
    tax,
    total: taxable + tax
  };
}

function defaultVariantPrice(variant: ProductVariant) {
  return Number(variant.wholesalePrice ?? variant.retailPrice ?? 0);
}

function statusVariant(status: OrderStatus): "success" | "warning" | "secondary" {
  if (status === "COMPLETED" || status === "PAID") {
    return "success";
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return "warning";
  }

  return "secondary";
}

function formatMoney(value: string | number, currency: string) {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
