import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Trash2, ExternalLink, Loader2 } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import {
  dashboardAnimationDelay,
  dashboardClampedStaggerMs,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
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
import AsyncState from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";
import { cn } from "@/lib/utils";

type PendingComment = {
  id: string;
  targetType: string;
  targetId: string;
  parentId?: string | null;
  name: string;
  content: string;
  createdAt: string;
  avatarUrl?: string;
  targetLabel: string;
  targetUrl: string;
};

type CommentsBulkAction = "approve_all" | "delete_all";

type CommentsBulkModerationResult = {
  ok: true;
  action: CommentsBulkAction;
  totalPendingBefore: number;
  processedCount: number;
  remainingPending: number;
};

const BULK_DELETE_CONFIRM_TEXT = "EXCLUIR";

const COMMENT_TARGET_TYPE_LABELS: Record<string, string> = {
  post: "POST",
  project: "PROJETO",
  chapter: "CAPÍTULO",
};

const getCommentTargetTypeLabel = (targetType: string) => {
  const normalizedTargetType = String(targetType || "")
    .trim()
    .toLowerCase();
  if (!normalizedTargetType) {
    return "ITEM";
  }
  return COMMENT_TARGET_TYPE_LABELS[normalizedTargetType] || normalizedTargetType.toUpperCase();
};

const DashboardComments = () => {
  usePageMeta({ title: "Comentários", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PendingComment | null>(null);
  const [pendingActionById, setPendingActionById] = useState<Record<string, "approve" | "delete">>(
    {},
  );
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<CommentsBulkAction | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasLoadError(false);
      const response = await apiFetch(apiBase, "/api/comments/pending", { auth: true });
      if (!response.ok) {
        setComments([]);
        setHasLoadError(true);
        return;
      }
      const data = await response.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setHasLoadError(false);
    } catch {
      setComments([]);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    const loadUser = async () => {
      setIsLoadingUser(true);
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    void loadUser();
  }, [apiBase]);

  const handleApprove = async (id: string) => {
    if (pendingActionById[id] || isBulkActionLoading) {
      return;
    }
    setPendingActionById((prev) => ({ ...prev, [id]: "approve" }));
    try {
      const response = await apiFetch(apiBase, `/api/comments/${id}/approve`, {
        method: "POST",
        auth: true,
      });
      if (response.ok) {
        setComments((prev) => prev.filter((comment) => comment.id !== id));
        toast({
          title: "Comentário aprovado",
          description: "O comentário já está visível publicamente.",
          intent: "success",
        });
      } else {
        toast({
          title: "Não foi possível aprovar o comentário",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Não foi possível aprovar o comentário",
        variant: "destructive",
      });
    } finally {
      setPendingActionById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDelete = (comment: PendingComment) => {
    setDeleteTarget(comment);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleteConfirmLoading) {
      return;
    }
    const id = deleteTarget.id;
    setPendingActionById((prev) => ({ ...prev, [id]: "delete" }));
    setIsDeleteConfirmLoading(true);
    try {
      const response = await apiFetch(apiBase, `/api/comments/${id}`, {
        method: "DELETE",
        auth: true,
      });
      if (response.ok) {
        setComments((prev) => prev.filter((comment) => comment.id !== id));
        toast({
          title: "Comentário excluído",
          description: "O comentário foi removido da moderação.",
          intent: "success",
        });
        setDeleteTarget(null);
      } else {
        toast({
          title: "Não foi possível excluir o comentário",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Não foi possível excluir o comentário",
        variant: "destructive",
      });
    } finally {
      setPendingActionById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setIsDeleteConfirmLoading(false);
    }
  };

  const runBulkModeration = useCallback(
    async (action: CommentsBulkAction, confirmText?: string) => {
      if (isBulkActionLoading) {
        return;
      }
      setIsBulkActionLoading(true);
      setBulkActionType(action);
      try {
        const response = await apiFetch(apiBase, "/api/comments/pending/bulk", {
          method: "POST",
          auth: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            ...(action === "delete_all" ? { confirmText } : {}),
          }),
        });

        if (!response.ok) {
          toast({
            title:
              action === "approve_all"
                ? "Não foi possível aprovar todos os comentários"
                : "Não foi possível excluir todos os comentários",
            variant: "destructive",
          });
          return;
        }

        const data = (await response.json()) as CommentsBulkModerationResult;
        const processedCount = Number(data.processedCount) || 0;
        setComments([]);
        toast({
          title: action === "approve_all" ? "Comentários aprovados" : "Comentários excluídos",
          description:
            processedCount === 1
              ? action === "approve_all"
                ? "1 comentário foi aprovado."
                : "1 comentário foi excluído."
              : action === "approve_all"
                ? `${processedCount} comentários foram aprovados.`
                : `${processedCount} comentários foram excluídos.`,
          intent: "success",
        });
      } catch {
        toast({
          title:
            action === "approve_all"
              ? "Não foi possível aprovar todos os comentários"
              : "Não foi possível excluir todos os comentários",
          variant: "destructive",
        });
      } finally {
        setIsBulkActionLoading(false);
        setBulkActionType(null);
      }
    },
    [apiBase, isBulkActionLoading],
  );

  const handleApproveAll = useCallback(async () => {
    await runBulkModeration("approve_all");
  }, [runBulkModeration]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (bulkDeleteConfirmText !== BULK_DELETE_CONFIRM_TEXT) {
      return;
    }
    await runBulkModeration("delete_all", bulkDeleteConfirmText);
    setIsBulkDeleteConfirmOpen(false);
    setBulkDeleteConfirmText("");
  }, [bulkDeleteConfirmText, runBulkModeration]);

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="px-6 pb-20 pt-24 md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 reveal" data-reveal>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DashboardPageBadge data-testid="dashboard-comments-header-badge">
                Comentários
              </DashboardPageBadge>
              <h1 className="mt-4 text-2xl font-semibold text-foreground animate-slide-up">
                Comentários pendentes
              </h1>
              <p
                className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                style={dashboardAnimationDelay(dashboardMotionDelays.headerDescriptionMs)}
              >
                Aprove ou exclua comentários enviados pelos visitantes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isLoading && comments.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-2 animate-slide-up opacity-0"
                  style={dashboardAnimationDelay(dashboardMotionDelays.headerActionsMs)}
                  data-testid="dashboard-comments-bulk-actions"
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isBulkActionLoading}
                    onClick={() => void handleApproveAll()}
                  >
                    <span className="relative inline-grid h-5 items-center justify-items-center">
                      <span
                        className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        aria-hidden="true"
                      >
                        Aprovar todos
                      </span>
                      <span
                        className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        aria-hidden="true"
                      >
                        <Loader2 className="h-4 w-4" />
                        Aprovando...
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-150",
                          isBulkActionLoading && bulkActionType === "approve_all"
                            ? "opacity-0"
                            : "opacity-100",
                        )}
                        aria-hidden={isBulkActionLoading && bulkActionType === "approve_all"}
                      >
                        Aprovar todos
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-150",
                          isBulkActionLoading && bulkActionType === "approve_all"
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                        aria-hidden={!(isBulkActionLoading && bulkActionType === "approve_all")}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Aprovando...
                      </span>
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isBulkActionLoading}
                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                  >
                    <span className="relative inline-grid h-5 items-center justify-items-center">
                      <span
                        className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        aria-hidden="true"
                      >
                        Excluir todos
                      </span>
                      <span
                        className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
                        aria-hidden="true"
                      >
                        <Loader2 className="h-4 w-4" />
                        Excluindo...
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-150",
                          isBulkActionLoading && bulkActionType === "delete_all"
                            ? "opacity-0"
                            : "opacity-100",
                        )}
                        aria-hidden={isBulkActionLoading && bulkActionType === "delete_all"}
                      >
                        Excluir todos
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-150",
                          isBulkActionLoading && bulkActionType === "delete_all"
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                        aria-hidden={!(isBulkActionLoading && bulkActionType === "delete_all")}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Excluindo...
                      </span>
                    </span>
                  </Button>
                </div>
              ) : null}
              <Badge
                variant="secondary"
                className="text-xs uppercase animate-fade-in"
                style={dashboardAnimationDelay(dashboardMotionDelays.headerMetaMs)}
                data-testid="dashboard-comments-pending-count-badge"
              >
                {comments.length} pendentes
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <AsyncState
              kind="loading"
              title="Carregando comentários"
              description="Buscando a fila de moderação."
            />
          ) : hasLoadError ? (
            <AsyncState
              kind="error"
              title="Não foi possível carregar os comentários"
              description="Tente novamente em alguns instantes."
              action={
                <Button variant="outline" onClick={() => void loadComments()}>
                  Recarregar fila
                </Button>
              }
            />
          ) : comments.length === 0 ? (
            <AsyncState
              kind="empty"
              title="Nenhum comentário pendente"
              description="A fila de moderação está em dia."
            />
          ) : (
            <div className="grid gap-4">
              {comments.map((comment, index) => (
                <Card
                  key={comment.id}
                  className="border-border/60 bg-card/80 shadow-lg animate-slide-up opacity-0"
                  style={dashboardAnimationDelay(dashboardClampedStaggerMs(index))}
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                            {getCommentTargetTypeLabel(comment.targetType)}
                          </Badge>
                          <span className="min-w-0 truncate" title={comment.targetLabel}>
                            {comment.targetLabel}
                          </span>
                          <span className="ml-auto shrink-0 whitespace-nowrap">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{comment.name}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {comment.content}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={Boolean(pendingActionById[comment.id]) || isBulkActionLoading}
                          onClick={() => handleApprove(comment.id)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {pendingActionById[comment.id] === "approve" ? "Aprovando..." : "Aprovar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(pendingActionById[comment.id]) || isBulkActionLoading}
                          onClick={() => handleDelete(comment)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {pendingActionById[comment.id] === "delete" ? "Excluindo..." : "Excluir"}
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={comment.targetUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ver página
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleteConfirmLoading) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o comentário permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleteConfirmLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleteConfirmLoading}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeleteConfirmLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isBulkDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (isBulkActionLoading) {
            return;
          }
          setIsBulkDeleteConfirmOpen(open);
          if (!open) {
            setBulkDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todos os comentários pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente todos os comentários pendentes da fila. Digite
              EXCLUIR para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Pendentes na fila:{" "}
              <span className="font-semibold text-foreground">{comments.length}</span>
            </p>
            <Input
              value={bulkDeleteConfirmText}
              onChange={(event) => setBulkDeleteConfirmText(event.target.value)}
              placeholder="Digite EXCLUIR"
              disabled={isBulkActionLoading}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBulkActionLoading || bulkDeleteConfirmText !== BULK_DELETE_CONFIRM_TEXT}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmBulkDelete();
              }}
            >
              {isBulkActionLoading && bulkActionType === "delete_all"
                ? "Excluindo..."
                : "Excluir todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
};

export default DashboardComments;
