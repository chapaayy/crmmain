"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-url";
import { useDismissibleLayer } from "@/lib/use-dismissible-layer";
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
  const [loaded, setLoaded] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const sseUrl = useMemo(() => {
    if (!realtimeReady || !apiBaseUrl || !auth.accessToken) {
      return "";
    }

    return `${apiBaseUrl.replace(/\/$/, "")}/realtime/events?token=${encodeURIComponent(auth.accessToken)}`;
  }, [apiBaseUrl, auth.accessToken, realtimeReady]);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<NotificationsResponse>("/notifications?limit=10");
      setItems(response.data);
      setUnreadCount(response.unreadCount);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status]);

  const close = useCallback(() => setOpen(false), []);

  useDismissibleLayer({
    open,
    onDismiss: close,
    refs: [triggerRef, panelRef]
  });

  useEffect(() => {
    if (auth.status !== "authenticated") {
      setItems([]);
      setUnreadCount(0);
      setLoaded(false);
      setOpen(false);
      return;
    }

    const initialTimer = window.setTimeout(() => void load(), 1800);
    const timer = window.setInterval(() => void load(), 30_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [auth.status, load]);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      setRealtimeReady(false);
      return;
    }

    const timer = window.setTimeout(() => setRealtimeReady(true), 2500);

    return () => window.clearTimeout(timer);
  }, [auth.status]);

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
    if (auth.status !== "authenticated") {
      return;
    }

    await auth.api.request(`/notifications/${id}/read`, { method: "PATCH" });
    await load();
  }

  async function markAllRead() {
    if (auth.status !== "authenticated") {
      return;
    }

    await auth.api.request("/notifications/read-all", { method: "PATCH" });
    await load();
  }

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          setOpen((value) => !value);

          if (!loaded && !loading) {
            void load();
          }
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99" : unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div ref={panelRef} className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-popover/95 shadow-panel backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
            <div className="text-sm font-medium">Уведомления</div>
            <Button disabled={unreadCount === 0} size="sm" type="button" variant="ghost" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4" />
              Прочитать все
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загружаем уведомления
              </div>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn("block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-hover", !item.readAt && "bg-primary/10")}
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
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Уведомлений нет</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
