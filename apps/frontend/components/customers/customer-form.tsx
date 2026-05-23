"use client";

import { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import type { Customer } from "@/components/customers/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CustomerFormState {
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  companyName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  deliveryAddress: string;
  phone: string;
  email: string;
  messengers: string;
  source: string;
  segment: string;
  responsibleManagerId: string;
  notes: string;
  status: string;
}

export function emptyCustomerForm(managerId = ""): CustomerFormState {
  return {
    type: "COMPANY",
    name: "",
    companyName: "",
    inn: "",
    kpp: "",
    ogrn: "",
    legalAddress: "",
    deliveryAddress: "",
    phone: "",
    email: "",
    messengers: "",
    source: "",
    segment: "",
    responsibleManagerId: managerId,
    notes: "",
    status: "ACTIVE"
  };
}

export function customerToForm(customer: Customer): CustomerFormState {
  return {
    type: customer.type,
    name: customer.name,
    companyName: customer.companyName ?? "",
    inn: customer.inn ?? "",
    kpp: customer.kpp ?? "",
    ogrn: customer.ogrn ?? "",
    legalAddress: customer.legalAddress ?? "",
    deliveryAddress: customer.deliveryAddress ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    messengers: customer.messengers?.join(", ") ?? "",
    source: customer.source ?? "",
    segment: customer.segment ?? "",
    responsibleManagerId: customer.responsibleManagerId ?? "",
    notes: customer.notes ?? "",
    status: customer.status
  };
}

export function customerPayload(form: CustomerFormState) {
  return cleanPayload({
    ...form,
    messengers: splitList(form.messengers)
  });
}

export function CustomerForm({
  form,
  saving,
  submitLabel,
  onChange,
  onSubmit
}: {
  form: CustomerFormState;
  saving?: boolean;
  submitLabel: string;
  onChange: (form: CustomerFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<CustomerFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.type}
            onChange={(event) => update({ type: event.target.value as CustomerFormState["type"] })}
          >
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </div>
        <Field required label="Name" value={form.name} onChange={(name) => update({ name })} />
        <Field label="Company name" value={form.companyName} onChange={(companyName) => update({ companyName })} />
        <Field label="INN" value={form.inn} onChange={(inn) => update({ inn })} />
        <Field label="KPP" value={form.kpp} onChange={(kpp) => update({ kpp })} />
        <Field label="OGRN" value={form.ogrn} onChange={(ogrn) => update({ ogrn })} />
        <Field label="Phone" value={form.phone} onChange={(phone) => update({ phone })} />
        <Field label="Email" type="email" value={form.email} onChange={(email) => update({ email })} />
        <Field label="Source" value={form.source} onChange={(source) => update({ source })} />
        <Field label="Segment" value={form.segment} onChange={(segment) => update({ segment })} />
        <Field label="Responsible manager ID" value={form.responsibleManagerId} onChange={(responsibleManagerId) => update({ responsibleManagerId })} />
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="ACTIVE">Active</option>
            <option value="LEAD">Lead</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <Field label="Messengers" value={form.messengers} onChange={(messengers) => update({ messengers })} />
        <Field label="Legal address" value={form.legalAddress} onChange={(legalAddress) => update({ legalAddress })} />
        <Field label="Delivery address" value={form.deliveryAddress} onChange={(deliveryAddress) => update({ deliveryAddress })} />
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
  required,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
