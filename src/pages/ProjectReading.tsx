import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import { findVolumeCoverByVolume } from "@/lib/project-volume-cover-key";
import { isLightNovelType } from "@/lib/project-utils";
import type { Project } from "@/data/projects";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
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
  const [currentUser, setCurrentUser] = useState<{ permissions?: string[] } | null>(null);
  const [chapterContent, setChapterContent] = useState<{
    number: number;
    volume?: number;
    title?: string;
    synopsis?: string;
    content?: string;
    contentFormat?: "lexical";
    coverImageUrl?: string;
    coverImageAlt?: string;
  } | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mediaVariants, setMediaVariants] = useState<UploadMediaVariantsMap>({});
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
            setMediaVariants({});
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
          setMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
        }
      } catch {
        if (isActive) {
          setProject(null);
          setMediaVariants({});
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

  const chapterNumber = Number(chapter);
  const volumeParam = Number(searchParams.get("volume"));
  const isLightNovel = isLightNovelType(project?.type || "");

  const sortedChapters = useMemo(() => {
    if (!project) {
      return [];
    }
    return (project.episodeDownloads || [])
      .filter(
        (entry) =>
          (entry as { hasContent?: boolean }).hasContent ||
          (typeof entry.content === "string" && entry.content.trim().length > 0),
      )
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
    const lookupKey = buildEpisodeKey(
      chapterNumber,
      Number.isFinite(volumeParam) ? volumeParam : undefined,
    );
    return sortedChapters.find((entry) => {
      if (!Number.isFinite(volumeParam)) {
        return entry.number === chapterNumber;
      }
      return buildEpisodeKey(entry.number, entry.volume) === lookupKey;
    });
  }, [project, sortedChapters, chapterNumber, volumeParam]);

  const activeVolume = useMemo(() => {
    const contentVolume = Number(chapterContent?.volume);
    if (Number.isFinite(contentVolume)) {
      return contentVolume;
    }
    const listVolume = Number(chapterData?.volume);
    if (Number.isFinite(listVolume)) {
      return listVolume;
    }
    return Number.isFinite(volumeParam) ? volumeParam : undefined;
  }, [chapterContent?.volume, chapterData?.volume, volumeParam]);

  const volumeCover = useMemo(
    () => findVolumeCoverByVolume(project?.volumeCovers, activeVolume),
    [activeVolume, project?.volumeCovers],
  );

  const heroImage = useMemo(
    () =>
      volumeCover?.coverImageUrl ||
      chapterContent?.coverImageUrl ||
      chapterData?.coverImageUrl ||
      project?.cover ||
      project?.heroImageUrl ||
      project?.banner ||
      "/placeholder.svg",
    [
      chapterContent?.coverImageUrl,
      chapterData?.coverImageUrl,
      project?.banner,
      project?.cover,
      project?.heroImageUrl,
      volumeCover?.coverImageUrl,
    ],
  );

  const heroImageAlt = useMemo(
    () =>
      volumeCover?.coverImageAlt ||
      chapterContent?.coverImageAlt ||
      chapterData?.coverImageAlt ||
      project?.coverAlt ||
      project?.heroImageAlt ||
      `Banner do projeto ${project?.title || ""}`,
    [
      chapterContent?.coverImageAlt,
      chapterData?.coverImageAlt,
      project?.coverAlt,
      project?.heroImageAlt,
      project?.title,
      volumeCover?.coverImageAlt,
    ],
  );

  usePageMeta({
    title: pageTitle,
    description: chapterContent?.synopsis || project?.synopsis || "",
    image: heroImage,
    imageAlt: heroImageAlt,
    mediaVariants,
    type: "article",
  });

  const currentIndex = useMemo(() => {
    if (!chapterData) {
      return -1;
    }
    const activeKey = buildEpisodeKey(chapterData.number, chapterData.volume);
    return sortedChapters.findIndex((entry) => {
      return buildEpisodeKey(entry.number, entry.volume) === activeKey;
    });
  }, [sortedChapters, chapterData]);

  const previousChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < sortedChapters.length - 1
      ? sortedChapters[currentIndex + 1]
      : null;
  const canEditChapter = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  const editChapterHref = useMemo(() => {
    if (!project?.id) {
      return "";
    }
    const chapterNumberValue = chapterData?.number ?? chapterContent?.number ?? chapterNumber;
    if (!Number.isFinite(chapterNumberValue)) {
      return "";
    }
    const params = new URLSearchParams({
      edit: project.id,
      chapter: String(chapterNumberValue),
    });
    if (Number.isFinite(activeVolume)) {
      params.set("volume", String(activeVolume));
    }
    return `/dashboard/projetos?${params.toString()}`;
  }, [activeVolume, chapterContent?.number, chapterData?.number, chapterNumber, project?.id]);

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
        <section data-testid="project-reading-hero" className="project-reading-masthead relative overflow-hidden">
          <UploadPicture
            src={heroImage}
            alt=""
            preset="hero"
            mediaVariants={mediaVariants}
            className="project-reading-masthead__media absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover object-top md:object-[center_18%]"
            loading="eager"
            decoding="async"
            {...({ fetchpriority: "high" } as Record<string, string>)}
          />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--veil absolute inset-0" />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--horizontal absolute inset-0" />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--bottom absolute inset-0" />

          <div
            className={`${publicPageLayoutTokens.sectionBase} project-reading-masthead__content relative max-w-6xl pb-10 pt-24 md:pb-16 md:pt-20 lg:pb-20 lg:pt-24`}
          >
            <div className="project-reading-masthead__layout grid items-center gap-8 md:gap-10 md:grid-cols-[minmax(0,1fr)_250px] lg:grid-cols-[minmax(0,1fr)_270px]">
              <div className="project-reading-masthead__body order-2 mx-auto w-48 md:order-1 md:w-full">
                <div className="project-reading-masthead__meta flex w-full flex-wrap items-center gap-2">
                  <Badge variant="outline" className="project-reading-masthead__badge project-reading-masthead__badge--type text-xs uppercase tracking-wide">
                    Light Novel
                  </Badge>
                  <Badge variant="secondary" className="project-reading-masthead__badge project-reading-masthead__badge--chapter text-xs uppercase">
                    Cap {chapterData?.number ?? chapterNumber}
                    {Number.isFinite(activeVolume) ? ` • Vol. ${activeVolume}` : ""}
                  </Badge>
                </div>
                <div className="project-reading-masthead__heading mt-4 space-y-2">
                  <p className="project-reading-masthead__overline">
                    {project.title}
                  </p>
                  <h1 className="project-reading-masthead__title">
                    {chapterContent?.title || chapterData?.title || project.title}
                  </h1>
                </div>
                {chapterContent?.synopsis || chapterData?.synopsis ? (
                  <p className="project-reading-masthead__synopsis mt-4 max-w-3xl">
                    {chapterContent?.synopsis || chapterData?.synopsis}
                  </p>
                ) : null}
                <div className="project-reading-masthead__actions mt-5 flex w-full flex-wrap gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="project-reading-action-btn project-reading-action-btn--secondary shrink-0"
                  >
                    <Link to={`/projeto/${project.id}`}>
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Voltar ao projeto</span>
                    </Link>
                  </Button>
                  {canEditChapter && editChapterHref ? (
                    <Button
                      asChild
                      size="sm"
                      className="project-reading-action-btn project-reading-action-btn--primary"
                    >
                      <Link to={editChapterHref}>
                        <PencilLine className="h-4 w-4" aria-hidden="true" />
                        <span>Editar capítulo</span>
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="project-reading-masthead__cover order-1 mx-auto w-52 md:order-2 md:ml-auto md:w-[250px] lg:w-[270px]">
                <div
                  className="project-reading-masthead__cover-frame overflow-hidden rounded-2xl border border-border/70 bg-secondary/90"
                  style={{ aspectRatio: "9 / 14" }}
                >
                  <UploadPicture
                    src={heroImage}
                    alt={heroImageAlt}
                    preset="poster"
                    mediaVariants={mediaVariants}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover object-center"
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="project-reading-first-fold mx-auto mt-6 w-full max-w-6xl px-6 pb-16 md:px-10">
          <section>
            <article className="min-w-0 space-y-6">
              <Card className="project-reading-reader-shell">
                <CardContent className="project-reading-reader-shell__content min-w-0 space-y-6 p-6">
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
                    <div className="project-reading-reader-shell__empty rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                      Conteúdo ainda não disponível.
                    </div>
                  )}
                </CardContent>
              </Card>

              {previousChapter || nextChapter ? (
                <nav
                  data-testid="project-reading-chapter-nav"
                  aria-label="Navegação de capítulos"
                  className="project-reading-chapter-nav flex flex-wrap items-center gap-2"
                >
                  {previousChapter ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="project-reading-nav-btn project-reading-nav-btn--secondary project-reading-chapter-nav__button"
                    >
                      <Link
                        to={`/projeto/${project.id}/leitura/${previousChapter.number}${
                          previousChapter.volume ? `?volume=${previousChapter.volume}` : ""
                        }`}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Capítulo anterior</span>
                      </Link>
                    </Button>
                  ) : null}
                  {nextChapter ? (
                    <Button
                      asChild
                      size="sm"
                      className="project-reading-nav-btn project-reading-nav-btn--next project-reading-chapter-nav__button"
                    >
                      <Link
                        to={`/projeto/${project.id}/leitura/${nextChapter.number}${
                          nextChapter.volume ? `?volume=${nextChapter.volume}` : ""
                        }`}
                      >
                        <span>Próximo capítulo</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : null}
                </nav>
              ) : null}

              <CommentsSection
                targetType="chapter"
                targetId={project.id}
                chapterNumber={chapterData?.number ?? chapterNumber}
                volume={chapterData?.volume ?? (Number.isFinite(volumeParam) ? volumeParam : undefined)}
              />
            </article>
          </section>
        </section>
      </main>
    </div>
  );
};

export default ProjectReading;

