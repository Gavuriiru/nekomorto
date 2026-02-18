import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  Cloud,
  Download,
  Film,
  Hash,
  HardDrive,
  Link2,
  PlayCircle,
  Send,
  Share2,
  Users,
} from "lucide-react";

import CommentsSection from "@/components/CommentsSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { getApiBase } from "@/lib/api-base";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { formatDate } from "@/lib/date";
import { apiFetch } from "@/lib/api-client";
import {
  buildTranslationMap,
  sortByTranslatedLabel,
  translateAnilistRole,
  translateGenre,
  translateRelation,
  translateTag,
} from "@/lib/project-taxonomy";
import { formatBytesCompact } from "@/lib/file-size";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { usePageMeta } from "@/hooks/use-page-meta";
import { normalizeAssetUrl } from "@/lib/asset-url";
import NotFound from "./NotFound";
import type { Project } from "@/data/projects";

const ProjectPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const apiBase = getApiBase();
  const [project, setProject] = useState<Project | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [projectDirectory, setProjectDirectory] = useState<Project[]>([]);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{ permissions?: string[] } | null>(null);
  const [episodePage, setEpisodePage] = useState(1);
  const { settings } = useSiteSettings();
  const trackedViewsRef = useRef<Set<string>>(new Set());

  const shareImage = useMemo(
    () => normalizeAssetUrl(project?.cover) || normalizeAssetUrl(settings.site.defaultShareImage),
    [project?.cover, settings.site.defaultShareImage],
  );

  usePageMeta({
    title: project?.title || "Projeto",
    description: project?.synopsis || "",
    image: shareImage,
    type: "article",
  });

  useEffect(() => {
    if (!slug) {
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

  useEffect(() => {
    if (!project?.id) {
      return;
    }
    if (trackedViewsRef.current.has(project.id)) {
      return;
    }
    trackedViewsRef.current.add(project.id);
    void apiFetch(apiBase, `/api/public/projects/${project.id}/view`, { method: "POST" });
  }, [apiBase, project?.id]);
  useEffect(() => {
    let isActive = true;
    const loadMeta = async () => {
      try {
        const [projectsRes, tagsRes] = await Promise.all([
          apiFetch(apiBase, "/api/public/projects"),
          apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" }),
        ]);
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          if (isActive) {
            setProjectDirectory(Array.isArray(data.projects) ? data.projects : []);
          }
        }
        if (tagsRes.ok) {
          const data = await tagsRes.json();
          if (isActive) {
            setTagTranslations(data.tags || {});
            setGenreTranslations(data.genres || {});
            setStaffRoleTranslations(data.staffRoles || {});
          }
        }
      } catch {
        if (isActive) {
          setProjectDirectory([]);
          setTagTranslations({});
          setGenreTranslations({});
          setStaffRoleTranslations({});
        }
      }
    };

    loadMeta();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

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

  const projectDetails = useMemo(() => {
    if (!project) {
      return [];
    }
    const typeLabel = (project.type || "").toLowerCase();
    const isChapterBased = isChapterBasedType(typeLabel);
    return [
      { label: "Formato", value: project.type },
      { label: "Status", value: project.status },
      { label: "Ano", value: project.year },
      { label: "Estúdio", value: project.studio },
      { label: "Temporada", value: project.season },
      { label: isChapterBased ? "Capítulos" : "Episódios", value: project.episodes },
      { label: "Classificação", value: project.rating },
      { label: "Agenda", value: project.schedule },
    ].filter((item) => String(item.value || "").trim().length > 0);
  }, [project]);

  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const genreTranslationMap = useMemo(() => buildTranslationMap(genreTranslations), [genreTranslations]);
  const staffRoleTranslationMap = useMemo(() => buildTranslationMap(staffRoleTranslations), [staffRoleTranslations]);

  const sortedTags = useMemo(() => {
    const tags = Array.isArray(project?.tags) ? project.tags : [];
    return sortByTranslatedLabel(tags, (tag) => translateTag(tag, tagTranslationMap));
  }, [project?.tags, tagTranslationMap]);

  const sortedGenres = useMemo(() => {
    const genres = Array.isArray(project?.genres) ? project.genres : [];
    return sortByTranslatedLabel(genres, (genre) => translateGenre(genre, genreTranslationMap));
  }, [project?.genres, genreTranslationMap]);

  const sourceThemeMap = useMemo(() => {
    const map = new Map<string, { color: string; icon?: string; tintIcon: boolean }>();
    settings.downloads.sources.forEach((source) => {
      if (!source?.label) {
        return;
      }
      map.set(source.label.toLowerCase(), {
        color: source.color || "#7C3AED",
        icon: source.icon,
        tintIcon: source.tintIcon !== false,
      });
    });
    return map;
  }, [settings.downloads.sources]);

  const renderSourceIcon = (
    iconKey: string | undefined,
    color: string,
    label?: string,
    tintIcon = true,
  ) => {
    if (
      iconKey &&
      (iconKey.startsWith("http") || iconKey.startsWith("data:") || iconKey.startsWith("/uploads/"))
    ) {
      if (!tintIcon) {
        return <img src={iconKey} alt={label || ""} className="h-4 w-4" />;
      }
      return (
        <ThemedSvgLogo
          url={iconKey}
          label={label || "Fonte de download"}
          className="h-4 w-4"
          color={color}
        />
      );
    }
    const normalized = String(iconKey || "").toLowerCase();
    if (normalized === "google-drive") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" style={{ color }}>
          <path fill="currentColor" d="M7.5 3h9l4.5 8-4.5 8h-9L3 11z" />
        </svg>
      );
    }
    if (normalized === "mega") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <circle cx="12" cy="12" r="10" fill={color} />
          <path
            fill="#fff"
            d="M7.2 16.4V7.6h1.6l3.2 4.2 3.2-4.2h1.6v8.8h-1.6V10l-3.2 4.1L8.8 10v6.4z"
          />
        </svg>
      );
    }
    const iconMap: Record<string, typeof Download> = {
      telegram: Send,
      mediafire: Cloud,
      torrent: HardDrive,
      link: Link2,
      download: Download,
    };
    const Icon = iconMap[normalized] || Download;
    return <Icon className="h-4 w-4" style={{ color }} />;
  };

  const buildEpisodeMetadata = (episode: { sizeBytes?: number; hash?: string }) => {
    const rawSize = Number(episode.sizeBytes);
    const sizeLabel = Number.isFinite(rawSize) && rawSize > 0 ? formatBytesCompact(rawSize) : "";
    const hashTitle = String(episode.hash || "").trim();
    const hashLabel = hashTitle.length > 36 ? `${hashTitle.slice(0, 36)}...` : hashTitle;
    return {
      sizeLabel,
      hashLabel,
      hashTitle,
    };
  };

  const downloadableEpisodes = useMemo(
    () => (project?.episodeDownloads || []).filter((episode) => (episode.sources || []).length > 0),
    [project?.episodeDownloads],
  );

  const lightNovelChapters = useMemo(
    () =>
      (project?.episodeDownloads || []).filter(
        (episode) =>
          (episode as { hasContent?: boolean }).hasContent ||
          (typeof episode.content === "string" && episode.content.trim().length > 0),
      ),
    [project?.episodeDownloads],
  );

  const sortedDownloadableEpisodes = useMemo(() => {
    return [...downloadableEpisodes].sort((a, b) => {
      const numberDelta = (a.number || 0) - (b.number || 0);
      if (numberDelta !== 0) {
        return numberDelta;
      }
      return (a.volume || 0) - (b.volume || 0);
    });
  }, [downloadableEpisodes]);

  const sortedLightNovelChapters = useMemo(() => {
    return [...lightNovelChapters].sort((a, b) => {
      const numberDelta = (a.number || 0) - (b.number || 0);
      if (numberDelta !== 0) {
        return numberDelta;
      }
      return (a.volume || 0) - (b.volume || 0);
    });
  }, [lightNovelChapters]);

  const filteredLightNovelChapters = sortedLightNovelChapters;

  const visibleRelations = useMemo(() => {
    if (!project?.relations?.length) {
      return [];
    }
    const ids = new Set(projectDirectory.map((item) => String(item.id)));
    return project.relations.filter((relation) => {
      const relationId = relation.projectId || (relation.anilistId ? String(relation.anilistId) : "");
      return relationId && ids.has(relationId);
    });
  }, [project?.relations, projectDirectory]);

  const projectType = project?.type || "";
  const isManga = isMangaType(projectType);
  const isLightNovel = isLightNovelType(projectType);
  const isChapterBased = isChapterBasedType(projectType);
  const canEditProject = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  type EpisodeItem = (typeof sortedDownloadableEpisodes)[number];

  const trackDownloadClick = (episode: EpisodeItem, sourceLabel: string) => {
    if (!project?.id) {
      return;
    }
    const chapterNumber = Number(episode.number);
    const volumeNumber = Number(episode.volume);
    const resourceId = `${project.id}:${Number.isFinite(chapterNumber) ? chapterNumber : 0}:${
      Number.isFinite(volumeNumber) ? volumeNumber : 0
    }`;
    const payload: {
      eventType: "download_click";
      resourceType: "chapter";
      resourceId: string;
      meta: {
        projectId: string;
        sourceLabel: string;
        chapterNumber?: number;
        volume?: number;
      };
    } = {
      eventType: "download_click",
      resourceType: "chapter",
      resourceId,
      meta: {
        projectId: project.id,
        sourceLabel: String(sourceLabel || "").trim(),
      },
    };
    if (Number.isFinite(chapterNumber)) {
      payload.meta.chapterNumber = chapterNumber;
    }
    if (Number.isFinite(volumeNumber)) {
      payload.meta.volume = volumeNumber;
    }
    void apiFetch(apiBase, "/api/public/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const renderEpisodeDownloadCard = (episode: EpisodeItem, key: string, showRawBadge: boolean) => {
    const { sizeLabel, hashLabel, hashTitle } = buildEpisodeMetadata(episode);

    return (
      <Card
        key={key}
        className="group w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-card shadow-[0_24px_90px_-55px_rgba(0,0,0,0.75)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_28px_100px_-50px_rgba(0,0,0,0.85)] md:h-[185px] md:w-[920px]"
      >
        <CardContent className="relative grid h-full gap-4 p-4 md:grid-cols-[272px_minmax(0,1fr)] md:items-start md:gap-4 md:p-4">
          {showRawBadge ? (
            <Badge
              variant="outline"
              className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border-primary/25 bg-background/70 text-[10px] uppercase tracking-wide"
            >
              <HardDrive className="h-3 w-3" />
              {episode.sourceType}
            </Badge>
          ) : null}
          <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-background/50 shadow-inner md:h-[153px] md:w-[272px]">
            <img
              src={episode.coverImageUrl || project.banner || project.cover || "/placeholder.svg"}
              alt={`Preview de ${episode.title}`}
              className="h-full w-full aspect-video object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
          <div className="relative h-full min-h-[153px] md:pr-0">
            <div className="space-y-2.5 pb-12 md:pb-[52px]">
              <div className="flex min-w-0 items-center gap-2 pr-20">
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase">
                  {isManga
                    ? `Cap ${episode.number}${episode.volume ? ` • Vol. ${episode.volume}` : ""}`
                    : `EP ${episode.number}`}
                </Badge>
                <p className="truncate text-base font-semibold text-foreground md:text-lg">{episode.title}</p>
              </div>
              <div className="flex flex-col items-start gap-1.5 text-xs text-muted-foreground">
                {episode.duration ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium text-foreground/90">Duração:</span>
                    {episode.duration}
                  </span>
                ) : null}
                {episode.releaseDate ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium text-foreground/90">Data:</span>
                    {formatDate(episode.releaseDate)}
                  </span>
                ) : null}
                {sizeLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium text-foreground/90">Tamanho:</span>
                    {sizeLabel}
                  </span>
                ) : null}
                {hashTitle ? (
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <span className="shrink-0 font-medium text-foreground/90">Hash:</span>
                    <span className="max-w-[260px] truncate" title={hashTitle}>
                      {hashLabel}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 md:absolute md:-bottom-2 md:left-0 md:right-0">
              {episode.sources.map((source, sourceIndex) => {
                const theme = sourceThemeMap.get(source.label.toLowerCase());
                const color = theme?.color || "#4b5563";
                const icon = renderSourceIcon(
                  theme?.icon,
                  color,
                  source.label,
                  theme?.tintIcon ?? true,
                );
                return (
                  <Button
                    key={`${key}-${source.label}-${sourceIndex}`}
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full bg-card/70 px-4 text-sm hover:bg-primary/10"
                    style={{ borderColor: `${color}99`, color }}
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2"
                      onClick={() => trackDownloadClick(episode, source.label)}
                    >
                      {icon}
                      {source.label}
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const volumeGroups = useMemo(() => {
    const groups = new Map<string, { label: string; volume?: number; items: EpisodeItem[] }>();
    const allItems = isLightNovel ? sortedLightNovelChapters : sortedDownloadableEpisodes;
    allItems.forEach((item) => {
      const volumeKey = typeof item.volume === "number" && !Number.isNaN(item.volume) ? String(item.volume) : "none";
      if (!groups.has(volumeKey)) {
        groups.set(volumeKey, {
          label: volumeKey === "none" ? "Sem volume" : `Volume ${volumeKey}`,
          volume: volumeKey === "none" ? undefined : Number(volumeKey),
          items: [],
        });
      }
      groups.get(volumeKey)?.items.push(item);
    });
    const entries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "none") return 1;
      if (b[0] === "none") return -1;
      return Number(a[0]) - Number(b[0]);
    });
    return entries.map(([, value]) => value);
  }, [isLightNovel, sortedDownloadableEpisodes, sortedLightNovelChapters]);

  const filteredDownloadableEpisodes = useMemo(() => {
    if (!isChapterBased) {
      return sortedDownloadableEpisodes;
    }
    return sortedDownloadableEpisodes;
  }, [isChapterBased, sortedDownloadableEpisodes]);

  useEffect(() => {
    setEpisodePage(1);
  }, [project?.id]);

  const episodesPerPage = 24;
  const totalEpisodePages = Math.max(1, Math.ceil(filteredDownloadableEpisodes.length / episodesPerPage));
  const episodePageStart = (episodePage - 1) * episodesPerPage;
  const paginatedEpisodes = filteredDownloadableEpisodes.slice(
    episodePageStart,
    episodePageStart + episodesPerPage,
  );

  const relationProjectIds = useMemo(() => {
    const map = new Map<string, string>();
    projectDirectory.forEach((item) => {
      if (item.anilistId) {
        map.set(String(item.anilistId), item.id);
      }
      map.set(String(item.id), item.id);
    });
    return map;
  }, [projectDirectory]);

  const handleCopyLink = async () => {
    if (!project) {
      return;
    }
    const url = `${window.location.origin}/projeto/${project.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  if (!slug || (!project && hasLoaded)) {
    return <NotFound />;
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${project.banner})` }}
          />
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-linear-to-t from-background/85 via-background/45 to-transparent" />

          <div className="relative mx-auto flex min-h-[420px] w-full max-w-6xl flex-col items-center gap-8 px-6 pb-16 pt-24 md:flex-row md:items-center md:px-10 lg:min-h-[520px] reveal" data-reveal>
            <div className="mx-auto w-52 shrink-0 overflow-hidden rounded-2xl bg-secondary shadow-2xl animate-slide-up opacity-0 md:mx-0 md:w-64">
              <img
                src={project.cover}
                alt={project.title}
                className="h-auto w-full object-contain"
              />
            </div>
            <div className="flex w-full flex-1 flex-col items-center gap-4 text-center md:items-start md:text-left">
              <div className="flex w-full flex-wrap items-center justify-center gap-3 text-center text-xs uppercase tracking-[0.2em] text-primary/80 animate-fade-in md:w-auto md:justify-start md:text-left">
                <span>{project.type}</span>
                <span className="text-muted-foreground">•</span>
                <span>{project.status}</span>
              </div>
              <h1 className="text-center text-3xl font-semibold text-foreground md:text-left md:text-4xl lg:text-5xl animate-slide-up">
                {project.title}
              </h1>
              <p
                className="max-w-2xl text-center text-sm text-muted-foreground md:text-left md:text-base animate-slide-up opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                {project.synopsis}
              </p>
              {project.tags?.length ? (
                <div className="flex w-full flex-wrap justify-center gap-2 animate-slide-up opacity-0 md:justify-start" style={{ animationDelay: "0.3s" }}>
                  {sortedTags.map((tag) => (
                    <Link key={tag} to={`/projetos?tag=${encodeURIComponent(tag)}`} className="inline-flex">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {translateTag(tag, tagTranslationMap)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="flex w-full flex-wrap justify-center gap-3 animate-slide-up opacity-0 md:justify-start" style={{ animationDelay: "0.4s" }}>
                <Button asChild className="gap-2">
                  <a href="#downloads">
                    <Download className="h-4 w-4" />
                    {isChapterBased ? "Ver capítulos" : "Ver episódios"}
                  </a>
                </Button>
                {project.trailerUrl ? (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={project.trailerUrl} target="_blank" rel="noreferrer">
                      <PlayCircle className="h-4 w-4" />
                      Assistir trailer
                    </a>
                  </Button>
                ) : null}
                {canEditProject ? (
                  <Button asChild variant="secondary" className="gap-2">
                    <Link to={`/dashboard/projetos?edit=${encodeURIComponent(project.id)}`}>
                      Editar projeto
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-12 md:px-10 reveal" data-reveal>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <Card className="border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      {isChapterBased ? (
                        <BookOpen className="h-4 w-4 text-primary" />
                      ) : (
                        <Film className="h-4 w-4 text-primary" />
                      )}
                      Sobre o projeto
                    </div>
                  {project.genres?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {sortedGenres.map((genre) => (
                        <Link key={genre} to={`/projetos?genero=${encodeURIComponent(genre)}`} className="inline-flex">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {translateGenre(genre, genreTranslationMap)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {projectDetails.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {projectDetails.map((detail) => (
                        <div key={detail.label} className="rounded-xl border border-border/50 bg-background/60 px-4 py-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {detail.label}
                          </span>
                          <p className="mt-1 text-sm font-semibold text-foreground">{detail.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {visibleRelations.length > 0 ? (
                <Card className="border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Relacionados
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {visibleRelations.map((relation) => {
                        const relationId = relation.projectId || (relation.anilistId ? String(relation.anilistId) : "");
                        const projectId = relationProjectIds.get(relationId);
                        const targetId = projectId || relationId;
                        return (
                          <Link
                            key={`${relation.relation}-${relation.title}`}
                            to={targetId ? `/projeto/${targetId}` : "#"}
                            className="group flex gap-4 rounded-xl border border-border/50 bg-background/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-background/80 hover:shadow-lg"
                          >
                            <div className="w-16 shrink-0 overflow-hidden rounded-lg bg-secondary aspect-2/3">
                              <img
                                src={relation.image}
                                alt={relation.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                                {translateRelation(relation.relation)}
                              </p>
                              <p className="text-sm font-semibold text-foreground transition group-hover:text-primary">
                                {relation.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {relation.format} • {relation.status}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              {project.staff?.length ? (
                <Card className="border-border/60 bg-card/70 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Equipe da fansub
                    </div>
                    <div className="space-y-3">
                      {project.staff.map((staff) => (
                        <div
                          key={staff.role}
                          className="rounded-xl border border-border/50 bg-background/60 px-4 py-3"
                        >
                          <p className="block text-xs font-semibold uppercase tracking-widest text-primary/80">
                            {staff.role}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{staff.members.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {project.animeStaff?.length ? (
                <Card className="border-border/60 bg-card/70 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Staff do anime
                    </div>
                    <div className="space-y-3">
                      {project.animeStaff.map((staff) => (
                        <div
                          key={staff.role}
                          className="rounded-xl border border-border/50 bg-background/60 px-4 py-3"
                        >
                          <p className="block text-xs font-semibold uppercase tracking-widest text-primary/80">
                            {translateAnilistRole(staff.role, staffRoleTranslationMap)}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{staff.members.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </section>

        <section
          id="downloads"
          className="mx-auto w-full max-w-6xl px-6 pb-20 pt-4 md:px-10 reveal"
          data-reveal
        >
          <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {isChapterBased ? "Capítulos" : "Downloads"}
                  </h2>
                <p className="text-sm text-muted-foreground">
                  {isLightNovel
                    ? "Leia os capítulos disponíveis diretamente no site."
                    : isManga
                    ? "Selecione um capítulo disponível para download."
                    : "Selecione uma fonte de download para cada item disponível."}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs uppercase">
                {isLightNovel ? filteredLightNovelChapters.length : filteredDownloadableEpisodes.length} disponíveis
              </Badge>
            </div>

            {isLightNovel ? (
              filteredLightNovelChapters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                  Nenhum capítulo publicado ainda.
                </div>
              ) : (
                <div className="grid gap-6">
                  {volumeGroups.map((group) => (
                    <Card key={group.label} className="border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                      <CardContent className="space-y-4 p-6">
                        <Accordion type="multiple" defaultValue={[group.label]}>
                          <AccordionItem value={group.label} className="border-none">
                            <AccordionTrigger className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm font-semibold text-foreground hover:no-underline">
                              <div className="flex w-full items-center justify-between gap-4">
                                <span>{group.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {group.items.length} capítulos
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4">
                              <div className="grid gap-4">
                            {group.items.map((chapter) => {
                              const hasContent =
                                (chapter as { hasContent?: boolean }).hasContent ||
                                (typeof chapter.content === "string" && chapter.content.trim().length > 0);
                              const search = chapter.volume ? `?volume=${chapter.volume}` : "";
                              return (
                                <Card
                                  key={`${chapter.number}-${chapter.volume || 0}`}
                                  className="border-border/60 bg-background/60 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-background/80 hover:shadow-lg"
                                >
                                  <CardContent className="space-y-3 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                      <div className="space-y-1">
                                        <Badge variant="secondary" className="text-xs uppercase">
                                          Cap {chapter.number}
                                          {chapter.volume ? ` • Vol. ${chapter.volume}` : ""}
                                        </Badge>
                                        <p className="text-base font-semibold text-foreground">
                                          {chapter.title || "Capítulo"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {hasContent ? (
                                          <Button asChild size="sm">
                                            <Link
                                              to={`/projeto/${project.id}/leitura/${chapter.number}${search}`}
                                            >
                                              Ler capítulo
                                            </Link>
                                          </Button>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] uppercase">
                                            Em breve
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {chapter.synopsis ? (
                                      <p className="text-sm text-muted-foreground">{chapter.synopsis}</p>
                                    ) : null}
                                  </CardContent>
                                </Card>
                              );
                            })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : filteredDownloadableEpisodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                Este projeto ainda está em produção. Assim que os episódios forem lançados, os
                downloads aparecerão aqui.
              </div>
            ) : (
              <div className="grid gap-6 justify-items-center">
                {isManga
                  ? volumeGroups.map((group) => (
                      <Card key={group.label} className="border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
                        <CardContent className="space-y-4 p-6">
                          <Accordion type="multiple" defaultValue={[group.label]}>
                            <AccordionItem value={group.label} className="border-none">
                              <AccordionTrigger className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm font-semibold text-foreground hover:no-underline">
                                <div className="flex w-full items-center justify-between gap-4">
                                  <span>{group.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {group.items.length} capítulos
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-4">
                                <div className="grid gap-6 justify-items-center">
                                  {group.items.map((episode) =>
                                    renderEpisodeDownloadCard(
                                      episode,
                                      `${episode.number}-${episode.volume || 0}`,
                                      false,
                                    ),
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
                      </Card>
                    ))
                  : paginatedEpisodes.map((episode) =>
                      renderEpisodeDownloadCard(episode, String(episode.number), true),
                    )}
              </div>
            )}

            {!isChapterBased && totalEpisodePages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={episodePage === 1}
                  onClick={() => setEpisodePage((page) => Math.max(1, page - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {episodePage} de {totalEpisodePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={episodePage === totalEpisodePages}
                  onClick={() => setEpisodePage((page) => Math.min(totalEpisodePages, page + 1))}
                >
                  Próxima
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10 reveal" data-reveal>
          <div className="grid gap-6">
            <Card className="border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Compartilhar</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="h-4 w-4 text-primary/70" aria-hidden="true" />
                  Copie o link para compartilhar este projeto.
                </div>
                <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                  Copiar link
                </Button>
              </CardContent>
            </Card>

            <CommentsSection targetType="project" targetId={project.id} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProjectPage;










