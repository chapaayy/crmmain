"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiState = "checking" | "online" | "offline" | "missing";

export function ApiStatus({ apiUrl }: { apiUrl?: string }) {
  const [state, setState] = useState<ApiState>(apiUrl ? "checking" : "missing");
  const healthUrl = useMemo(() => (apiUrl ? `${apiUrl.replace(/\/$/, "")}/health` : ""), [apiUrl]);

  useEffect(() => {
    if (!healthUrl) {
      setState("missing");
      return;
    }

    const controller = new AbortController();

    fetch(healthUrl, { signal: controller.signal })
      .then((response) => setState(response.ok ? "online" : "offline"))
      .catch(() => setState("offline"));

    return () => controller.abort();
  }, [healthUrl]);

  if (state === "online") {
    return (
      <Badge variant="success" className="gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        API online
      </Badge>
    );
  }

  if (state === "offline") {
    return (
      <Badge variant="warning" className="gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        API offline
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5">
      <Activity className="h-3.5 w-3.5" />
      API check
    </Badge>
  );
}
