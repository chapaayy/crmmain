"use client";

import { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import type { Lead } from "@/components/customers/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LeadFormState {
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  interestedProducts: string;
  responsibleManagerId: string;
  nextContactAt: string;
  comment: string;
  estimatedValue: string;
}

export function emptyLeadForm(managerId = ""): LeadFormState {
  return {
    name: "",
    phone: "",
    email: "",
    source: "",
    status: "NEW",
    interestedProducts: "",
    responsibleManagerId: managerId,
    nextContactAt: "",
    comment: "",
    estimatedValue: ""
  };
}

export function leadToForm(lead: Lead): LeadFormState {
  return {
    name: lead.name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    source: lead.source ?? "",
    status: lead.status,
    interestedProducts: lead.interestedProducts?.join(", ") ?? "",
    responsibleManagerId: lead.responsibleManagerId ?? "",
    nextContactAt: lead.nextContactAt ? lead.nextContactAt.slice(0, 16) : "",
    comment: lead.comment ?? "",
    estimatedValue: lead.estimatedValue === null || lead.estimatedValue === undefined ? "" : String(lead.estimatedValue)
  };
}

export function leadPayload(form: LeadFormState) {
  return cleanPayload({
    name: form.name,
    phone: form.phone,
    email: form.email,
    source: form.source,
    status: form.status,
    interestedProducts: splitList(form.interestedProducts),
    responsibleManagerId: form.responsibleManagerId,
    nextContactAt: form.nextContactAt ? new Date(form.nextContactAt).toISOString() : "",
    comment: form.comment,
    estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined
  });
}

export function LeadForm({
  form,
  saving,
  submitLabel,
  onChange,
  onSubmit
}: {
  form: LeadFormState;
  saving?: boolean;
  submitLabel: string;
  onChange: (form: LeadFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<LeadFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field required label="Name" value={form.name} onChange={(name) => update({ name })} />
        <Field label="Phone" value={form.phone} onChange={(phone) => update({ phone })} />
        <Field label="Email" type="email" value={form.email} onChange={(email) => update({ email })} />
        <Field label="Source" value={form.source} onChange={(source) => update({ source })} />
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="PROPOSAL">Proposal</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
        <Field label="Responsible manager ID" value={form.responsibleManagerId} onChange={(responsibleManagerId) => update({ responsibleManagerId })} />
        <Field label="Next contact" type="datetime-local" value={form.nextContactAt} onChange={(nextContactAt) => update({ nextContactAt })} />
        <Field label="Estimated value" type="number" value={form.estimatedValue} onChange={(estimatedValue) => update({ estimatedValue })} />
        <Field label="Interested products" value={form.interestedProducts} onChange={(interestedProducts) => update({ interestedProducts })} />
        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label htmlFor="comment">Comment</Label>
          <textarea
            id="comment"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.comment}
            onChange={(event) => update({ comment: event.target.value })}
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
      <Input
        required={required}
        id={id}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
