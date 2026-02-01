import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MessageSquare, Share2, User } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DiscordInviteCard from "@/components/DiscordInviteCard";
import LatestEpisodeCard from "@/components/LatestEpisodeCard";
import WorkStatusCard from "@/components/WorkStatusCard";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { estimateReadTime, renderPostContent } from "@/lib/post-content";

const Post = () => {
  const { slug } = useParams();
  const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080";
  const [post, setPost] = useState<{
    id: string;
    title: string;
    slug: string;
    coverImageUrl?: string | null;
    coverAlt?: string | null;
    excerpt: string;
    content: string;
    contentFormat: "markdown" | "html";
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

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiBase}/api/public/posts/${slug}`);
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
    if (!post) {
      return;
    }
    const title = post.seoTitle || post.title;
    document.title = `${title} | Nekomata`;
    const description = post.seoDescription || post.excerpt || "";
    let meta = document.querySelector("meta[name=description]") as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [post]);

  const formattedDate = useMemo(() => {
    if (!post?.publishedAt) {
      return "";
    }
    return new Date(post.publishedAt).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [post?.publishedAt]);

  const readTime = useMemo(() => {
    if (!post) {
      return "";
    }
    return estimateReadTime(post.content || post.excerpt, post.contentFormat || "markdown");
  }, [post]);

  const htmlContent = useMemo(() => {
    if (!post) {
      return "";
    }
    return renderPostContent(post.content || post.excerpt, post.contentFormat || "markdown");
  }, [post]);

  const handleCopyLink = async () => {
    if (!post) {
      return;
    }
    const url = `${window.location.origin}/postagem/${post.slug}`;
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-6 pb-20 pt-14 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Carregando postagem...
            </div>
          ) : loadError || !post ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Postagem nÃ£o encontrada.
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
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <img
                    src={post.coverImageUrl || "/placeholder.svg"}
                    alt={post.coverAlt || `Capa do post: ${post.title}`}
                    className="aspect-[3/2] w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </section>

              <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <article className="space-y-8">
                  <Card className="border-border bg-card shadow-sm">
                    <CardContent className="space-y-7 p-6 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt ? (
                        <p className="text-base text-muted-foreground">{post.excerpt}</p>
                      ) : null}
                      <div
                        className="post-content space-y-4 text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                      />
                    </CardContent>
                  </Card>

                  {post.projectId ? <ProjectEmbedCard projectId={post.projectId} /> : null}

                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Compartilhar</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Share2 className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        Envie este post nas redes sociais.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                          Copiar link
                        </Button>
                        <Button size="sm" variant="outline">
                          Compartilhar no X
                        </Button>
                        <Button size="sm" variant="outline">
                          Compartilhar no Discord
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-lg">ComentÃ¡rios</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="h-4 w-4 text-primary/70" aria-hidden="true" />
                          SeÃ§Ã£o integrada ou via Disqus.
                        </div>
                        <Button size="sm" variant="outline">
                          Conectar Disqus
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="/placeholder.svg" alt="Avatar do usuÃ¡rio" />
                          <AvatarFallback>RA</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <Textarea
                            placeholder="Escreva um comentÃ¡rio ou feedback sobre o episÃ³dio..."
                            className="min-h-[120px]"
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <Button>Publicar comentÃ¡rio</Button>
                            <Button variant="ghost" size="sm">
                              Ver regras da comunidade
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        Aqui aparecerÃ¡ a thread de comentÃ¡rios com paginaÃ§Ã£o, reaÃ§Ãµes e moderaÃ§Ã£o.
                      </div>
                    </CardContent>
                  </Card>
                </article>

                <aside className="space-y-6">
                  <LatestEpisodeCard />
                  <WorkStatusCard />
                  <DiscordInviteCard />
                </aside>
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Post;

