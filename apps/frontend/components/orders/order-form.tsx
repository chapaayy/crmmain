"use client";

import { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import type { Customer } from "@/components/customers/crm-types";
import type { DiscountType, Order } from "@/components/orders/order-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OrderFormState {
  customerId: string;
  contactId: string;
  leadId: string;
  managerId: string;
  warehouseId: string;
  currency: string;
  discountType: DiscountType;
  discountValue: string;
  taxRate: string;
  dueDate: string;
  notes: string;
}

export function emptyOrderForm(managerId = ""): OrderFormState {
  return {
    customerId: "",
    contactId: "",
    leadId: "",
    managerId,
    warehouseId: "",
    currency: "RUB",
    discountType: "NONE",
    discountValue: "",
    taxRate: "0",
    dueDate: "",
    notes: ""
  };
}

export function orderToForm(order: Order): OrderFormState {
  return {
    customerId: order.customerId,
    contactId: order.contactId ?? "",
    leadId: order.leadId ?? "",
    managerId: order.managerId ?? "",
    warehouseId: order.warehouseId ?? "",
    currency: order.currency,
    discountType: order.discountType,
    discountValue: order.discountValue === null || order.discountValue === undefined ? "" : String(order.discountValue),
    taxRate: order.taxRate === null || order.taxRate === undefined ? "0" : String(order.taxRate),
    dueDate: order.dueDate ? order.dueDate.slice(0, 10) : "",
    notes: order.notes ?? ""
  };
}

export function orderPayload(form: OrderFormState) {
  return cleanPayload({
    customerId: form.customerId,
    contactId: form.contactId,
    leadId: form.leadId,
    managerId: form.managerId,
    warehouseId: form.warehouseId,
    currency: form.currency,
    discountType: form.discountType,
    discountValue: form.discountValue ? Number(form.discountValue) : undefined,
    taxRate: form.taxRate ? Number(form.taxRate) : 0,
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : "",
    notes: form.notes
  });
}

export function OrderForm({
  customers,
  form,
  saving,
  submitLabel,
  onChange,
  onSubmit
}: {
  customers: Customer[];
  form: OrderFormState;
  saving?: boolean;
  submitLabel: string;
  onChange: (form: OrderFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<OrderFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="customer">Customer</Label>
          {customers.length ? (
            <select
              required
              id="customer"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.customerId}
              onChange={(event) => update({ customerId: event.target.value })}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          ) : (
            <Input required id="customer" value={form.customerId} onChange={(event) => update({ customerId: event.target.value })} />
          )}
        </div>
        <Field label="Contact ID" value={form.contactId} onChange={(contactId) => update({ contactId })} />
        <Field label="Lead ID" value={form.leadId} onChange={(leadId) => update({ leadId })} />
        <Field label="Manager ID" value={form.managerId} onChange={(managerId) => update({ managerId })} />
        <Field label="Warehouse ID" value={form.warehouseId} onChange={(warehouseId) => update({ warehouseId })} />
        <Field label="Currency" value={form.currency} onChange={(currency) => update({ currency })} />
        <div className="space-y-2">
          <Label htmlFor="discount-type">Discount</Label>
          <select
            id="discount-type"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.discountType}
            onChange={(event) => update({ discountType: event.target.value as DiscountType })}
          >
            <option value="NONE">No discount</option>
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </div>
        <Field label="Discount value" min="0" type="number" value={form.discountValue} onChange={(discountValue) => update({ discountValue })} />
        <Field label="Tax rate" min="0" type="number" value={form.taxRate} onChange={(taxRate) => update({ taxRate })} />
        <Field label="Due date" type="date" value={form.dueDate} onChange={(dueDate) => update({ dueDate })} />
        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </div>
      </div>
      <Button disabled={saving} type="submit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  type = "text",
  min,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} min={min} step={type === "number" ? "0.01" : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
