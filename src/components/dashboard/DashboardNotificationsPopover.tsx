import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2, CircleDot, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api-client";

type DashboardNotificationItem = {
  id: string;
  kind: "pending" | "error" | "approval";
  source: "comments" | "operations" | "webhooks";
  severity?: string;
  title: string;
  description?: string;
  href?: string;
  ts: string;
};

type DashboardNotificationsPayload = {
  generatedAt?: string;
  items?: DashboardNotificationItem[];
  summary?: {
    total?: number;
    pending?: number;
    error?: number;
    approval?: number;
  };
};

type UserPreferencesPayload = {
  preferences?: Record<string, unknown>;
};

type DashboardNotificationsPopoverProps = {
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const POLL_MS = 15_000;

const getNotificationIcon = (item: DashboardNotificationItem) => {
  if (item.kind === "error") {
    return AlertTriangle;
  }
  if (item.kind === "approval") {
    return CheckCircle2;
  }
  return Clock3;
};

const DashboardNotificationsPopover = ({
  apiBase,
  open,
  onOpenChange,
}: DashboardNotificationsPopoverProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<DashboardNotificationItem[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const preferencesRef = useRef<Record<string, unknown>>({});

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiFetch(apiBase, "/api/dashboard/notifications?limit=30", {
        auth: true,
        cache: "no-store",
      });
      if (!response.ok) {
        setItems([]);
        setSummaryTotal(0);
        return;
      }
      const payload = (await response.json()) as DashboardNotificationsPayload;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      const total = Number(payload?.summary?.total || 0);
      setSummaryTotal(Number.isFinite(total) ? total : nextItems.length);
    } catch {
      setItems([]);
      setSummaryTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  const loadPreferences = useCallback(async () => {
    try {
      const response = await apiFetch(apiBase, "/api/me/preferences", {
        auth: true,
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as UserPreferencesPayload;
      preferencesRef.current =
        payload?.preferences && typeof payload.preferences === "object" ? payload.preferences : {};
    } catch {
      preferencesRef.current = {};
    }
  }, [apiBase]);

  const persistLastSeen = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const prefs = preferencesRef.current;
    const dashboard =
      prefs?.dashboard && typeof prefs.dashboard === "object"
        ? (prefs.dashboard as Record<string, unknown>)
        : {};
    const notifications =
      dashboard.notifications && typeof dashboard.notifications === "object"
        ? (dashboard.notifications as Record<string, unknown>)
        : {};
    const nextPreferences = {
      ...prefs,
      dashboard: {
        ...dashboard,
        notifications: {
          ...notifications,
          lastSeenAt: nowIso,
        },
      },
    };
    preferencesRef.current = nextPreferences;
    try {
      await apiFetch(apiBase, "/api/me/preferences", {
        method: "PUT",
        auth: true,
        json: { preferences: nextPreferences },
      });
    } catch {
      // ignore transient preference write failures
    }
  }, [apiBase]);

  useEffect(() => {
    setIsLoading(true);
    void Promise.all([loadNotifications(), loadPreferences()]);
  }, [loadNotifications, loadPreferences]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadNotifications();
    void persistLastSeen();
  }, [loadNotifications, open, persistLastSeen]);

  const badgeLabel = useMemo(() => {
    if (summaryTotal <= 0) {
      return "";
    }
    if (summaryTotal > 99) {
      return "99+";
    }
    return String(summaryTotal);
  }, [summaryTotal]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground"
          aria-label="Abrir notificações"
        >
          <Bell className="h-4 w-4" />
          {badgeLabel ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(30rem,calc(100vw-1rem))] p-0">
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold">Notificações operacionais</p>
          <p className="text-xs text-muted-foreground">Atualização automática a cada 15s.</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-3 py-2">
          {isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Carregando notificações...</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma pendência operacional no momento.</p>
          ) : (
            items.map((item) => {
              const ItemIcon = getNotificationIcon(item);
              return (
                <Link
                  key={item.id}
                  to={item.href || "/dashboard"}
                  className="mb-2 block rounded-xl border border-border/60 bg-card/60 p-3 transition hover:border-primary/35 hover:bg-primary/5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-full bg-card/90 p-1.5">
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                          {item.kind}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.description || "Sem descrição"}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CircleDot className="h-3 w-3" />
                        {new Date(item.ts || "").toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DashboardNotificationsPopover;

