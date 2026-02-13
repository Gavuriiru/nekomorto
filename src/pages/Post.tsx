import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock, User } from "lucide-react";

import DiscordInviteCard from "@/components/DiscordInviteCard";
import LatestEpisodeCard from "@/components/LatestEpisodeCard";
import WorkStatusCard from "@/components/WorkStatusCard";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import CommentsSection from "@/components/CommentsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { estimateReadTime } from "@/lib/post-content";
import LexicalViewer from "@/components/lexical/LexicalViewer";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { formatDateTime } from "@/lib/date";

const Post = () => {
  const { slug } = useParams();
  const apiBase = getApiBase();
  const [post, setPost] = useState<{
    id: string;
    title: string;
    slug: string;
    coverImageUrl?: string | null;
    coverAlt?: string | null;
    excerpt: string;
    content: string;
    contentFormat?: "lexical";
    author: string;
    publishedAt: string;
    views: number;
    commentsCount: number;
    seoTitle?: string | null;
    seoDescription?: string | null;
    projectId?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ permissions?: string[] } | null>(null);
  const trackedViewsRef = useRef<Set<string>>(new Set());
  const { settings } = useSiteSettings();

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch(apiBase, `/api/public/posts/${slug}`);
        if (!response.ok) {
          if (isActive) {
            setLoadError(true);
            setPost(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setPost(data.post);
          setLoadError(false);
        }
      } catch {
        if (isActive) {
          setLoadError(true);
          setPost(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    if (slug) {
      load();
    }

    return () => {
      isActive = false;
    };
  }, [apiBase, slug]);

  useEffect(() => {
    let isActive = true;
    const loadCurrentUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/me", { auth: true });
        if (!response.ok) {
          if (isActive) {
            setCurrentUser(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setCurrentUser(data?.user ?? null);
        }
      } catch {
        if (isActive) {
          setCurrentUser(null);
        }
      }
    };

    loadCurrentUser();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!post?.slug) {
      return;
    }
    if (trackedViewsRef.current.has(post.slug)) {
      return;
    }
    trackedViewsRef.current.add(post.slug);
    void apiFetch(apiBase, `/api/public/posts/${post.slug}/view`, { method: "POST" });
  }, [apiBase, post?.slug]);
  const shareImage = useMemo(
    () =>
      normalizeAssetUrl(post?.coverImageUrl) || normalizeAssetUrl(settings.site.defaultShareImage),
    [post?.coverImageUrl, settings.site.defaultShareImage],
  );

  usePageMeta({
    title: post?.seoTitle || post?.title || "Postagem",
    description: post?.seoDescription || post?.excerpt || "",
    image: shareImage,
    type: "article",
  });

  const formattedDate = useMemo(() => {
    if (!post?.publishedAt) {
      return "";
    }
    return formatDateTime(post.publishedAt)
  }, [post?.publishedAt]);

  const readTime = useMemo(() => {
    if (!post) {
      return "";
    }
    return estimateReadTime(post.content || "");
  }, [post]);
  const coverUrl = useMemo(() => normalizeAssetUrl(post?.coverImageUrl), [post?.coverImageUrl]);
  const canEditPost = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("posts");
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-background">

      <main className="px-6 pb-20 pt-14 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Carregando postagem...
            </div>
          ) : loadError || !post ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Postagem não encontrada.
            </div>
          ) : (
            <>
              <section className="space-y-6">
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold text-foreground md:text-4xl">{post.title}</h1>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        {post.author || "Autor"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        {formattedDate}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        {readTime}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="outline" className="text-xs uppercase tracking-wide">
                        Postagem
                      </Badge>
                      {canEditPost ? (
                        <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-[10px] uppercase">
                          <Link to={`/dashboard/posts?edit=${encodeURIComponent(post.id)}`}>
                            Editar postagem
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="relative aspect-3/2 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                  <img
                    src={coverUrl || "/placeholder.svg"}
                    alt={post.coverAlt || `Capa do post: ${post.title}`}
                    className="absolute inset-0 block h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </section>

              <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <article className="min-w-0 space-y-8">
                  <Card className="border-border bg-card shadow-xs">
                    <CardContent className="min-w-0 space-y-7 p-6 text-sm leading-relaxed text-muted-foreground">
                      <LexicalViewer
                        value={post.content || ""}
                        className="post-content reader-content min-w-0 w-full space-y-4 text-muted-foreground"
                        pollTarget={post?.slug ? { type: "post", slug: post.slug } : undefined}
                      />
                    </CardContent>
                  </Card>

                  {post.projectId ? <ProjectEmbedCard projectId={post.projectId} /> : null}

                  <CommentsSection targetType="post" targetId={post.slug} />
                </article>

                <aside className="min-w-0 space-y-6">
                  <LatestEpisodeCard />
                  <WorkStatusCard />
                  <DiscordInviteCard />
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Post;





