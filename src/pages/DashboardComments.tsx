import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Trash2, ExternalLink } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch(apiBase, "/api/comments/pending", { auth: true });
      if (!response.ok) {
        setComments([]);
        return;
      }
      const data = await response.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
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
    const response = await apiFetch(apiBase, `/api/comments/${id}/approve`, {
      method: "POST",
      auth: true,
    });
    if (response.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== id));
    }
  };

  const handleDelete = async (id: string) => {
    const response = await apiFetch(apiBase, `/api/comments/${id}`, {
      method: "DELETE",
      auth: true,
    });
    if (response.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== id));
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
              <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
                Carregando comentários...
              </div>
            ) : comments.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground animate-slide-up opacity-0"
                style={{ animationDelay: "120ms" }}
              >
                Nenhum comentário aguardando aprovação.
              </div>
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
                            onClick={() => handleApprove(comment.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(comment.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
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
    </DashboardShell>
  );
};

export default DashboardComments;
