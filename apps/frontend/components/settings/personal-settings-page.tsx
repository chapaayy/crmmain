"use client";

import { Languages } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localeLabels, supportedLocales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function PersonalSettingsPage() {
  const auth = useAuth();

  return (
    <main className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Personal settings</h2>
          <p className="text-sm text-muted-foreground">Your workspace preferences.</p>
        </div>
        <Badge variant="outline">{auth.user?.email}</Badge>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            Interface language
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the language used in CRM menus, forms, notifications, and dashboards.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {supportedLocales.map((locale) => (
              <button
                key={locale}
                className="flex h-12 items-center justify-between rounded-md border px-3 text-left text-sm transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-primary/10"
                data-active={auth.locale === locale}
                type="button"
                onClick={() => void auth.updateLocale(locale as Locale)}
              >
                <span>{localeLabels[locale]}</span>
                {auth.locale === locale ? <Badge variant="secondary">Current language</Badge> : null}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
