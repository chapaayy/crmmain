"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const sseUrl = useMemo(() => {
    if (!apiBaseUrl || !auth.accessToken) {
      return "";
    }

    return `${apiBaseUrl.replace(/\/$/, "")}/realtime/events?token=${encodeURIComponent(auth.accessToken)}`;
  }, [apiBaseUrl, auth.accessToken]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await auth.api.request<NotificationsResponse>("/notifications?limit=10");
      setItems(response.data);
      setUnreadCount(response.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [auth.api]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);

    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!sseUrl) {
      return;
    }

    const source = new EventSource(sseUrl);
    const refresh = () => void load();

    source.addEventListener("notification.created", refresh);
    source.addEventListener("notification.read", refresh);
    source.addEventListener("notification.read_all", refresh);
    source.addEventListener("order.created", refresh);
    source.addEventListener("order.status_changed", refresh);
    source.addEventListener("task.assigned", refresh);
    source.addEventListener("task.due_soon", refresh);
    source.addEventListener("payment.received", refresh);
    source.addEventListener("stock.low", refresh);
    source.addEventListener("comment.created", refresh);
    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [load, sseUrl]);

  async function markRead(id: string) {
    await auth.api.request(`/notifications/${id}/read`, { method: "PATCH" });
    await load();
  }

  async function markAllRead() {
    await auth.api.request("/notifications/read-all", { method: "PATCH" });
    await load();
  }

  return (
    <div className="relative">
      <Button aria-label="Notifications" size="icon" type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99" : unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border bg-popover shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
            <div className="text-sm font-medium">Notifications</div>
            <Button disabled={unreadCount === 0} size="sm" type="button" variant="ghost" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4" />
              Read all
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications
              </div>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-sidebar-hover", !item.readAt && "bg-primary/10")}
                  onClick={() => void markRead(item.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant={item.type === "WARNING" ? "warning" : item.type === "SUCCESS" ? "success" : "secondary"}>{item.type}</Badge>
                  </div>
                  {item.body ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>
                </button>
              ))
            ) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
