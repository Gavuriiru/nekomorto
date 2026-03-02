import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
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

const DashboardSecurity = () => {
  usePageMeta({ title: "Segurança", noIndex: true });

  const apiBase = getApiBase();
  const [me, setMe] = useState<MeUser | null>(null);
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [revokingSid, setRevokingSid] = useState<string | null>(null);
  const [pendingRevokeSession, setPendingRevokeSession] = useState<ActiveSessionRow | null>(null);

  const pageCount = useMemo(() => {
    if (!total) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [meRes, sessionsRes] = await Promise.all([
        apiFetch(apiBase, "/api/me", { auth: true }),
        apiFetch(apiBase, "/api/admin/sessions/active?page=" + page + "&limit=" + limit, {
          auth: true,
        }),
      ]);

      if (!meRes.ok) {
        setMe(null);
        setSessions([]);
        setTotal(0);
        setHasLoadError(true);
        return;
      }
      setMe(await meRes.json());

      if (!sessionsRes.ok) {
        setSessions([]);
        setTotal(0);
        setHasLoadError(true);
        return;
      }
      const payload = await sessionsRes.json();
      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      setSessions(nextSessions);
      setTotal(Number(payload.total || 0));
      setHasLoadError(false);
    } catch {
      setSessions([]);
      setTotal(0);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page <= pageCount) {
      return;
    }
    setPage(pageCount);
  }, [page, pageCount]);

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
      await load();
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

  return (
    <DashboardShell currentUser={me} isLoadingUser={isLoading}>
      <main className="pt-24">
        <section className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-20 md:px-10 reveal" data-reveal>
          <header className="space-y-2">
            <div
              className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in"
              data-testid="dashboard-security-header-badge"
            >
              Segurança
            </div>
            <h1 className="mt-4 text-3xl font-semibold animate-slide-up">Sessões Ativas</h1>
            <p
              className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              Painel somente leitura com sessões ativas e usuário responsável por cada sessão.
            </p>
          </header>

          <section
            className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
            style={{ animationDelay: "160ms" }}
            data-testid="dashboard-security-sessions-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-2 animate-slide-up opacity-0"
                style={{ animationDelay: "220ms" }}
              >
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </>
                ) : (
                  <>
                    <Badge className="bg-card/80 text-muted-foreground animate-fade-in">
                      Total ativo: {total}
                    </Badge>
                    <Badge className="bg-card/80 text-muted-foreground animate-fade-in">
                      Página {page} de {pageCount}
                    </Badge>
                  </>
                )}
              </div>
              <div
                className="flex items-center gap-2 animate-slide-up opacity-0"
                style={{ animationDelay: "260ms" }}
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={isLoading}
                >
                  Atualizar
                </Button>
                {hasPrevious ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={isLoading}
                  >
                    Anterior
                  </Button>
                ) : null}
                {hasNext ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                    disabled={isLoading}
                  >
                    Próxima
                  </Button>
                ) : null}
              </div>
            </div>

            {isLoading ? (
              <div
                className="space-y-3 animate-slide-up opacity-0"
                style={{ animationDelay: "300ms" }}
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
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
            ) : hasLoadError ? (
                <p
                  className="text-sm text-amber-300 animate-slide-up opacity-0"
                  style={{ animationDelay: "300ms" }}
                >
                  Não foi possível carregar a lista de sessões ativas.
                </p>
              ) : sessions.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "300ms" }}
                >
                  Nenhuma sessão ativa encontrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session, index) => (
                  <article
                    key={session.sid}
                    className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4 animate-slide-up opacity-0"
                    style={{ animationDelay: `${300 + index * 50}ms` }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
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
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{session.userName}</p>
                          <p className="text-xs text-muted-foreground">ID: {session.userId}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {session.currentForViewer ? (
                          <Badge variant="success">Sua sessão atual</Badge>
                        ) : null}
                        {session.isPendingMfa ? (
                          <Badge variant="warning">Pendente MFA</Badge>
                        ) : null}
                        {session.sid && session.userId && !session.currentForViewer ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestRevokeSession(session)}
                            disabled={Boolean(revokingSid)}
                          >
                            {revokingSid === session.sid ? "Encerrando..." : "Encerrar"}
                          </Button>
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
                ))}
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
