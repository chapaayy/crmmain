"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PermissionGate({
  permission,
  children
}: {
  permission?: string | string[];
  children: React.ReactNode;
}) {
  const auth = useAuth();

  if (auth.hasPermission(permission)) {
    return <>{children}</>;
  }

  return (
    <div className="p-4 sm:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" />
            Access required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Your account does not include the permission needed for this section.</p>
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
