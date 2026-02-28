import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock, User } from "lucide-react";

import DiscordInviteCard from "@/components/DiscordInviteCard";
import LatestEpisodeCard from "@/components/LatestEpisodeCard";
import WorkStatusCard from "@/components/WorkStatusCard";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import CommentsSection from "@/components/CommentsSection";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { estimateReadTime } from "@/lib/post-content";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { formatDateTime } from "@/lib/date";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

const LexicalViewer = lazy(() => import("@/components/lexical/LexicalViewer"));

const LexicalViewerFallback = () => (
  <div className="min-h-[320px] w-full rounded-xl border border-border/60 bg-background/60 p-6 text-sm text-muted-foreground">
    Carregando conteúdo...
  </div>
);

const Post = () => {
  const { slug } = useParams();
  const apiBase = getApiBase();
  const [post, setPost] = useState<{
    id: string;
    title: string;
    slug: string;
    coverImageUrl?: string | null;
    coverAlt?: string | null;
    seoImageUrl?: string | null;
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
  const [mediaVariants, setMediaVariants] = useState<UploadMediaVariantsMap>({});
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
            setMediaVariants({});
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setPost(data.post);
          setMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
          setLoadError(false);
        }
      } catch {
        if (isActive) {
          setLoadError(true);
          setPost(null);
          setMediaVariants({});
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
      normalizeAssetUrl(post?.seoImageUrl) ||
      normalizeAssetUrl(post?.coverImageUrl) ||
      normalizeAssetUrl(settings.site.defaultShareImage),
    [post?.seoImageUrl, post?.coverImageUrl, settings.site.defaultShareImage],
  );

  usePageMeta({
    title: post?.seoTitle || post?.title || "Postagem",
    description: post?.seoDescription || post?.excerpt || "",
    image: shareImage,
    imageAlt: post?.coverAlt || settings.site.defaultShareImageAlt || undefined,
    type: "article",
  });

  const formattedDate = useMemo(() => {
    if (!post?.publishedAt) {
      return "";
    }
    return formatDateTime(post.publishedAt);
  }, [post?.publishedAt]);

  const readTime = useMemo(() => {
    if (!post) {
      return "";
    }
    return estimateReadTime(post.content || "");
  }, [post]);

  const canEditPost = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("posts");
  }, [currentUser]);

  const heroCoverSrc = post?.coverImageUrl || post?.seoImageUrl || "/placeholder.svg";
  const heroCoverAlt = post?.coverAlt || `Capa do post: ${post?.title || ""}`;

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        {isLoading ? (
          <div
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl rounded-2xl border border-border/60 py-10 pt-20 text-sm text-muted-foreground bg-card/60`}
          >
            Carregando postagem...
          </div>
        ) : loadError || !post ? (
          <div
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl rounded-2xl border border-dashed border-border/60 py-10 pt-20 text-sm text-muted-foreground bg-card/60`}
          >
            Postagem não encontrada.
          </div>
        ) : (
          <>
            <section data-testid="post-reader-hero" className="relative overflow-hidden">
              <UploadPicture
                src={heroCoverSrc}
                alt=""
                preset="hero"
                mediaVariants={mediaVariants}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover object-top md:object-[center_18%]"
                loading="eager"
                decoding="async"
                {...({ fetchpriority: "high" } as Record<string, string>)}
              />
              <div className="absolute inset-0 bg-background/28 backdrop-blur-[1.5px]" />
              <div className="absolute inset-0 bg-linear-to-r from-background/84 via-background/34 to-background/78" />
              <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-transparent" />

              <div
                className={`${publicPageLayoutTokens.sectionBase} relative max-w-6xl pb-10 pt-24 md:pb-32 md:pt-20 lg:pb-36 lg:pt-24`}
              >
                <div data-testid="post-reader-hero-layout" className="grid items-start gap-8">
                  <div
                    data-testid="post-reader-hero-info"
                    className="flex flex-col items-center gap-4 text-center md:items-start md:text-left"
                  >
                    <h1 className="text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
                      {post.title}
                    </h1>
                    <div className="flex w-full flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground md:justify-start">
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
                    <div className="flex w-full flex-wrap justify-center gap-2 md:justify-start">
                      <Badge variant="outline" className="text-xs uppercase tracking-wide">
                        Postagem
                      </Badge>
                      {canEditPost ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[10px] uppercase"
                        >
                          <Link to={`/dashboard/posts?edit=${encodeURIComponent(post.id)}`}>
                            Editar postagem
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              data-testid="post-reader-cover-bridge"
              className={`${publicPageLayoutTokens.sectionBase} relative z-20 -mt-24 hidden max-w-6xl md:block md:-mt-28`}
            >
              <div data-testid="post-reader-cover-shell" className="w-full">
                <div
                  data-testid="post-reader-cover-frame"
                  className="relative aspect-3/2 overflow-hidden rounded-2xl border border-border/80 bg-card/40 shadow-[0_42px_120px_-48px_rgba(0,0,0,0.95)]"
                >
                  <UploadPicture
                    src={heroCoverSrc}
                    alt={heroCoverAlt}
                    preset="hero"
                    mediaVariants={mediaVariants}
                    className="absolute inset-0 block h-full w-full"
                    imgClassName="absolute inset-0 block h-full w-full object-cover object-top"
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                  />
                </div>
              </div>
            </section>

            <section
              className={`${publicPageLayoutTokens.sectionBase} relative z-10 max-w-6xl pb-12 pt-4 md:pt-10`}
            >
              <section
                data-testid="post-reader-layout"
                className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]"
              >
                <article data-testid="post-reader-main" className="min-w-0 space-y-8">
                  <Card className="border-border/60 bg-card/85 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.75)]">
                    <CardContent className="min-w-0 space-y-7 p-6 text-sm leading-relaxed text-muted-foreground md:p-8">
                      <Suspense fallback={<LexicalViewerFallback />}>
                        <LexicalViewer
                          value={post.content || ""}
                          className="post-content reader-content min-w-0 w-full space-y-4 text-muted-foreground leading-relaxed md:text-base"
                          pollTarget={post?.slug ? { type: "post", slug: post.slug } : undefined}
                        />
                      </Suspense>
                    </CardContent>
                  </Card>

                  {post.projectId ? <ProjectEmbedCard projectId={post.projectId} /> : null}

                  <CommentsSection targetType="post" targetId={post.slug} />
                </article>

                <aside
                  data-testid="post-reader-sidebar"
                  className="min-w-0 space-y-6 self-start lg:sticky lg:top-24"
                >
                  <LatestEpisodeCard />
                  <WorkStatusCard />
                  <DiscordInviteCard />
                </aside>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Post;
