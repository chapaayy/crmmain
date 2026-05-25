"use client";

import { AlertCircle, Construction, Loader2 } from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast/toast-provider";

export function SectionScreen({
  title,
  permission
}: {
  title: string;
  permission?: string | string[];
}) {
  const { toast } = useToast();

  return (
    <PermissionGate permission={permission}>
      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
            <p className="text-sm text-muted-foreground">Records, assignments, and daily operational follow-up.</p>
          </div>
          <Badge variant="outline">Protected</Badge>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>Recent activity and work queue for this section.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">Open items</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Updating queue
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">Needs review</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  2 records
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">Permission</div>
                <div className="mt-2 text-sm font-medium">{Array.isArray(permission) ? permission.join(", ") : permission ?? "authenticated"}</div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() =>
                toast({
                  title: `${title} draft created`,
                  description: "The draft is ready for review.",
                  variant: "success"
                })
              }
            >
              Create draft
            </Button>
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}
