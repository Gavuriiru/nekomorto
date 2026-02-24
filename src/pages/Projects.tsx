import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AsyncState from "@/components/ui/async-state";
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
const PROJECTS_LIST_STATE_STORAGE_KEY = "public.projects.list-state.v1";

type PersistedProjectsListState = {
  letter?: string;
  type?: string;
  tag?: string;
  genre?: string;
  page?: number;
};

const readPersistedProjectsListState = (): PersistedProjectsListState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const rawValue = window.localStorage.getItem(PROJECTS_LIST_STATE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as PersistedProjectsListState;
  } catch {
    return null;
  }
};

const writePersistedProjectsListState = (value: PersistedProjectsListState) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PROJECTS_LIST_STATE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore persistence failures.
  }
};

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
      className="group flex h-50 w-full items-start gap-5 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-[0_28px_120px_-60px_rgba(0,0,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-60"
    >
      <div className="h-39 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary shadow-inner md:h-50 md:w-36">
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
            <div ref={badgesRowRef} className="hidden min-w-0 flex-nowrap items-center gap-1 overflow-hidden sm:flex">
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
                  className="inline-flex h-5 w-9 shrink-0 justify-center whitespace-nowrap px-2 text-[9px] uppercase leading-none"
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
                className="hidden shrink-0 max-w-36 rounded-full bg-background/50 px-3 py-1 truncate lg:inline-flex lg:max-w-48"
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
  const apiBase = getApiBase();
  const hasMountedRef = useRef(false);
  const hasRestoredListStateRef = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [hasProjectsLoadError, setHasProjectsLoadError] = useState(false);
  const [projectsLoadVersion, setProjectsLoadVersion] = useState(0);
  const [shareImage, setShareImage] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("Todas");
  const [selectedType, setSelectedType] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const projectsPerPage = 16;
  const selectedTag = searchParams.get("tag") || "Todas";
  const selectedGenre = searchParams.get("genero") || searchParams.get("genre") || "Todos";

  usePageMeta({ title: "Projetos", image: shareImage || undefined });

  useEffect(() => {
    let isActive = true;
    const loadPages = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setShareImage(String(data?.pages?.projects?.shareImage || "").trim());
        }
      } catch {
        // ignore
      }
    };
    loadPages();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (isActive) {
        setIsLoadingProjects(true);
        setHasProjectsLoadError(false);
      }
      try {
        const response = await apiFetch(apiBase, "/api/public/projects");
        if (!response.ok) {
          if (isActive) {
            setProjects([]);
            setHasProjectsLoadError(true);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
          setHasProjectsLoadError(false);
        }
      } catch {
        if (isActive) {
          setProjects([]);
          setHasProjectsLoadError(true);
        }
      } finally {
        if (isActive) {
          setIsLoadingProjects(false);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, projectsLoadVersion]);

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
    const legacyGenre = searchParams.get("genre");
    if (!legacyGenre) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (!searchParams.get("genero")) {
      nextParams.set("genero", legacyGenre);
    }
    nextParams.delete("genre");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const updateFilterQuery = useCallback((tag: string, genre: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tag === "Todas") {
      nextParams.delete("tag");
    } else {
      nextParams.set("tag", tag);
    }

    if (genre === "Todos") {
      nextParams.delete("genero");
      nextParams.delete("genre");
    } else {
      nextParams.set("genero", genre);
      nextParams.delete("genre");
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (hasRestoredListStateRef.current) {
      return;
    }
    const legacyGenre = searchParams.get("genre");
    if (legacyGenre && !searchParams.get("genero")) {
      return;
    }
    hasRestoredListStateRef.current = true;
    const persisted = readPersistedProjectsListState();
    if (!persisted) {
      return;
    }
    if (typeof persisted.letter === "string" && persisted.letter.trim()) {
      setSelectedLetter(persisted.letter.trim());
    }
    if (typeof persisted.type === "string" && persisted.type.trim()) {
      setSelectedType(persisted.type.trim());
    }
    const persistedPage = Number(persisted.page);
    if (Number.isFinite(persistedPage) && persistedPage >= 1) {
      setCurrentPage(Math.floor(persistedPage));
    }
    const hasTagInQuery = Boolean(searchParams.get("tag"));
    const hasGenreInQuery = Boolean(searchParams.get("genero"));
    const nextTag = !hasTagInQuery && typeof persisted.tag === "string" ? persisted.tag : selectedTag;
    const nextGenre = !hasGenreInQuery && typeof persisted.genre === "string" ? persisted.genre : selectedGenre;
    if (!hasTagInQuery || !hasGenreInQuery) {
      updateFilterQuery(nextTag || "Todas", nextGenre || "Todos");
    }
  }, [searchParams, selectedGenre, selectedTag, updateFilterQuery]);

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
  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    writePersistedProjectsListState({
      letter: selectedLetter,
      type: selectedType,
      tag: selectedTag,
      genre: selectedGenre,
      page: currentPage,
    });
  }, [currentPage, selectedGenre, selectedLetter, selectedTag, selectedType]);

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
    setSelectedLetter("Todas");
    setSelectedType("Todos");
    updateFilterQuery("Todas", "Todos");
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
      <main className="pt-28">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10 reveal" data-reveal>
          <div className="grid gap-4 rounded-2xl bg-card/70 p-6 shadow-lg md:grid-cols-4">
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
              <Select value={selectedTag} onValueChange={(value) => updateFilterQuery(value, selectedGenre)}>
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
              <Select value={selectedGenre} onValueChange={(value) => updateFilterQuery(selectedTag, value)}>
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
          {isLoadingProjects ? (
            <AsyncState
              kind="loading"
              title="Carregando projetos"
              description="Estamos buscando os projetos publicados."
              className="mt-10"
            />
          ) : hasProjectsLoadError ? (
            <AsyncState
              kind="error"
              title="Nao foi possivel carregar os projetos"
              description="Verifique sua conexao e tente novamente."
              className="mt-10"
              action={
                <Button
                  variant="outline"
                  onClick={() => setProjectsLoadVersion((current) => current + 1)}
                >
                  Tentar novamente
                </Button>
              }
            />
          ) : paginatedProjects.length === 0 ? (
            <AsyncState
              kind="empty"
              title="Nenhum projeto encontrado"
              description="Ajuste os filtros para ampliar os resultados."
              className="mt-10"
              action={
                <Button variant="ghost" onClick={resetFilters} className="text-xs uppercase">
                  Limpar filtros
                </Button>
              }
            />
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

          {!isLoadingProjects && !hasProjectsLoadError && filteredProjects.length > projectsPerPage && (
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


























