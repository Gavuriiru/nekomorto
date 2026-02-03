import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Reply } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";

type CommentTargetType = "post" | "project" | "chapter";

type PublicComment = {
  id: string;
  parentId?: string | null;
  name: string;
  content: string;
  createdAt: string;
  avatarUrl?: string;
};

type CommentNode = PublicComment & { replies: CommentNode[] };

type CommentsSectionProps = {
  targetType: CommentTargetType;
  targetId: string;
  chapterNumber?: number;
  volume?: number;
};

const buildCommentTree = (comments: PublicComment[]) => {
  const map = new Map<string, CommentNode>();
  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] });
  });
  const roots: CommentNode[] = [];
  map.forEach((comment) => {
    if (comment.parentId && map.has(comment.parentId)) {
      map.get(comment.parentId)?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });
  const sortByDate = (items: CommentNode[]) => {
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    items.forEach((item) => sortByDate(item.replies));
  };
  sortByDate(roots);
  return roots;
};

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

const CommentsSection = ({ targetType, targetId, chapterNumber, volume }: CommentsSectionProps) => {
  const apiBase = getApiBase();
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [replyTo, setReplyTo] = useState<PublicComment | null>(null);
  const [form, setForm] = useState({ name: "", email: "", content: "", website: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email?: string; permissions?: string[] } | null>(
    null,
  );
  const [canModerate, setCanModerate] = useState(false);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const location = useLocation();
  const lastScrolledRef = useRef<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        type: targetType,
        id: targetId,
      });
      if (targetType === "chapter" && Number.isFinite(chapterNumber)) {
        params.set("chapter", String(chapterNumber));
        if (Number.isFinite(volume)) {
          params.set("volume", String(volume));
        }
      }
      const response = await apiFetch(apiBase, `/api/public/comments?${params.toString()}`);
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
  }, [apiBase, chapterNumber, targetId, targetType, volume]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    const hash = location.hash || "";
    if (!hash.startsWith("#comment-")) {
      return;
    }
    if (lastScrolledRef.current === hash) {
      return;
    }
    const id = hash.slice(1);
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    lastScrolledRef.current = hash;
  }, [comments, location.hash]);

  useEffect(() => {
    let isActive = true;
    const loadMe = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/me", { auth: true });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const user = data?.user ?? data;
        if (!user) {
          return;
        }
        if (!isActive) {
          return;
        }
        const permissions = Array.isArray(user.permissions) ? user.permissions : [];
        const moderator =
          permissions.includes("*") ||
          permissions.includes("comentarios") ||
          permissions.includes("posts") ||
          permissions.includes("projetos");
        setCurrentUser({ name: user.name || "", email: user.email || "", permissions });
        setCanModerate(moderator);
        if (moderator) {
          setForm((prev) => ({
            ...prev,
            name: user.name || prev.name,
            email: user.email || prev.email,
          }));
        }
      } catch {
        // ignore
      }
    };
    void loadMe();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.content.trim()) {
      setNotice("Preencha nome, e-mail e comentário.");
      return;
    }
    setIsSubmitting(true);
    setNotice("");
    try {
      const payload: Record<string, string | number> = {
        targetType,
        targetId,
        name: form.name.trim(),
        email: form.email.trim(),
        content: form.content.trim(),
      };
      if (replyTo) {
        payload.parentId = replyTo.id;
      }
      if (form.website) {
        payload.website = form.website;
      }
      if (targetType === "chapter" && Number.isFinite(chapterNumber)) {
        payload.chapterNumber = Number(chapterNumber);
        if (Number.isFinite(volume)) {
          payload.volume = Number(volume);
        }
      }
      const response = await apiFetch(apiBase, "/api/public/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setNotice("Não foi possível enviar o comentário. Tente novamente.");
        return;
      }
      setForm({ name: "", email: "", content: "", website: "" });
      setReplyTo(null);
      setNotice("Comentário enviado! Ele ficará visível após aprovação.");
    } catch {
      setNotice("Não foi possível enviar o comentário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
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

  const renderComment = (comment: CommentNode, depth = 0) => (
    <div
      key={comment.id}
      id={`comment-${comment.id}`}
      className={depth > 0 ? "pl-6 border-l border-border/40" : ""}
    >
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          {comment.avatarUrl ? <AvatarImage src={comment.avatarUrl} alt={comment.name} /> : null}
          <AvatarFallback>{initialsFromName(comment.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">{comment.name}</span>
            <span>{formatDateTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{comment.content}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 text-xs"
              onClick={() => setReplyTo(comment)}
            >
              <Reply className="mr-1 h-3 w-3" />
              Responder
            </Button>
            {canModerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-2 text-xs text-red-400"
                onClick={() => handleDelete(comment.id)}
              >
                Excluir
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      ) : null}
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg">Comentários</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {canModerate
              ? "Como staff, seus comentários aparecem imediatamente."
              : "Os comentários passam por aprovação antes de aparecerem."}
          </div>
          <span className="text-xs text-muted-foreground">
            Avatar via Gravatar (baseado no e-mail).
          </span>
        </div>
        <Separator />
        <div className="space-y-3">
          {replyTo ? (
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              Respondendo a <span className="font-semibold text-foreground">{replyTo.name}</span>.
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-2 h-auto px-2 text-xs"
                onClick={() => setReplyTo(null)}
              >
                Cancelar
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Seu nome"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              disabled={canModerate}
            />
            <Input
              type="email"
              placeholder="Seu e-mail (usado para o Gravatar)"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              disabled={canModerate}
            />
          </div>
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
            aria-hidden="true"
          />
          <Textarea
            placeholder="Escreva seu comentário"
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            className="min-h-[120px]"
          />
          {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Publicar comentário"}
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            Carregando comentários...
          </div>
        ) : commentTree.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            Ainda não há comentários aprovados.
          </div>
        ) : (
        <div className="space-y-6">{commentTree.map((comment) => renderComment(comment))}</div>
        )}
      </CardContent>
    </Card>
  );
};

export default CommentsSection;


