import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Cloud,
  Download,
  Film,
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
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getApiBase } from "@/lib/api-base";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { formatDate } from "@/lib/date";
import { apiFetch } from "@/lib/api-client";
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
          }
        }
      } catch {
        if (isActive) {
          setProjectDirectory([]);
          setTagTranslations({});
          setGenreTranslations({});
        }
      }
    };

    loadMeta();
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

  const sortedTags = useMemo(() => {
    const tags = Array.isArray(project?.tags) ? [...project.tags] : [];
    return tags.sort((a, b) =>
      (tagTranslations[a] || a).localeCompare(tagTranslations[b] || b, "pt-BR"),
    );
  }, [project?.tags, tagTranslations]);

  const sortedGenres = useMemo(() => {
    const genres = Array.isArray(project?.genres) ? [...project.genres] : [];
    return genres.sort((a, b) =>
      (genreTranslations[a] || a).localeCompare(genreTranslations[b] || b, "pt-BR"),
    );
  }, [project?.genres, genreTranslations]);

  const anilistRoleMap = useMemo(() => {
    const entries: Array<[string, string]> = [
      ["director", "Direção"],
      ["chief director", "Diretor chefe"],
      ["assistant director", "Direção assistente"],
      ["action director", "Direção de ação"],
      ["series composition", "Composição de série"],
      ["script", "Roteiro"],
      ["storyboard", "Storyboard"],
      ["story", "História"],
      ["episode director", "Direção de episódio"],
      ["original story", "História original"],
      ["original creator", "Autor original"],
      ["original work assistance", "Assistência de obra original"],
      ["character design", "Design de personagens"],
      ["original character design", "Design original de personagens"],
      ["original character design assistance", "Assistência de design original de personagens"],
      ["chief character design", "Design-chefe de personagens"],
      ["animation director", "Direção de animação"],
      ["main animator", "Animador principal"],
      ["chief animation director", "Direção-chefe de animação"],
      ["key animation", "Animação-chave"],
      ["in-between animation", "Intercalação"],
      ["art director", "Direção de arte"],
      ["art design", "Design de arte"],
      ["background art", "Arte de fundo"],
      ["color design", "Design de cor"],
      ["color coordinator", "Coordenação de cor"],
      ["director of photography", "Direção de fotografia"],
      ["photography director", "Direção de fotografia"],
      ["editing", "Edição"],
      ["music", "Música"],
      ["sound director", "Direção de som"],
      ["sound effects", "Efeitos sonoros"],
      ["sound design", "Design de som"],
      ["theme song performance", "Performance da música tema"],
      ["theme song performance (op)", "Performance da música tema (OP)"],
      ["theme song performance (ed)", "Performance da música tema (ED)"],
      ["producer", "Produção"],
      ["assistant producer", "Produção assistente"],
      ["production", "Produção"],
      ["production assistant", "Assistência de produção"],
      ["3d director", "Direção 3D"],
      ["3d animation", "Animação 3D"],
      ["3d modeling", "Modelagem 3D"],
      ["cg director", "Direção de CG"],
      ["mechanical design", "Design mecânico"],
      ["prop design", "Design de props"],
      ["design assistance", "Assistência de design"],
      ["title logo design", "Design do logo do título"],
      ["design works", "Design works"],
      ["layout", "Layout"],
      ["literary arts", "Artes literárias"],
      ["special effects", "Efeitos especiais"],
      ["cg", "CG"],
      ["design", "Design"],
      ["casting", "Casting"],
      ["supervisor", "Supervisor"],
      ["creative producer", "Produção criativa"],
      ["illustration", "Ilustração"],
    ];
    return new Map(entries);
  }, []);

  const translateAnilistRole = (role: string) => {
    const normalized = String(role || "").trim();
    if (!normalized) {
      return role;
    }
    return anilistRoleMap.get(normalized.toLowerCase()) || role;
  };

  const sourceThemeMap = useMemo(() => {
    const map = new Map<string, { color: string; icon?: string }>();
    settings.downloads.sources.forEach((source) => {
      if (!source?.label) {
        return;
      }
      map.set(source.label.toLowerCase(), {
        color: source.color || "#7C3AED",
        icon: source.icon,
      });
    });
    return map;
  }, [settings.downloads.sources]);

  const renderSourceIcon = (iconKey: string | undefined, color: string) => {
    if (
      iconKey &&
      (iconKey.startsWith("http") || iconKey.startsWith("data:") || iconKey.startsWith("/uploads/"))
    ) {
      return <img src={iconKey} alt="" className="h-4 w-4" />;
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
  type EpisodeItem = (typeof sortedDownloadableEpisodes)[number];

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
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          <div className="relative mx-auto flex min-h-[420px] w-full max-w-6xl flex-col items-start gap-8 px-6 pb-16 pt-24 md:flex-row md:items-center md:px-10 lg:min-h-[520px]">
            <div className="w-52 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary shadow-2xl md:w-64">
              <img
                src={project.cover}
                alt={project.title}
                className="h-full w-full object-cover aspect-[23/32]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary/80">
                <span>{project.type}</span>
                <span className="text-muted-foreground">•</span>
                <span>{project.status}</span>
              </div>
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl lg:text-5xl">
                {project.title}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                {project.synopsis}
              </p>
              {project.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {sortedTags.map((tag) => (
                    <Link key={tag} to={`/projetos?tag=${encodeURIComponent(tag)}`} className="inline-flex">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {tagTranslations[tag] || tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
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
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-12 md:px-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <Card className="border-border/60 bg-card/80 shadow-lg">
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      {isChapterBased ? (
                        <BookOpen className="h-4 w-4 text-primary" />
                      ) : (
                        <Film className="h-4 w-4 text-primary" />
                      )}
                      Sobre o projeto
                    </div>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {project.description}
                  </p>
                  {project.genres?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {sortedGenres.map((genre) => (
                        <Link key={genre} to={`/projetos?genero=${encodeURIComponent(genre)}`} className="inline-flex">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {genreTranslations[genre] || genre}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {projectDetails.length ? (
                    <>
                      <Separator className="bg-border/60" />
                      <div className="grid gap-4 md:grid-cols-2">
                        {projectDetails.map((detail) => (
                          <div key={detail.label} className="rounded-xl border border-border/50 bg-background/60 p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              {detail.label}
                            </span>
                            <p className="mt-2 text-sm font-semibold text-foreground">{detail.value}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              {visibleRelations.length > 0 ? (
                <Card className="border-border/60 bg-card/80 shadow-lg">
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
                            className="group flex gap-4 rounded-xl border border-border/50 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-background/80"
                          >
                            <div className="w-16 flex-shrink-0 overflow-hidden rounded-lg bg-secondary aspect-[2/3]">
                              <img
                                src={relation.image}
                                alt={relation.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                                {relation.relation}
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
                <Card className="border-border/60 bg-card/70 shadow-md">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Equipe da fansub
                    </div>
                    <div className="space-y-3">
                      {project.staff.map((staff) => (
                        <div
                          key={staff.role}
                          className="rounded-xl border border-border/50 bg-background/60 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                            {staff.role}
                          </p>
                          <p className="mt-2 text-sm text-foreground">{staff.members.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {project.animeStaff?.length ? (
                <Card className="border-border/60 bg-card/70 shadow-md">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Staff do anime
                    </div>
                    <div className="space-y-3">
                      {project.animeStaff.map((staff) => (
                        <div
                          key={staff.role}
                          className="rounded-xl border border-border/50 bg-background/60 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                            {translateAnilistRole(staff.role)}
                          </p>
                          <p className="mt-2 text-sm text-foreground">{staff.members.join(", ")}</p>
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
          className="mx-auto w-full max-w-6xl px-6 pb-20 pt-4 md:px-10"
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
                    <Card key={group.label} className="border-border/60 bg-card/80 shadow-lg">
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
                                  className="border-border/60 bg-background/60"
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
              <div className="grid gap-6">
                {isManga
                  ? volumeGroups.map((group) => (
                      <Card key={group.label} className="border-border/60 bg-card/80 shadow-lg">
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
                                <div className="grid gap-6">
                                  {group.items.map((episode) => (
                                <Card
                                  key={`${episode.number}-${episode.volume || 0}`}
                                  className="border-border/60 bg-background/60 shadow-lg transition hover:border-primary/40"
                                >
                                  <CardContent className="relative grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)]">
                                    <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm">
                                      <img
                                        src={episode.coverImageUrl || project.banner || project.cover || "/placeholder.svg"}
                                        alt={`Preview de ${episode.title}`}
                                        className="aspect-[16/9] w-full object-cover"
                                      />
                                    </div>
                                    <div className="flex h-full flex-col gap-4 md:min-h-[135px]">
                                      <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                          <Badge variant="secondary" className="text-xs uppercase">
                                            {`Cap ${episode.number}${
                                              episode.volume ? ` • Vol. ${episode.volume}` : ""
                                            }`}
                                          </Badge>
                                          <p className="text-lg font-semibold text-foreground">
                                            {episode.title}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                          <span>{episode.duration}</span>
                                          <span>
                                            <CalendarDays className="mr-1 inline h-3 w-3 text-primary/70" />
                                            {formatDate(episode.releaseDate)}
                                          </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{episode.synopsis}</p>
                                      </div>
                                      <div className="mt-auto flex flex-wrap gap-2 md:justify-end md:self-end">
                                        {episode.sources.map((source, sourceIndex) => {
                                          const theme = sourceThemeMap.get(source.label.toLowerCase());
                                          const color = theme?.color || "#7C3AED";
                                          const icon = renderSourceIcon(theme?.icon, color);
                                          return (
                                            <Button
                                              key={`${source.label}-${sourceIndex}`}
                                              asChild
                                              variant="outline"
                                              size="sm"
                                              className="bg-black/35 hover:bg-white/5"
                                              style={{ borderColor: `${color}99`, color }}
                                            >
                                              <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2"
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
                              ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
                      </Card>
                    ))
                  : paginatedEpisodes.map((episode) => (
                      <Card
                        key={episode.number}
                        className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                      >
                        <CardContent className="relative grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)]">
                          {!isManga ? (
                            <Badge className="absolute right-6 top-6 text-[10px] uppercase">
                              RAW {episode.sourceType}
                            </Badge>
                          ) : null}
                          <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50 shadow-sm">
                            <img
                              src={episode.coverImageUrl || project.banner || project.cover || "/placeholder.svg"}
                              alt={`Preview de ${episode.title}`}
                              className="aspect-[16/9] w-full object-cover"
                            />
                          </div>
                          <div className="flex h-full flex-col gap-4 md:min-h-[135px]">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="secondary" className="text-xs uppercase">
                                  {`EP ${episode.number}`}
                                </Badge>
                                <p className="text-lg font-semibold text-foreground">{episode.title}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>{episode.duration}</span>
                                <span>
                                  <CalendarDays className="mr-1 inline h-3 w-3 text-primary/70" />
                                  {formatDate(episode.releaseDate)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{episode.synopsis}</p>
                            </div>
                            <div className="mt-auto flex flex-wrap gap-2 md:justify-end md:self-end">
                              {episode.sources.map((source, sourceIndex) => {
                                const theme = sourceThemeMap.get(source.label.toLowerCase());
                                const color = theme?.color || "#7C3AED";
                                const icon = renderSourceIcon(theme?.icon, color);
                                return (
                                  <Button
                                    key={`${source.label}-${sourceIndex}`}
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="bg-black/35 hover:bg-white/5"
                                    style={{ borderColor: `${color}99`, color }}
                                  >
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2"
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
                    ))}
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

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10">
          <div className="grid gap-6">
            <Card className="border-border bg-card">
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






