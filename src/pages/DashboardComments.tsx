import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Trash2, ExternalLink } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
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
import { toast } from "@/components/ui/use-toast";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";


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
  const [deleteTarget, setDeleteTarget] = useState<PendingComment | null>(null);
  const [pendingActionById, setPendingActionById] = useState<Record<string, "approve" | "delete">>({});
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

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
      }
    };

    loadUser();
  }, [apiBase]);

  const handleApprove = async (id: string) => {
    if (pendingActionById[id]) {
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

  return (
    <DashboardShell
      currentUser={currentUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="px-6 pb-20 pt-24 md:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground animate-slide-up">Comentários pendentes</h1>
                <p
                  className="text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "0.2s" }}
                >
                  Aprove ou exclua comentários enviados pelos visitantes.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs uppercase animate-fade-in">
                {comments.length} pendentes
              </Badge>
            </div>

            {isLoading ? (
              <AsyncState
                kind="loading"
                title="Carregando comentarios"
                description="Buscando a fila de moderacao."
              />
            ) : hasLoadError ? (
              <AsyncState
                kind="error"
                title="Nao foi possivel carregar os comentarios"
                description="Tente novamente em instantes."
                action={
                  <Button variant="outline" onClick={() => void loadComments()}>
                    Recarregar fila
                  </Button>
                }
              />
            ) : comments.length === 0 ? (
              <AsyncState
                kind="empty"
                title="Nenhum comentario pendente"
                description="A fila de moderacao esta em dia."
              />
            ) : (
              <div className="grid gap-4">
                {comments.map((comment, index) => (
                  <Card
                    key={comment.id}
                    className="border-border/60 bg-card/80 shadow-lg animate-slide-up opacity-0"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <CardContent className="space-y-4 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {comment.targetType}
                            </Badge>
                            <span>{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{comment.name}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{comment.content}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={Boolean(pendingActionById[comment.id])}
                            onClick={() => handleApprove(comment.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {pendingActionById[comment.id] === "approve" ? "Aprovando..." : "Aprovar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={Boolean(pendingActionById[comment.id])}
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
                      <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                        {comment.targetLabel}
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
    </DashboardShell>
  );
};

export default DashboardComments;
