import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/data/projects";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { prepareProjectBadges } from "@/lib/project-card-layout";
import { cn } from "@/lib/utils";

const alphabetOptions = ["Todas", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

type ProjectCardProps = {
  project: Project;
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
  synopsisClampClass: string;
};

const ProjectCard = ({
  project,
  tagTranslations,
  genreTranslations,
  navigate,
  synopsisClampClass,
}: ProjectCardProps) => {
  const [badgesRowWidth, setBadgesRowWidth] = useState(0);
  const [badgeWidths, setBadgeWidths] = useState<Record<string, number>>({});
  const badgesRowRef = useRef<HTMLDivElement | null>(null);
  const badgeMeasureRef = useRef<HTMLDivElement | null>(null);
  const { allItems, visibleItems, extraCount, showOverflowBadge } = useMemo(
    () =>
      prepareProjectBadges({
        tags: project.tags,
        genres: project.genres || [],
        producers: project.producers || [],
        tagTranslations,
        genreTranslations,
        maxVisible: 3,
        maxChars: 18,
        maxRowWidth: badgesRowWidth,
        badgeWidths,
        overflowBadgeWidth: 36,
        gapPx: 4,
      }),
    [
      badgeWidths,
      badgesRowWidth,
      genreTranslations,
      project.genres,
      project.producers,
      project.tags,
      tagTranslations,
    ],
  );

  useEffect(() => {
    const rowNode = badgesRowRef.current;
    if (!rowNode) {
      setBadgesRowWidth(0);
      return;
    }

    const updateWidth = () => setBadgesRowWidth(rowNode.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(rowNode);
    return () => observer.disconnect();
  }, [allItems.length, project.id]);

  useEffect(() => {
    const measureNode = badgeMeasureRef.current;
    if (!measureNode || allItems.length === 0) {
      setBadgeWidths({});
      return;
    }

    const nextWidths: Record<string, number> = {};
    const nodes = measureNode.querySelectorAll<HTMLElement>("[data-badge-key]");
    nodes.forEach((node) => {
      const key = node.dataset.badgeKey;
      if (key) {
        nextWidths[key] = node.offsetWidth;
      }
    });

    setBadgeWidths((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextWidths);
      if (currentKeys.length !== nextKeys.length) {
        return nextWidths;
      }
      for (const key of nextKeys) {
        if (current[key] !== nextWidths[key]) {
          return nextWidths;
        }
      }
      return current;
    });
  }, [allItems]);

  return (
    <Link
      to={`/projeto/${project.id}`}
      className="group flex min-h-[12.5rem] w-full items-start gap-5 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-[0_28px_120px_-60px_rgba(0,0,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg md:h-[15rem]"
    >
      <div className="h-[9.75rem] w-28 flex-shrink-0 overflow-hidden rounded-xl bg-secondary shadow-inner md:h-[12.5rem] md:w-36">
        <img
          src={project.cover}
          alt={project.title}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div
        data-synopsis-role="column"
        data-synopsis-key={project.id}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div data-synopsis-role="title" className="shrink-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 transition-colors duration-300 group-hover:text-primary">
            {project.type}
          </p>
          <h2 className="line-clamp-2 text-xl font-semibold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary md:text-2xl">
            {project.title}
          </h2>
        </div>

        <p
          data-synopsis-role="synopsis"
          className={cn(
            "mt-2 overflow-hidden text-sm leading-snug text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80 break-normal hyphens-none",
            synopsisClampClass,
          )}
        >
          {project.synopsis}
        </p>

        <div data-synopsis-role="badges" className="relative mt-auto flex shrink-0 flex-col gap-2 pt-3">
          {visibleItems.length > 0 || extraCount > 0 ? (
            <div ref={badgesRowRef} className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
              {visibleItems.map((item) =>
                item.href ? (
                  <button
                    key={item.key}
                    type="button"
                    className="inline-flex shrink-0"
                    title={item.label}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      navigate(item.href);
                    }}
                  >
                    <Badge
                      variant={item.variant}
                      className="h-5 shrink-0 whitespace-nowrap px-2 text-[9px] uppercase leading-none"
                    >
                      {item.label}
                    </Badge>
                  </button>
                ) : (
                  <Badge
                    key={item.key}
                    variant={item.variant}
                    className="inline-flex h-5 shrink-0 whitespace-nowrap px-2 text-[9px] uppercase leading-none"
                    title={item.label}
                  >
                    {item.label}
                  </Badge>
                ),
              )}
              {showOverflowBadge ? (
                <Badge
                  key={`extra-${project.id}`}
                  variant="secondary"
                  className="inline-flex h-5 w-[2.25rem] shrink-0 justify-center whitespace-nowrap px-2 text-[9px] uppercase leading-none"
                  title={`+${extraCount} tags`}
                >
                  +{extraCount}
                </Badge>
              ) : null}
            </div>
          ) : null}
          <div
            ref={badgeMeasureRef}
            aria-hidden
            className="pointer-events-none absolute -left-[9999px] top-0 flex items-center gap-1 opacity-0"
          >
            {allItems.map((item) => (
              <Badge
                key={`measure-${item.key}`}
                data-badge-key={item.key}
                variant={item.variant}
                className="inline-flex h-5 shrink-0 whitespace-nowrap px-2 text-[9px] uppercase leading-none"
              >
                {item.label}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {project.status ? (
              <span className="shrink-0 rounded-full bg-background/50 px-3 py-1 truncate">{project.status}</span>
            ) : null}
            {project.studio ? (
              <span
                className="hidden shrink-0 max-w-[9rem] rounded-full bg-background/50 px-3 py-1 truncate lg:inline-flex lg:max-w-[12rem]"
                title={project.studio}
              >
                {project.studio}
              </span>
            ) : null}
            {project.episodes ? (
              <span className="hidden shrink-0 rounded-full bg-background/50 px-3 py-1 truncate xl:inline-flex">
                {project.episodes}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
};

const Projects = () => {
  usePageMeta({ title: "Projetos" });

  const apiBase = getApiBase();
  const hasMountedRef = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTag, setSelectedTag] = useState("Todas");
  const [selectedLetter, setSelectedLetter] = useState("Todas");
  const [selectedType, setSelectedType] = useState("Todos");
  const [selectedGenre, setSelectedGenre] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const projectsPerPage = 16;

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/projects");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch {
        if (isActive) {
          setProjects([]);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadTranslations = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setTagTranslations(data.tags || {});
          setGenreTranslations(data.genres || {});
        }
      } catch {
        if (isActive) {
          setTagTranslations({});
          setGenreTranslations({});
        }
      }
    };
    loadTranslations();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    const tag = searchParams.get("tag");
    const genre = searchParams.get("genero") || searchParams.get("genre");
    if (tag) {
      setSelectedTag(tag);
    }
    if (genre) {
      setSelectedGenre(genre);
    }
  }, [searchParams]);

  const tagOptions = useMemo(() => {
    const tags = projects.flatMap((project) => project.tags);
    const unique = Array.from(new Set(tags)).filter(Boolean);
    const sorted = unique.sort((a, b) =>
      (tagTranslations[a] || a).localeCompare(tagTranslations[b] || b, "pt-BR"),
    );
    return ["Todas", ...sorted];
  }, [projects, tagTranslations]);

  const genreOptions = useMemo(() => {
    const genres = projects.flatMap((project) => project.genres || []);
    const unique = Array.from(new Set(genres)).filter(Boolean);
    const sorted = unique.sort((a, b) =>
      (genreTranslations[a] || a).localeCompare(genreTranslations[b] || b, "pt-BR"),
    );
    return ["Todos", ...sorted];
  }, [projects, genreTranslations]);

  const typeOptions = useMemo(() => {
    const types = projects.map((project) => project.type).filter(Boolean);
    const unique = Array.from(new Set(types));
    const sorted = unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...sorted];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const matchesTag = selectedTag === "Todas" || project.tags.includes(selectedTag);
        const matchesType = selectedType === "Todos" || project.type === selectedType;
        const matchesLetter =
          selectedLetter === "Todas" || project.title.toUpperCase().startsWith(selectedLetter);
        const matchesGenre =
          selectedGenre === "Todos" || (project.genres || []).includes(selectedGenre);
        return matchesTag && matchesType && matchesLetter && matchesGenre;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [projects, selectedLetter, selectedTag, selectedType, selectedGenre]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLetter, selectedTag, selectedType, selectedGenre]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(pageStart, pageStart + projectsPerPage);
  const synopsisKeys = useMemo(() => paginatedProjects.map((project) => project.id), [paginatedProjects]);
  const { rootRef: listRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: paginatedProjects.length > 0,
    keys: synopsisKeys,
    maxLines: 4,
  });
  const getSynopsisClampClass = (projectId: string) => {
    const lines = lineByKey[projectId] ?? 2;
    if (lines <= 0) {
      return "hidden";
    }
    if (lines === 1) {
      return "line-clamp-1";
    }
    if (lines === 2) {
      return "line-clamp-2";
    }
    if (lines === 3) {
      return "line-clamp-3";
    }
    return "line-clamp-4";
  };

  const resetFilters = () => {
    setSelectedTag("Todas");
    setSelectedLetter("Todas");
    setSelectedType("Todos");
    setSelectedGenre("Todos");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
      <main className="pt-28">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10 reveal" data-reveal>
          <div className="grid gap-4 rounded-2xl bg-card/70 p-6 shadow-lg md:grid-cols-[repeat(4,minmax(0,1fr))]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                A-Z
              </span>
              <Select value={selectedLetter} onValueChange={setSelectedLetter}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="Todas as letras" />
                </SelectTrigger>
                <SelectContent>
                  {alphabetOptions.map((letter) => (
                    <SelectItem key={letter} value={letter}>
                      {letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tags
              </span>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="Todas as tags" />
                </SelectTrigger>
                <SelectContent>
                  {tagOptions.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tagTranslations[tag] || tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Gêneros
              </span>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="Todos os gêneros" />
                </SelectTrigger>
                <SelectContent>
                  {genreOptions.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genreTranslations[genre] || genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Formato
              </span>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="Todos os formatos" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/40 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                <span className="font-semibold text-foreground">{filteredProjects.length}</span>
                <span>projetos encontrados</span>
                <span className="hidden text-muted-foreground md:inline">&bull;</span>
                <span className="hidden md:inline">Atualizado semanalmente</span>
              </div>
              <Button variant="ghost" onClick={resetFilters} className="text-xs uppercase">
                Limpar filtros
              </Button>
            </div>
          </div>
          {paginatedProjects.length === 0 ? (
            <div className="mt-10 rounded-2xl bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhum projeto encontrado para os filtros selecionados.
            </div>
          ) : (
            <div ref={listRootRef} className="mt-10 grid gap-6 md:grid-cols-2 md:auto-rows-fr">
              {paginatedProjects.map((project, index) => {
                const isLastSingle =
                  paginatedProjects.length % 2 === 1 && index === paginatedProjects.length - 1;
                                const card = (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    tagTranslations={tagTranslations}
                    genreTranslations={genreTranslations}
                    navigate={navigate}
                    synopsisClampClass={getSynopsisClampClass(project.id)}
                  />
                );

                if (!isLastSingle) {
                  return card;
                }

                return (
                  <div key={project.id} className="md:col-span-2 flex justify-center">
                    <div className="w-full md:w-[calc(50%-0.75rem)]">{card}</div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProjects.length > projectsPerPage && (
            <div className="mt-12 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((page) => Math.max(1, page - 1));
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage(page);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((page) => Math.min(totalPages, page + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Projects;
























