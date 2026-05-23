"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { SettingsPayload } from "@/components/admin/admin-types";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsResponse {
  settings: SettingsPayload;
}

const emptySettings: SettingsPayload = {
  companyProfile: {},
  requisites: {},
  documentNumbering: {},
  leadSources: [],
  orderStatuses: [],
  paymentMethods: [],
  deliveryMethods: []
};

export function SettingsAdmin() {
  const auth = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsPayload>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<SettingsResponse>("/settings");
      setSettings(response.settings);
    } catch (error) {
      toast({ title: "Unable to load settings", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await auth.api.request("/settings", {
        method: "PATCH",
        body: JSON.stringify(settings)
      });
      toast({ title: "Settings saved", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <main className="p-4 sm:p-6">
        <AdminPageHeader title="Settings" description="Company data, document rules, and operational dictionaries." permission="settings.manage" />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings
          </div>
        ) : (
          <form className="space-y-4" onSubmit={save}>
            <div className="grid gap-4 xl:grid-cols-2">
              <SettingsCard title="Company profile">
                {["name", "shortName", "phone", "email", "website", "address"].map((key) => (
                  <SettingField
                    key={key}
                    label={key}
                    value={String(settings.companyProfile[key] ?? "")}
                    onChange={(value) =>
                      setSettings({ ...settings, companyProfile: { ...settings.companyProfile, [key]: value } })
                    }
                  />
                ))}
              </SettingsCard>
              <SettingsCard title="Requisites">
                {["inn", "kpp", "ogrn", "bankName", "bik", "account", "correspondentAccount"].map((key) => (
                  <SettingField
                    key={key}
                    label={key}
                    value={String(settings.requisites[key] ?? "")}
                    onChange={(value) => setSettings({ ...settings, requisites: { ...settings.requisites, [key]: value } })}
                  />
                ))}
              </SettingsCard>
              <SettingsCard title="Document numbering">
                {[
                  "orderPrefix",
                  "invoicePrefix",
                  "commercialOfferPrefix",
                  "deliveryNotePrefix",
                  "actPrefix",
                  "contractPrefix",
                  "startFrom",
                  "yearlyReset"
                ].map((key) => (
                  <SettingField
                    key={key}
                    label={key}
                    value={String(settings.documentNumbering[key] ?? "")}
                    onChange={(value) =>
                      setSettings({ ...settings, documentNumbering: { ...settings.documentNumbering, [key]: coerceValue(value) } })
                    }
                  />
                ))}
              </SettingsCard>
              <SettingsCard title="Dictionaries">
                <ArrayField label="Lead sources" value={settings.leadSources} onChange={(value) => setSettings({ ...settings, leadSources: value })} />
                <ArrayField label="Order statuses" value={settings.orderStatuses} onChange={(value) => setSettings({ ...settings, orderStatuses: value })} />
                <ArrayField label="Payment methods" value={settings.paymentMethods} onChange={(value) => setSettings({ ...settings, paymentMethods: value })} />
                <ArrayField label="Delivery methods" value={settings.deliveryMethods} onChange={(value) => setSettings({ ...settings, deliveryMethods: value })} />
              </SettingsCard>
            </div>
            <Button disabled={saving} type="submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save settings
            </Button>
          </form>
        )}
      </main>
    </PermissionGate>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function SettingField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <Input id={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ArrayField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={label}>{label}</Label>
      <Input id={label} value={value.join(", ")} onChange={(event) => onChange(splitList(event.target.value))} />
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function coerceValue(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) || value.trim() === "" ? value : numeric;
}
