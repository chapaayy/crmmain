"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { Customer, CustomerContact, CustomerResponse, TimelineItem, TimelineResponse } from "@/components/customers/crm-types";
import { CustomerForm, customerPayload, customerToForm, emptyCustomerForm, type CustomerFormState } from "@/components/customers/customer-form";
import { useAuth } from "@/components/auth/auth-provider";
import { RelatedTasksCard } from "@/components/tasks/related-tasks-card";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyContact = {
  fullName: "",
  position: "",
  phone: "",
  email: "",
  isPrimary: false,
  notes: ""
};

type ContactFormState = typeof emptyContact;

export function CustomerCreatePage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm(auth.user?.id ?? ""));
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<CustomerResponse>("/customers", {
        method: "POST",
        body: JSON.stringify(customerPayload(form))
      });
      toast({ title: "Customer created", variant: "success" });
      router.replace(`/customers/${response.customer.id}`);
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="customers.create">
      <main className="p-4 sm:p-6">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>New customer</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerForm form={form} saving={saving} submitLabel="Create customer" onChange={setForm} onSubmit={save} />
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm());
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContact);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const canUpdate = auth.hasPermission("customers.update");
  const canCreate = auth.hasPermission("customers.create");
  const canDelete = auth.hasPermission("customers.delete");
  const canReadTasks = auth.hasPermission("tasks.read");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [customerResponse, timelineResponse] = await Promise.all([
        auth.api.request<CustomerResponse>(`/customers/${customerId}`),
        auth.api.request<TimelineResponse>(`/customers/${customerId}/timeline`)
      ]);

      setCustomer(customerResponse.customer);
      setForm(customerToForm(customerResponse.customer));
      setTimeline(timelineResponse.timeline);
    } catch (error) {
      toast({ title: "Unable to load customer", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, customerId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<CustomerResponse>(`/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify(customerPayload(form))
      });
      setCustomer(response.customer);
      setForm(customerToForm(response.customer));
      toast({ title: "Customer saved", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    try {
      await auth.api.request(`/customers/${customerId}`, { method: "DELETE" });
      toast({ title: "Customer archived", variant: "success" });
      router.replace("/customers");
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingContact(true);

    try {
      const path = editingContactId ? `/customers/${customerId}/contacts/${editingContactId}` : `/customers/${customerId}/contacts`;
      const method = editingContactId ? "PATCH" : "POST";

      await auth.api.request(path, {
        method,
        body: JSON.stringify(cleanPayload(contactForm))
      });
      toast({ title: editingContactId ? "Contact saved" : "Contact created", variant: "success" });
      resetContact();
      await load();
    } catch (error) {
      toast({ title: "Contact save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSavingContact(false);
    }
  }

  async function deleteContact(contactId: string) {
    try {
      await auth.api.request(`/customers/${customerId}/contacts/${contactId}`, { method: "DELETE" });
      toast({ title: "Contact deleted", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Contact delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!comment.trim()) {
      return;
    }

    try {
      await auth.api.request(`/customers/${customerId}/comments`, {
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

  function editContact(contact: CustomerContact) {
    setEditingContactId(contact.id);
    setContactForm({
      fullName: contact.fullName,
      position: contact.position ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      isPrimary: contact.isPrimary,
      notes: contact.notes ?? ""
    });
  }

  function resetContact() {
    setEditingContactId(null);
    setContactForm(emptyContact);
  }

  return (
    <PermissionGate permission="customers.read">
      <main className="space-y-4 p-4 sm:p-6">
        <BackButton />
        {loading || !customer ? (
          <LoadingLine label="Loading customer" />
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">{customer.name}</h2>
                <p className="text-sm text-muted-foreground">{[customer.phone, customer.email, customer.inn].filter(Boolean).join(" / ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={customer.status === "ACTIVE" ? "success" : "secondary"}>{customer.status}</Badge>
                <Badge variant="outline">{customer.type}</Badge>
                {canDelete ? (
                  <Button type="button" variant="outline" onClick={() => void deleteCustomer()}>
                    <Trash2 className="h-4 w-4" />
                    Archive
                  </Button>
                ) : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Customer card</CardTitle>
              </CardHeader>
              <CardContent>
                {canUpdate ? (
                  <CustomerForm form={form} saving={saving} submitLabel="Save customer" onChange={setForm} onSubmit={saveCustomer} />
                ) : (
                  <CustomerSummary customer={customer} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customer.contacts?.length ? (
                    customer.contacts.map((contact) => (
                      <div key={contact.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium">{contact.fullName}</div>
                          <div className="text-sm text-muted-foreground">{[contact.position, contact.phone, contact.email].filter(Boolean).join(" / ")}</div>
                        </div>
                        <div className="flex gap-2">
                          {contact.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                          {canUpdate ? <Button size="sm" type="button" variant="outline" onClick={() => editContact(contact)}>Edit</Button> : null}
                          {canDelete ? <Button size="sm" type="button" variant="outline" onClick={() => void deleteContact(contact.id)}>Delete</Button> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No contacts yet</div>
                  )}
                </CardContent>
              </Card>

              {canCreate || editingContactId ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{editingContactId ? "Edit contact" : "New contact"}</CardTitle>
                      {editingContactId ? (
                        <Button size="sm" type="button" variant="ghost" onClick={resetContact}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ContactForm form={contactForm} saving={savingContact} onChange={setContactForm} onSubmit={saveContact} />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Order history</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Orders will appear here after the orders module is connected.
                </div>
              </CardContent>
            </Card>

            {canReadTasks ? <RelatedTasksCard relatedType="CUSTOMER" relatedId={customer.id} title="Customer tasks" /> : null}

            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <TimelineCard timeline={timeline} />
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  {canCreate ? (
                    <form className="space-y-3" onSubmit={addComment}>
                      <textarea
                        className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                      <Button type="submit">
                        <Plus className="h-4 w-4" />
                        Add comment
                      </Button>
                    </form>
                  ) : (
                    <div className="text-sm text-muted-foreground">Comments are read-only for your account.</div>
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

function ContactForm({
  form,
  saving,
  onChange,
  onSubmit
}: {
  form: ContactFormState;
  saving?: boolean;
  onChange: (form: ContactFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<ContactFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <Field required label="Full name" value={form.fullName} onChange={(fullName) => update({ fullName })} />
      <Field label="Position" value={form.position} onChange={(position) => update({ position })} />
      <Field label="Phone" value={form.phone} onChange={(phone) => update({ phone })} />
      <Field label="Email" type="email" value={form.email} onChange={(email) => update({ email })} />
      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
        <input type="checkbox" checked={form.isPrimary} onChange={(event) => update({ isPrimary: event.target.checked })} />
        Primary contact
      </label>
      <Field label="Notes" value={form.notes} onChange={(notes) => update({ notes })} />
      <Button disabled={saving} type="submit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save contact
      </Button>
    </form>
  );
}

function BackButton() {
  return (
    <Button asChild variant="outline">
      <Link href="/customers">
        <ArrowLeft className="h-4 w-4" />
        Customers
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

function CustomerSummary({ customer }: { customer: Customer }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-3">
      <SummaryItem label="Company" value={customer.companyName ?? "-"} />
      <SummaryItem label="INN" value={customer.inn ?? "-"} />
      <SummaryItem label="Source" value={customer.source ?? "-"} />
      <SummaryItem label="Segment" value={customer.segment ?? "-"} />
      <SummaryItem label="Manager" value={customer.responsibleManager?.name ?? "-"} />
      <SummaryItem label="Delivery" value={customer.deliveryAddress ?? "-"} />
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

function TimelineCard({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {timeline.length ? (
          timeline.map((item) => (
            <div key={`${item.kind ?? "event"}-${item.id}`} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString()}</div>
              </div>
              {item.description ? <div className="mt-1 text-muted-foreground">{item.description}</div> : null}
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No timeline events yet</div>
        )}
      </CardContent>
    </Card>
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

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}
