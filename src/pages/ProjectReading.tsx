import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronLeft } from "lucide-react";

import CommentsSection from "@/components/CommentsSection";
import DiscordInviteCard from "@/components/DiscordInviteCard";
import LatestEpisodeCard from "@/components/LatestEpisodeCard";
import WorkStatusCard from "@/components/WorkStatusCard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { isLightNovelType } from "@/lib/project-utils";
import type { Project } from "@/data/projects";
import NotFound from "./NotFound";

const LexicalViewer = lazy(() => import("@/components/lexical/LexicalViewer"));

const LexicalViewerFallback = () => (
  <div className="min-h-[320px] w-full rounded-xl border border-border/60 bg-background/60 p-6 text-sm text-muted-foreground">
    Carregando conteúdo...
  </div>
);

const ProjectReading = () => {
  const { slug, chapter } = useParams<{ slug: string; chapter: string }>();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const [project, setProject] = useState<Project | null>(null);
  const [chapterContent, setChapterContent] = useState<{
    number: number;
    volume?: number;
    title?: string;
    synopsis?: string;
    content?: string;
    contentFormat?: "lexical";
  } | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const trackedChapterViewsRef = useRef<Set<string>>(new Set());

  const pageTitle = useMemo(() => {
    if (!project) {
      return "Leitura";
    }
    const chapterNumber = chapterContent?.number ?? chapter;
    const chapterLabel = chapterNumber ? `Capítulo ${chapterNumber}` : "Capítulo";
    const titlePart = chapterContent?.title ? `${chapterLabel} - ${chapterContent.title}` : chapterLabel;
    return `${titlePart} - ${project.title}`;
  }, [chapter, chapterContent?.number, chapterContent?.title, project]);

  usePageMeta({
    title: pageTitle,
    description: chapterContent?.synopsis || project?.synopsis || "",
    image: project?.cover,
    type: "article",
  });

  useEffect(() => {
    if (!slug) {
      setHasLoaded(true);
      return;
    }
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, `/api/public/projects/${slug}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
        }
      } catch {
        if (isActive) {
          setProject(null);
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, slug]);

  const chapterNumber = Number(chapter);
  const volumeParam = Number(searchParams.get("volume"));
  const isLightNovel = isLightNovelType(project?.type || "");

  const sortedChapters = useMemo(() => {
    if (!project) {
      return [];
    }
    return (project.episodeDownloads || [])
      .filter((entry) => typeof entry.content === "string" && entry.content.trim().length > 0)
      .sort((a, b) => {
        const numberDelta = (a.number || 0) - (b.number || 0);
        if (numberDelta !== 0) {
          return numberDelta;
        }
        return (a.volume || 0) - (b.volume || 0);
      });
  }, [project]);

  const chapterData = useMemo(() => {
    if (!project || !Number.isFinite(chapterNumber)) {
      return null;
    }
    return sortedChapters.find((entry) => {
      if (entry.number !== chapterNumber) {
        return false;
      }
      if (!Number.isFinite(volumeParam)) {
        return true;
      }
      return (entry.volume || 0) === volumeParam;
    });
  }, [project, sortedChapters, chapterNumber, volumeParam]);

  const currentIndex = useMemo(() => {
    if (!chapterData) {
      return -1;
    }
    return sortedChapters.findIndex((entry) => {
      if (entry.number !== chapterData.number) {
        return false;
      }
      return (entry.volume || 0) === (chapterData.volume || 0);
    });
  }, [sortedChapters, chapterData]);

  const previousChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < sortedChapters.length - 1
      ? sortedChapters[currentIndex + 1]
      : null;

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!project || !Number.isFinite(chapterNumber)) {
        return;
      }
      const volumeQuery = Number.isFinite(volumeParam) ? `?volume=${volumeParam}` : "";
      try {
        const response = await apiFetch(apiBase, `/api/public/projects/${project.id}/chapters/${chapterNumber}${volumeQuery}`);
        if (!response.ok) {
          if (isActive) {
            setChapterContent(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setChapterContent(data.chapter || null);
        }
      } catch {
        if (isActive) {
          setChapterContent(null);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, project, chapterNumber, volumeParam]);

  useEffect(() => {
    if (!project?.id || !Number.isFinite(chapterContent?.number)) {
      return;
    }
    const chapterValue = Number(chapterContent.number);
    const volumeValue = Number(chapterContent.volume);
    const resourceId = `${project.id}:${chapterValue}:${Number.isFinite(volumeValue) ? volumeValue : 0}`;
    if (trackedChapterViewsRef.current.has(resourceId)) {
      return;
    }
    trackedChapterViewsRef.current.add(resourceId);
    const payload: {
      eventType: "chapter_view";
      resourceType: "chapter";
      resourceId: string;
      meta: {
        projectId: string;
        chapterNumber: number;
        volume?: number;
      };
    } = {
      eventType: "chapter_view",
      resourceType: "chapter",
      resourceId,
      meta: {
        projectId: project.id,
        chapterNumber: chapterValue,
      },
    };
    if (Number.isFinite(volumeValue)) {
      payload.meta.volume = volumeValue;
    }
    void apiFetch(apiBase, "/api/public/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [apiBase, project?.id, chapterContent?.number, chapterContent?.volume]);

  const chapterLexical = chapterContent?.content || "";

  if (!slug || (!project && hasLoaded)) {
    return <NotFound />;
  }
  if (!project) {
    return null;
  }
  if (!isLightNovel) {
    return <NotFound />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 bg-background">
        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:px-10">
          <div className="space-y-5">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link to={`/projeto/${project.id}`}>
                  <ChevronLeft className="h-4 w-4" />
                  Voltar ao projeto
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {previousChapter ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/projeto/${project.id}/leitura/${previousChapter.number}${
                        previousChapter.volume ? `?volume=${previousChapter.volume}` : ""
                      }`}
                    >
                      Capítulo anterior
                    </Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link to="/projetos">Ir para projetos</Link>
                </Button>
                {nextChapter ? (
                  <Button asChild size="sm">
                    <Link
                      to={`/projeto/${project.id}/leitura/${nextChapter.number}${
                        nextChapter.volume ? `?volume=${nextChapter.volume}` : ""
                      }`}
                    >
                      Próximo capítulo
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">Início</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/projetos">Projetos</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/projeto/${project.id}`}>{project.title}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Leitura</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <Badge variant="secondary" className="text-xs uppercase">
                Cap {chapterData?.number ?? chapterNumber}
                {chapterData?.volume ? ` • Vol. ${chapterData.volume}` : ""}
              </Badge>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                {chapterContent?.title || chapterData?.title || project.title}
              </h1>
              <p className="text-sm text-muted-foreground">{project.title} • Leitura de Light Novel</p>
            </div>

          </div>

          <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="min-w-0 space-y-6">
              <Card className="group border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                <CardContent className="min-w-0 space-y-6 p-6">
                  {chapterContent?.synopsis || chapterData?.synopsis ? (
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {chapterContent?.synopsis || chapterData?.synopsis}
                    </p>
                  ) : null}
                  {chapterContent?.content ? (
                    <Suspense fallback={<LexicalViewerFallback />}>
                      <LexicalViewer
                        value={chapterLexical}
                        className="post-content reader-content min-w-0 w-full space-y-4 text-sm text-muted-foreground"
                        pollTarget={
                          project?.id && Number.isFinite(chapterNumber)
                            ? {
                                type: "chapter",
                                projectId: project.id,
                                chapterNumber: chapterData?.number ?? chapterNumber,
                                volume: chapterData?.volume ?? (Number.isFinite(volumeParam) ? volumeParam : undefined),
                              }
                            : undefined
                        }
                      />
                    </Suspense>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                      Conteúdo ainda não disponível.
                    </div>
                  )}
                </CardContent>
              </Card>

              <CommentsSection
                targetType="chapter"
                targetId={project.id}
                chapterNumber={chapterData?.number ?? chapterNumber}
                volume={chapterData?.volume ?? (Number.isFinite(volumeParam) ? volumeParam : undefined)}
              />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BookOpen className="h-4 w-4 text-primary/70" />
                Capítulos publicados diretamente no site.
              </div>
            </article>

            <aside className="min-w-0 space-y-6">
              <LatestEpisodeCard />
              <WorkStatusCard />
              <DiscordInviteCard />
            </aside>
          </section>
        </section>
      </main>
    </div>
  );
};

export default ProjectReading;

