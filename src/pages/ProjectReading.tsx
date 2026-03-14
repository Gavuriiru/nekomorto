import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";

import CommentsSection from "@/components/CommentsSection";
import MangaViewerAdapter from "@/components/project-reader/MangaViewerAdapter";
import UploadPicture from "@/components/UploadPicture";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Project } from "@/data/projects";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useDeferredVisibility } from "@/hooks/use-deferred-visibility";
import { getApiBase } from "@/lib/api-base";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { apiFetch } from "@/lib/api-client";
import { createSlug } from "@/lib/post-content";
import {
  readWindowPublicBootstrap,
  readWindowPublicBootstrapCurrentUser,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";
import {
  buildDashboardProjectChapterEditorHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import {
  buildEpisodeKey,
  resolveCanonicalEpisodeRouteTarget,
} from "@/lib/project-episode-key";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";
import { findVolumeCoverByVolume } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type { PublicBootstrapPayload, PublicBootstrapProject } from "@/types/public-bootstrap";
import {
  hasProjectEpisodeReadableContent,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  resolveProjectReaderConfig,
} from "../../shared/project-reader.js";
import {
  buildProjectReadingOgImagePath,
  buildProjectReadingOgRevision,
  resolveProjectReadingOgSnapshot,
} from "../../shared/project-reading-og-seo.js";
import NotFound from "./NotFound";

const LexicalViewer = lazy(() => import("@/components/lexical/LexicalViewer"));

const LexicalViewerFallback = () => (
  <div className="min-h-[320px] w-full rounded-xl border border-border/60 bg-background/60 p-6 text-sm text-muted-foreground">
    Carregando conteúdo...
  </div>
);

type ReadingProject = Project | PublicBootstrapProject;

const normalizeProjectRouteKey = (value: unknown) =>
  String(createSlug(String(value || "").trim()) || "").trim().toLowerCase();

const resolveBootstrapProject = (
  bootstrapData: PublicBootstrapPayload | null,
  slug: string | undefined,
) => {
  const rawSlug = String(slug || "").trim();
  const routeKey = normalizeProjectRouteKey(rawSlug);
  if (!routeKey && !rawSlug) {
    return null;
  }
  return (
    bootstrapData?.projects.find((candidate) => {
      const candidateId = String(candidate.id || "").trim();
      return (
        candidateId === rawSlug ||
        normalizeProjectRouteKey(candidateId) === routeKey ||
        normalizeProjectRouteKey(candidate.title) === routeKey
      );
    }) || null
  );
};

const mergeMediaVariants = (
  base: UploadMediaVariantsMap,
  nextValue: unknown,
) => ({
  ...base,
  ...(nextValue && typeof nextValue === "object" ? (nextValue as UploadMediaVariantsMap) : {}),
});

const ProjectReading = () => {
  const { slug, chapter } = useParams<{ slug: string; chapter: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const [bootstrapData] = useState<PublicBootstrapPayload | null>(() => readWindowPublicBootstrap());
  const [currentUser] = useState<PublicBootstrapCurrentUser | null>(() =>
    readWindowPublicBootstrapCurrentUser(),
  );
  const bootstrapProject = useMemo(
    () => resolveBootstrapProject(bootstrapData, slug),
    [bootstrapData, slug],
  );
  const [project, setProject] = useState<ReadingProject | null>(bootstrapProject);
  const [chapterContent, setChapterContent] = useState<{
    number: number;
    volume?: number;
    title?: string;
    entryKind?: "main" | "extra";
    entrySubtype?: string;
    readingOrder?: number;
    displayLabel?: string;
    synopsis?: string;
    content?: string;
    contentFormat?: "lexical" | "images";
    pages?: Array<{ position: number; imageUrl: string }>;
    pageCount?: number;
    hasPages?: boolean;
    coverImageUrl?: string;
    coverImageAlt?: string;
  } | null>(null);
  const [chapterReaderConfig, setChapterReaderConfig] = useState<Record<string, unknown> | null>(
    null,
  );
  const [hasLoadedProject, setHasLoadedProject] = useState(Boolean(bootstrapProject));
  const [hasLoadedChapter, setHasLoadedChapter] = useState(false);
  const [chapterLoadError, setChapterLoadError] = useState(false);
  const [mediaVariants, setMediaVariants] = useState<UploadMediaVariantsMap>(
    () => bootstrapData?.mediaVariants || {},
  );
  const trackedChapterViewsRef = useRef<Set<string>>(new Set());
  const { isVisible: isCommentsVisible, sentinelRef: commentsSentinelRef } =
    useDeferredVisibility({
      initialVisible: location.hash.startsWith("#comment-"),
      rootMargin: "400px 0px",
    });

  useEffect(() => {
    setProject(bootstrapProject);
    setHasLoadedProject(Boolean(bootstrapProject));
    setMediaVariants(bootstrapData?.mediaVariants || {});
  }, [bootstrapData, bootstrapProject]);

  useEffect(() => {
    let isActive = true;

    const loadProject = async () => {
      if (!slug || bootstrapProject) {
        if (isActive) {
          setHasLoadedProject(Boolean(bootstrapProject));
        }
        return;
      }

      try {
        const response = await apiFetch(apiBase, `/api/public/projects/${slug}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
          }
          return;
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setProject(data.project || null);
        setMediaVariants((current) =>
          mergeMediaVariants(bootstrapData?.mediaVariants || current, data?.mediaVariants),
        );
      } catch {
        if (isActive) {
          setProject(null);
        }
      } finally {
        if (isActive) {
          setHasLoadedProject(true);
        }
      }
    };

    void loadProject();
    return () => {
      isActive = false;
    };
  }, [apiBase, bootstrapData?.mediaVariants, bootstrapProject, slug]);

  const chapterNumber = Number(chapter);
  const volumeParamRaw = searchParams.get("volume");
  const parsedVolumeParam = Number(volumeParamRaw);
  const volumeParam =
    volumeParamRaw !== null && Number.isFinite(parsedVolumeParam) ? parsedVolumeParam : undefined;
  const isLightNovel = isLightNovelType(project?.type || "");
  const isManga = isMangaType(project?.type || "");
  const isReaderProject = isLightNovel || isManga;

  const sortedChapters = useMemo(() => {
    if (!project) {
      return [];
    }
    return (project.episodeDownloads || [])
      .filter((entry) => hasProjectEpisodeReadableContent(entry))
      .sort((a, b) => {
        const leftReadingOrder = Number(a.readingOrder);
        const rightReadingOrder = Number(b.readingOrder);
        const hasLeftReadingOrder = Number.isFinite(leftReadingOrder);
        const hasRightReadingOrder = Number.isFinite(rightReadingOrder);
        if (hasLeftReadingOrder || hasRightReadingOrder) {
          if (!hasLeftReadingOrder) {
            return 1;
          }
          if (!hasRightReadingOrder) {
            return -1;
          }
          if (leftReadingOrder !== rightReadingOrder) {
            return leftReadingOrder - rightReadingOrder;
          }
        }
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
    const lookupKey = buildEpisodeKey(chapterNumber, volumeParam);
    return sortedChapters.find((entry) => {
      if (volumeParam === undefined) {
        return entry.number === chapterNumber;
      }
      return buildEpisodeKey(entry.number, entry.volume) === lookupKey;
    });
  }, [chapterNumber, project, sortedChapters, volumeParam]);

  const activeVolume = useMemo(() => {
    const contentVolume = Number(chapterContent?.volume);
    if (Number.isFinite(contentVolume)) {
      return contentVolume;
    }
    const listVolume = Number(chapterData?.volume);
    if (Number.isFinite(listVolume)) {
      return listVolume;
    }
    return volumeParam;
  }, [chapterContent?.volume, chapterData?.volume, volumeParam]);

  const normalizedVolumeEntries = useMemo(
    () =>
      normalizeProjectVolumeEntries(
        Array.isArray(project?.volumeEntries)
          ? project.volumeEntries
          : Array.isArray(project?.volumeCovers)
            ? project.volumeCovers
            : [],
      ),
    [project?.volumeCovers, project?.volumeEntries],
  );

  const volumeEntry = useMemo(
    () => findVolumeCoverByVolume(normalizedVolumeEntries, activeVolume),
    [activeVolume, normalizedVolumeEntries],
  );

  const volumeCover = useMemo(
    () => findVolumeCoverByVolume(project?.volumeCovers, activeVolume),
    [activeVolume, project?.volumeCovers],
  );

  const heroImage = useMemo(
    () =>
      normalizeProjectEpisodePages(chapterContent?.pages)[0]?.imageUrl ||
      chapterContent?.coverImageUrl ||
      chapterData?.coverImageUrl ||
      volumeEntry?.coverImageUrl ||
      volumeCover?.coverImageUrl ||
      project?.cover ||
      project?.heroImageUrl ||
      project?.banner ||
      "/placeholder.svg",
    [
      chapterContent?.pages,
      chapterContent?.coverImageUrl,
      chapterData?.coverImageUrl,
      project?.banner,
      project?.cover,
      project?.heroImageUrl,
      volumeEntry?.coverImageUrl,
      volumeCover?.coverImageUrl,
    ],
  );

  const heroImageAlt = useMemo(
    () =>
      chapterContent?.coverImageAlt ||
      chapterData?.coverImageAlt ||
      volumeEntry?.coverImageAlt ||
      volumeCover?.coverImageAlt ||
      project?.coverAlt ||
      project?.heroImageAlt ||
      `Banner do projeto ${project?.title || ""}`,
    [
      chapterContent?.coverImageAlt,
      chapterData?.coverImageAlt,
      project?.coverAlt,
      project?.heroImageAlt,
      project?.title,
      volumeEntry?.coverImageAlt,
      volumeCover?.coverImageAlt,
    ],
  );

  const resolvedChapterSynopsis = useMemo(() => {
    const explicitChapterSynopsis = String(chapterContent?.synopsis || chapterData?.synopsis || "").trim();
    if (explicitChapterSynopsis) {
      return explicitChapterSynopsis;
    }
    const explicitVolumeSynopsis = String(volumeEntry?.synopsis || "").trim();
    if (explicitVolumeSynopsis) {
      return explicitVolumeSynopsis;
    }
    return String(project?.synopsis || "").trim();
  }, [chapterContent?.synopsis, chapterData?.synopsis, project?.synopsis, volumeEntry?.synopsis]);

  const pageTitle = useMemo(() => {
    if (!project) {
      return "Leitura";
    }
    const entryKind = chapterContent?.entryKind === "extra" ? "extra" : "main";
    const chapterLabel =
      entryKind === "extra"
        ? String(chapterContent?.displayLabel || chapterData?.displayLabel || "Extra").trim() ||
          "Extra"
        : chapterContent?.number || chapterData?.number || chapterNumber
          ? `Capítulo ${chapterContent?.number || chapterData?.number || chapterNumber}`
          : "Capítulo";
    const titlePart =
      chapterContent?.title || chapterData?.title
        ? `${chapterLabel} - ${chapterContent?.title || chapterData?.title}`
        : chapterLabel;
    return `${titlePart} - ${project.title}`;
  }, [
    chapterContent?.displayLabel,
    chapterContent?.entryKind,
    chapterContent?.number,
    chapterContent?.title,
    chapterData?.displayLabel,
    chapterData?.number,
    chapterData?.title,
    chapterNumber,
    project,
  ]);

  const readingOgSnapshot = useMemo(
    () =>
      resolveProjectReadingOgSnapshot({
        project,
        chapterNumber,
        volume: activeVolume,
        settings: bootstrapData?.settings,
        tagTranslations: bootstrapData?.tagTranslations?.tags,
        genreTranslations: bootstrapData?.tagTranslations?.genres,
      }),
    [
      activeVolume,
      bootstrapData?.settings,
      bootstrapData?.tagTranslations?.genres,
      bootstrapData?.tagTranslations?.tags,
      chapterNumber,
      project,
    ],
  );

  const readingOgRevision = useMemo(
    () =>
      buildProjectReadingOgRevision({
        project,
        chapterNumber,
        volume: activeVolume,
        settings: bootstrapData?.settings,
        tagTranslations: bootstrapData?.tagTranslations?.tags,
        genreTranslations: bootstrapData?.tagTranslations?.genres,
      }),
    [
      activeVolume,
      bootstrapData?.settings,
      bootstrapData?.tagTranslations?.genres,
      bootstrapData?.tagTranslations?.tags,
      chapterNumber,
      project,
    ],
  );

  const readingOgImage = useMemo(() => {
    if (!project?.id || !readingOgSnapshot || !readingOgRevision) {
      return "";
    }
    return normalizeAssetUrl(
      buildProjectReadingOgImagePath({
        projectId: project.id,
        chapterNumber: readingOgSnapshot.chapterNumberResolved ?? chapterNumber,
        volume: readingOgSnapshot.volumeResolved,
        revision: readingOgRevision,
      }),
    );
  }, [chapterNumber, project?.id, readingOgRevision, readingOgSnapshot]);

  const projectOgImage = useMemo(
    () =>
      project?.id ? normalizeAssetUrl(`/api/og/project/${encodeURIComponent(project.id)}`) : "",
    [project?.id],
  );

  const readingOgImageAlt = useMemo(() => {
    return String(readingOgSnapshot?.imageAlt || "").trim();
  }, [readingOgSnapshot]);

  usePageMeta({
    title: pageTitle,
    description: resolvedChapterSynopsis,
    image: readingOgImage || projectOgImage || heroImage,
    imageAlt: readingOgImage ? readingOgImageAlt : projectOgImage ? `Card de compartilhamento do projeto ${project?.title || ""}` : heroImageAlt,
    mediaVariants,
    type: "article",
  });

  const currentIndex = useMemo(() => {
    if (!chapterData) {
      return -1;
    }
    const activeKey = buildEpisodeKey(chapterData.number, chapterData.volume);
    return sortedChapters.findIndex(
      (entry) => buildEpisodeKey(entry.number, entry.volume) === activeKey,
    );
  }, [chapterData, sortedChapters]);

  const previousChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < sortedChapters.length - 1
      ? sortedChapters[currentIndex + 1]
      : null;

  const chapterBadgeLabel = useMemo(() => {
    const isExtra = chapterContent?.entryKind === "extra" || chapterData?.entryKind === "extra";
    if (isExtra) {
      return (
        String(chapterContent?.displayLabel || chapterData?.displayLabel || "Extra").trim() ||
        "Extra"
      );
    }
    return `Cap ${chapterData?.number ?? chapterNumber}`;
  }, [
    chapterContent?.displayLabel,
    chapterContent?.entryKind,
    chapterData?.displayLabel,
    chapterData?.entryKind,
    chapterData?.number,
    chapterNumber,
  ]);

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
    const canonicalChapter = resolveCanonicalEpisodeRouteTarget(
      sortedChapters,
      chapterNumberValue,
      [chapterContent?.volume, chapterData?.volume, volumeParam],
      {
        exactPreferredOnly: true,
      },
    );
    if (!canonicalChapter) {
      return "";
    }
    return buildDashboardProjectChapterEditorHref(
      project.id,
      Number(canonicalChapter.number),
      canonicalChapter.volume,
    );
  }, [
    chapterContent?.number,
    chapterContent?.volume,
    chapterData?.number,
    chapterData?.volume,
    chapterNumber,
    project?.id,
    sortedChapters,
    volumeParam,
  ]);

  useEffect(() => {
    let isActive = true;

    const loadChapter = async () => {
      setHasLoadedChapter(false);
      setChapterLoadError(false);
      setChapterContent(null);
      setChapterReaderConfig(null);

      if (!project?.id || !Number.isFinite(chapterNumber)) {
        if (isActive) {
          setHasLoadedChapter(true);
        }
        return;
      }

      const volumeQuery = volumeParam !== undefined ? `?volume=${volumeParam}` : "";
      try {
        const response = await apiFetch(
          apiBase,
          `/api/public/projects/${project.id}/chapters/${chapterNumber}${volumeQuery}`,
        );
        if (!response.ok) {
          if (isActive) {
            setChapterContent(null);
            setChapterReaderConfig(null);
            setChapterLoadError(true);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setChapterContent(data.chapter || null);
          setChapterReaderConfig(
            data?.readerConfig && typeof data.readerConfig === "object" ? data.readerConfig : null,
          );
          setChapterLoadError(false);
        }
      } catch {
        if (isActive) {
          setChapterContent(null);
          setChapterReaderConfig(null);
          setChapterLoadError(true);
        }
      } finally {
        if (isActive) {
          setHasLoadedChapter(true);
        }
      }
    };

    void loadChapter();
    return () => {
      isActive = false;
    };
  }, [apiBase, chapterNumber, project?.id, volumeParam]);

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
  }, [apiBase, chapterContent?.number, chapterContent?.volume, project?.id]);

  const shouldShowNotFound = !slug || (!project && hasLoadedProject);
  if (shouldShowNotFound) {
    return <NotFound />;
  }
  if (!project) {
    return null;
  }
  if (!isReaderProject) {
    return <NotFound />;
  }

  const chapterLexical = chapterContent?.content || "";
  const chapterPages = normalizeProjectEpisodePages(chapterContent?.pages || chapterData?.pages);
  const chapterContentFormat = normalizeProjectEpisodeContentFormat(
    chapterContent?.contentFormat || chapterData?.contentFormat,
    chapterPages.length > 0 ? "images" : "lexical",
  );
  const chapterReaderConfigResolved = resolveProjectReaderConfig({
    projectType: project?.type,
    siteSettings: settings,
    siteReaderConfig: chapterReaderConfig,
    projectReaderConfig: project?.readerConfig,
  });
  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${apiBase}/projeto/${encodeURIComponent(project.id)}/leitura/${encodeURIComponent(String(chapterNumber))}`;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 bg-background">
        <section
          data-testid="project-reading-hero"
          className="project-reading-masthead relative overflow-hidden"
        >
          <UploadPicture
            src={heroImage}
            alt=""
            preset="hero"
            mediaVariants={mediaVariants}
            className="project-reading-masthead__media absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover object-top md:object-[center_18%]"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--veil absolute inset-0" />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--horizontal absolute inset-0" />
          <div className="project-reading-masthead__backdrop project-reading-masthead__backdrop--bottom absolute inset-0" />

          <div
            className={`${publicPageLayoutTokens.sectionBase} project-reading-masthead__content relative max-w-6xl pb-10 pt-24 md:pb-16 md:pt-20 lg:pb-20 lg:pt-24`}
          >
            <div className="project-reading-masthead__layout grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_250px] md:gap-10 lg:grid-cols-[minmax(0,1fr)_270px]">
              <div className="project-reading-masthead__body order-2 mx-auto w-48 md:order-1 md:w-full">
                <div className="project-reading-masthead__meta flex w-full flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="project-reading-masthead__badge project-reading-masthead__badge--type text-xs uppercase tracking-wide"
                  >
                    {project.type || (isLightNovel ? "Light Novel" : "Mangá")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="project-reading-masthead__badge project-reading-masthead__badge--chapter text-xs uppercase tracking-wide"
                  >
                    {chapterBadgeLabel}
                    {Number.isFinite(activeVolume) ? ` • Vol. ${activeVolume}` : ""}
                  </Badge>
                </div>
                <div className="project-reading-masthead__heading mt-4 space-y-2">
                  <p className="project-reading-masthead__overline">{project.title}</p>
                  <h1 className="project-reading-masthead__title">
                    {chapterContent?.title || chapterData?.title || project.title}
                  </h1>
                </div>
                {resolvedChapterSynopsis ? (
                  <p className="project-reading-masthead__synopsis mt-4 max-w-3xl">
                    {resolvedChapterSynopsis}
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
                        <span>
                          {chapterContent?.entryKind === "extra" ||
                          chapterData?.entryKind === "extra"
                            ? "Editar extra"
                            : "Editar capítulo"}
                        </span>
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
                  {chapterContentFormat === "images" && chapterPages.length > 0 ? (
                    <MangaViewerAdapter
                      title={pageTitle}
                      backUrl={`/projeto/${encodeURIComponent(project.id)}`}
                      shareUrl={shareUrl}
                      pages={chapterPages}
                      direction={chapterReaderConfigResolved.direction || "rtl"}
                      viewMode={chapterReaderConfigResolved.viewMode || "page"}
                      firstPageSingle={chapterReaderConfigResolved.firstPageSingle !== false}
                      allowSpread={chapterReaderConfigResolved.allowSpread !== false}
                      showFooter={chapterReaderConfigResolved.showFooter !== false}
                      previewLimit={chapterReaderConfigResolved.previewLimit ?? null}
                      purchaseUrl={chapterReaderConfigResolved.purchaseUrl || ""}
                      purchasePrice={chapterReaderConfigResolved.purchasePrice || ""}
                    />
                  ) : chapterContent?.content ? (
                    <Suspense fallback={<LexicalViewerFallback />}>
                      <LexicalViewer
                        value={chapterLexical}
                        ariaLabel={`Conteúdo de leitura de ${pageTitle}`}
                        className="post-content reader-content min-w-0 w-full text-muted-foreground"
                        pollTarget={
                          project.id && Number.isFinite(chapterNumber)
                            ? {
                                type: "chapter",
                                projectId: project.id,
                                chapterNumber: chapterData?.number ?? chapterNumber,
                                volume: chapterData?.volume ?? volumeParam,
                              }
                            : undefined
                        }
                      />
                    </Suspense>
                  ) : !hasLoadedChapter ? (
                    <LexicalViewerFallback />
                  ) : chapterLoadError ? (
                    <div className="project-reading-reader-shell__empty rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                      O conteúdo do capítulo não pôde ser carregado agora.
                    </div>
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
                        to={buildProjectPublicReadingHref(
                          project.id,
                          previousChapter.number,
                          previousChapter.volume,
                        )}
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
                        to={buildProjectPublicReadingHref(
                          project.id,
                          nextChapter.number,
                          nextChapter.volume,
                        )}
                      >
                        <span>Próximo capítulo</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : null}
                </nav>
              ) : null}

              <div ref={commentsSentinelRef} aria-hidden="true" className="h-px w-full" />

              {isCommentsVisible ? (
                <CommentsSection
                  targetType="chapter"
                  targetId={project.id}
                  chapterNumber={chapterData?.number ?? chapterContent?.number ?? chapterNumber}
                  volume={chapterData?.volume ?? chapterContent?.volume ?? volumeParam}
                />
              ) : null}
            </article>
          </section>
        </section>
      </main>
    </div>
  );
};

export default ProjectReading;
