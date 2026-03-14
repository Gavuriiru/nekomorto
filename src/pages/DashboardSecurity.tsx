import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import {
  dashboardAnimationDelay,
  dashboardClampedStaggerMs,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

type MeUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  accessRole?: string;
  grants?: Partial<Record<string, boolean>>;
};

type ActiveSessionRow = {
  sid: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  lastIp: string;
  userAgent: string;
  isPendingMfa: boolean;
  currentForViewer: boolean;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("pt-BR");
};

const userInitials = (name: string) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0] || "")
    .join("")
    .toUpperCase() || "??";

const SECURITY_CACHE_TTL_MS = 60_000;
const SECURITY_CACHE_MAX_ENTRIES = 5;

type SecuritySessionsCacheEntry = {
  sessions: ActiveSessionRow[];
  total: number;
  expiresAt: number;
};

const securitySessionsCache = new Map<string, SecuritySessionsCacheEntry>();

const buildSecurityCacheKey = (page: number, limit: number) => `${page}:${limit}`;

const readSecurityCache = (key: string) => {
  const cached = securitySessionsCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    securitySessionsCache.delete(key);
    return null;
  }
  securitySessionsCache.delete(key);
  securitySessionsCache.set(key, cached);
  return {
    sessions: [...cached.sessions],
    total: cached.total,
  };
};

const writeSecurityCache = (key: string, value: { sessions: ActiveSessionRow[]; total: number }) => {
  securitySessionsCache.delete(key);
  securitySessionsCache.set(key, {
    sessions: [...value.sessions],
    total: value.total,
    expiresAt: Date.now() + SECURITY_CACHE_TTL_MS,
  });
  while (securitySessionsCache.size > SECURITY_CACHE_MAX_ENTRIES) {
    const firstKey = securitySessionsCache.keys().next().value;
    if (!firstKey) {
      break;
    }
    securitySessionsCache.delete(firstKey);
  }
};

const clearSecurityCache = () => {
  securitySessionsCache.clear();
};

export const __testing = {
  clearSecurityCache,
};

const DashboardSecurity = () => {
  usePageMeta({ title: "Segurança", noIndex: true });

  const apiBase = getApiBase();
  const initialCacheKeyRef = useRef(buildSecurityCacheKey(1, 100));
  const initialCacheRef = useRef(readSecurityCache(initialCacheKeyRef.current));
  const { currentUser: me, isLoadingUser } = useDashboardCurrentUser<MeUser>();
  const [sessions, setSessions] = useState<ActiveSessionRow[]>(
    initialCacheRef.current?.sessions ?? [],
  );
  const [total, setTotal] = useState(initialCacheRef.current?.total ?? 0);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [loadError, setLoadError] = useState("");
  const [revokingSid, setRevokingSid] = useState<string | null>(null);
  const [pendingRevokeSession, setPendingRevokeSession] = useState<ActiveSessionRow | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(hasLoadedOnce);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  const pageCount = useMemo(() => {
    if (!total) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const load = useCallback(async (options?: { background?: boolean }) => {
    const cacheKey = buildSecurityCacheKey(page, limit);
    const cached = readSecurityCache(cacheKey);
    if (cached) {
      setSessions(cached.sessions);
      setTotal(cached.total);
      setHasLoadedOnce(true);
      setIsInitialLoading(false);
    }
    const background = options?.background ?? (hasLoadedOnceRef.current || Boolean(cached));
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }
    setLoadError("");
    try {
      const sessionsRes = await apiFetch(
        apiBase,
        "/api/admin/sessions/active?page=" + page + "&limit=" + limit,
        {
          auth: true,
        },
      );

      if (requestIdRef.current !== requestId) {
        return;
      }
      if (!sessionsRes.ok) {
        setLoadError("Nao foi possivel carregar a lista de sessoes ativas.");
        return;
      }
      const payload = await sessionsRes.json();
      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      const nextTotal = Number(payload.total || 0);
      setSessions(nextSessions);
      setTotal(nextTotal);
      setHasLoadedOnce(true);
      writeSecurityCache(cacheKey, {
        sessions: nextSessions,
        total: nextTotal,
      });
    } catch {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setLoadError("Nao foi possivel carregar a lista de sessoes ativas.");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [apiBase, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isInitialLoading || isRefreshing) {
      return;
    }
    if (page <= pageCount) {
      return;
    }
    setPage(pageCount);
  }, [isInitialLoading, isRefreshing, page, pageCount]);

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  const requestRevokeSession = useCallback(
    (session: ActiveSessionRow) => {
      const sid = String(session.sid || "").trim();
      const userId = String(session.userId || "").trim();
      if (!sid || !userId || session.currentForViewer) {
        return;
      }
      if (revokingSid) {
        return;
      }
      setPendingRevokeSession(session);
    },
    [revokingSid],
  );

  const cancelRevokeSession = useCallback(() => {
    if (revokingSid) {
      return;
    }
    setPendingRevokeSession(null);
  }, [revokingSid]);

  const confirmRevokeSession = useCallback(async () => {
    if (revokingSid) {
      return;
    }
    const session = pendingRevokeSession;
    if (!session) {
      return;
    }
    const sid = String(session.sid || "").trim();
    const userId = String(session.userId || "").trim();
    if (!sid || !userId || session.currentForViewer) {
      setPendingRevokeSession(null);
      return;
    }

    setRevokingSid(sid);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sid)}`,
        {
          method: "DELETE",
          auth: true,
        },
      );
      if (!response.ok) {
        toast({ title: "Falha ao encerrar sessão", variant: "destructive" });
        return;
      }
      toast({ title: "Sessão encerrada" });
      clearSecurityCache();
      await load({ background: true });
    } catch {
      toast({ title: "Falha ao encerrar sessão", variant: "destructive" });
    } finally {
      setRevokingSid(null);
      setPendingRevokeSession(null);
    }
  }, [apiBase, load, pendingRevokeSession, revokingSid]);

  const pendingDeviceSnippet = String(pendingRevokeSession?.userAgent || "")
    .trim()
    .slice(0, 120);
  const hasBlockingLoadError = !hasLoadedOnce && Boolean(loadError);
  const hasRetainedLoadError = hasLoadedOnce && Boolean(loadError);

  useDashboardRefreshToast({
    active: isRefreshing && hasLoadedOnce,
    title: "Atualizando sessoes",
    description: "Buscando a lista mais recente de sessoes ativas.",
  });

  return (
    <DashboardShell currentUser={me} isLoadingUser={isLoadingUser}>
      <main className="pt-24">
        <section className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-20 md:px-10 reveal" data-reveal>
          <header className="space-y-2">
            <DashboardPageBadge data-testid="dashboard-security-header-badge">
              Segurança
            </DashboardPageBadge>
            <h1 className="mt-4 text-3xl font-semibold animate-slide-up">Sessões Ativas</h1>
            <p
              className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
              style={dashboardAnimationDelay(dashboardMotionDelays.headerDescriptionMs)}
            >
              Painel somente leitura com sessões ativas e usuário responsável por cada sessão.
            </p>
          </header>

          <section
            className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
            style={dashboardAnimationDelay(dashboardMotionDelays.sectionLeadMs)}
            data-testid="dashboard-security-sessions-card"
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 animate-slide-up opacity-0"
              style={dashboardAnimationDelay(
                dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs,
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {isInitialLoading ? (
                  <>
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </>
                ) : (
                  <>
                    <Badge className="bg-card/80 text-muted-foreground">
                      Total ativo: {total}
                    </Badge>
                    <Badge className="bg-card/80 text-muted-foreground">
                      Página {page} de {pageCount}
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load({ background: true })}
                  disabled={isRefreshing}
                >
                  Atualizar
                </Button>
                {hasPrevious ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={isRefreshing}
                  >
                    Anterior
                  </Button>
                ) : null}
                {hasNext ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                    disabled={isRefreshing}
                  >
                    Próxima
                  </Button>
                ) : null}
              </div>
            </div>

            {hasRetainedLoadError ? (
              <Alert className="border-border/60 bg-background/50 text-muted-foreground">
                <AlertDescription>Mantendo as ultimas sessoes carregadas.</AlertDescription>
              </Alert>
            ) : null}

            {isInitialLoading ? (
              <div
                className="space-y-3 animate-slide-up opacity-0"
                style={dashboardAnimationDelay(
                  dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 2,
                )}
                data-testid="dashboard-security-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <article
                    key={`dashboard-security-loading-${index}`}
                    className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4"
                  >
                    <div className="flex flex-wrap items-start gap-3 md:flex-nowrap">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </article>
                ))}
                <span className="sr-only">Carregando sessões...</span>
              </div>
            ) : hasBlockingLoadError ? (
                <p
                  className="text-sm text-amber-300 animate-slide-up opacity-0"
                  style={dashboardAnimationDelay(
                    dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 2,
                  )}
                >
                  Não foi possível carregar a lista de sessões ativas.
                </p>
              ) : sessions.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={dashboardAnimationDelay(
                    dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 2,
                  )}
                >
                  Nenhuma sessão ativa encontrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session, index) => {
                    const isRevokingSession = revokingSid === session.sid;
                    const revokeButtonLabel = `${
                      isRevokingSession ? "Encerrando" : "Encerrar"
                    } sessao de ${session.userName || session.userId || "usuario"}`;

                    return (
                  <article
                    key={session.sid}
                    className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4 animate-slide-up opacity-0"
                    style={dashboardAnimationDelay(
                      dashboardClampedStaggerMs(index, dashboardMotionDelays.sectionLeadMs + 120),
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-3 md:flex-nowrap">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {session.userAvatarUrl ? (
                          <img
                            src={session.userAvatarUrl}
                            alt={session.userName}
                            className="h-10 w-10 rounded-full border border-border/60 object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-xs font-semibold text-muted-foreground">
                            {userInitials(session.userName)}
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <p className="break-words text-sm font-medium">{session.userName}</p>
                          <p className="break-all text-xs text-muted-foreground">ID: {session.userId}</p>
                        </div>
                      </div>
                      {session.sid && session.userId && !session.currentForViewer ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="order-2 h-9 w-9 shrink-0 px-0 md:order-3 md:w-auto md:px-3"
                          onClick={() => requestRevokeSession(session)}
                          disabled={Boolean(revokingSid)}
                          aria-label={revokeButtonLabel}
                          title={revokeButtonLabel}
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="hidden md:inline">
                            {isRevokingSession ? "Encerrando..." : "Encerrar"}
                          </span>
                        </Button>
                      ) : null}
                      <div className="order-3 flex basis-full flex-wrap gap-2 md:order-2 md:ml-auto md:basis-auto md:justify-end">
                        {session.currentForViewer ? (
                          <Badge variant="success">Sua sessão atual</Badge>
                        ) : null}
                        {session.isPendingMfa ? (
                          <Badge variant="warning">Pendente MFA</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                      <p>Criada em: {formatDateTime(session.createdAt)}</p>
                      <p>Última atividade: {formatDateTime(session.lastSeenAt)}</p>
                      <p>IP: {session.lastIp || "-"}</p>
                      <p className="truncate">User-Agent: {session.userAgent || "-"}</p>
                    </div>
                  </article>
                    );
                  })}
              </div>
            )}
          </section>
        </section>
      </main>
      <AlertDialog
        open={Boolean(pendingRevokeSession)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            cancelRevokeSession();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão ativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação encerra a sessão de{" "}
              {pendingRevokeSession?.userName || pendingRevokeSession?.userId || "-"}.
              <br />
              IP: {pendingRevokeSession?.lastIp || "-"}
              <br />
              Device: {pendingDeviceSnippet || "-"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(revokingSid)} onClick={cancelRevokeSession}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(revokingSid)}
              onClick={(event) => {
                event.preventDefault();
                void confirmRevokeSession();
              }}
            >
              {revokingSid ? "Encerrando..." : "Encerrar sessão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
};

export default DashboardSecurity;
