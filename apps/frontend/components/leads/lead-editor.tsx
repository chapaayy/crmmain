"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Repeat2, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import type { Lead, LeadResponse, TimelineItem } from "@/components/customers/crm-types";
import { LeadForm, leadPayload, leadToForm, emptyLeadForm, type LeadFormState } from "@/components/leads/lead-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LeadCreatePage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<LeadFormState>(emptyLeadForm(auth.user?.id ?? ""));
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<LeadResponse>("/leads", {
        method: "POST",
        body: JSON.stringify(leadPayload(form))
      });
      toast({ title: "Lead created", variant: "success" });
      router.replace(`/leads/${response.lead.id}`);
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="leads.create">
      <main className="p-4 sm:p-6">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>New lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm form={form} saving={saving} submitLabel="Create lead" onChange={setForm} onSubmit={save} />
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyLeadForm());
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canUpdate = auth.hasPermission("leads.update");
  const canCreate = auth.hasPermission("leads.create");
  const canDelete = auth.hasPermission("leads.delete");
  const canConvert = canUpdate && auth.hasPermission("customers.create");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<LeadResponse>(`/leads/${leadId}`);
      setLead(response.lead);
      setForm(leadToForm(response.lead));
    } catch (error) {
      toast({ title: "Unable to load lead", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, leadId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await auth.api.request<LeadResponse>(`/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(leadPayload(form))
      });
      setLead(response.lead);
      setForm(leadToForm(response.lead));
      toast({ title: "Lead saved", variant: "success" });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    try {
      await auth.api.request(`/leads/${leadId}`, { method: "DELETE" });
      toast({ title: "Lead deleted", variant: "success" });
      router.replace("/leads");
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function convertLead() {
    try {
      const response = await auth.api.request<{ customer: { id: string } }>(`/leads/${leadId}/convert-to-customer`, { method: "POST" });
      toast({ title: "Lead converted", variant: "success" });
      router.replace(`/customers/${response.customer.id}`);
    } catch (error) {
      toast({ title: "Conversion failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!comment.trim()) {
      return;
    }

    try {
      await auth.api.request(`/leads/${leadId}/comments`, {
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

  return (
    <PermissionGate permission="leads.read">
      <main className="space-y-4 p-4 sm:p-6">
        <BackButton />
        {loading || !lead ? (
          <LoadingLine label="Loading lead" />
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal">{lead.name}</h2>
                <p className="text-sm text-muted-foreground">{[lead.phone, lead.email, lead.source].filter(Boolean).join(" / ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={lead.status === "WON" ? "success" : "secondary"}>{lead.status}</Badge>
                {canConvert && !lead.convertedAt ? (
                  <Button type="button" onClick={() => void convertLead()}>
                    <Repeat2 className="h-4 w-4" />
                    Convert
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button type="button" variant="outline" onClick={() => void deleteLead()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Lead card</CardTitle>
              </CardHeader>
              <CardContent>
                {canUpdate ? (
                  <LeadForm form={form} saving={saving} submitLabel="Save lead" onChange={setForm} onSubmit={saveLead} />
                ) : (
                  <LeadSummary lead={lead} />
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <TimelineCard timeline={lead.events ?? []} />
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

function BackButton() {
  return (
    <Button asChild variant="outline">
      <Link href="/leads">
        <ArrowLeft className="h-4 w-4" />
        Leads
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

function LeadSummary({ lead }: { lead: Lead }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-3">
      <SummaryItem label="Source" value={lead.source ?? "-"} />
      <SummaryItem label="Manager" value={lead.responsibleManager?.name ?? "-"} />
      <SummaryItem label="Next contact" value={lead.nextContactAt ? new Date(lead.nextContactAt).toLocaleString() : "-"} />
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
            <div key={item.id} className="rounded-md border p-3 text-sm">
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
