import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const alphabetOptions = ["Todas", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

type ProjectCardProps = {
  project: Project;
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
};

const ProjectCard = ({ project, tagTranslations, genreTranslations, navigate }: ProjectCardProps) => {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [titleLines, setTitleLines] = useState(1);

  const updateTitleLines = useCallback(() => {
    const el = titleRef.current;
    if (!el) {
      return;
    }
    const styles = window.getComputedStyle(el);
    const fontSize = parseFloat(styles.fontSize || "16");
    const lineHeightValue =
      styles.lineHeight === "normal" ? fontSize * 1.25 : parseFloat(styles.lineHeight);
    const height = el.getBoundingClientRect().height;
    if (!lineHeightValue || !height) {
      return;
    }
    const lines = Math.max(1, Math.round(height / lineHeightValue));
    setTitleLines(lines);
  }, []);

  useLayoutEffect(() => {
    updateTitleLines();
    const el = titleRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => updateTitleLines());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateTitleLines]);

  const synopsisClampClass = titleLines >= 2 ? "line-clamp-1" : "line-clamp-2";

  return (
    <Link
      key={project.id}
      to={`/projeto/${project.id}`}
      className="group flex min-h-[12.5rem] w-full items-start gap-5 overflow-hidden rounded-2xl bg-gradient-card p-5 shadow-[0_28px_120px_-60px_rgba(0,0,0,0.55)] transition hover:shadow-[0_36px_150px_-70px_rgba(0,0,0,0.6),_0_0_28px_hsl(var(--accent)/0.24)] hover:brightness-105 md:h-[15rem]"
    >
      <div className="h-[9.75rem] w-28 flex-shrink-0 overflow-hidden rounded-xl bg-secondary shadow-inner md:h-[12.5rem] md:w-36">
        <img
          src={project.cover}
          alt={project.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">{project.type}</p>
          <h2
            ref={titleRef}
            className="text-xl font-semibold leading-snug text-foreground line-clamp-2 md:text-2xl"
          >
            {project.title}
          </h2>
          <p className={`mt-2 text-sm text-muted-foreground ${synopsisClampClass} break-normal hyphens-none`}>
            {project.synopsis}
          </p>
        </div>

        {project.tags.length > 0 || project.genres?.length || project.producers?.length ? (
          <div className="flex max-h-12 flex-wrap gap-1 overflow-hidden">
            {(() => {
              const tagItems = project.tags
                .filter(Boolean)
                .map((tag) => ({
                  key: `tag-${tag}`,
                  label: tagTranslations[tag] || tag,
                  variant: "outline" as const,
                  href: `/projetos?tag=${encodeURIComponent(tag)}`,
                }))
                .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
              const genreItems = (project.genres || [])
                .filter(Boolean)
                .map((genre) => ({
                  key: `genre-${genre}`,
                  label: genreTranslations[genre] || genre,
                  variant: "outline" as const,
                  href: `/projetos?genero=${encodeURIComponent(genre)}`,
                }))
                .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
              const producerItems = (project.producers || [])
                .filter(Boolean)
                .map((producer) => ({
                  key: `producer-${producer}`,
                  label: producer,
                  variant: "outline" as const,
                }))
                .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
              const items = [...tagItems, ...genreItems, ...producerItems].filter(
                (item) => item.label && item.label.length <= 18,
                );
              const visibleItems = items.slice(0, 3);
              const extraCount = Math.max(0, items.length - visibleItems.length);
              return [
                ...visibleItems.map((item) =>
                  item.href ? (
                    <button
                      key={item.key}
                      type="button"
                      className="inline-flex"
                      title={item.label}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        navigate(item.href);
                      }}
                    >
                      <Badge
                        variant={item.variant}
                        className="h-5 whitespace-nowrap text-[9px] uppercase leading-none px-2"
                      >
                        {item.label}
                      </Badge>
                    </button>
                  ) : (
                    <Badge
                      key={item.key}
                      variant={item.variant}
                      className="inline-flex h-5 whitespace-nowrap text-[9px] uppercase leading-none px-2"
                      title={item.label}
                    >
                      {item.label}
                    </Badge>
                  ),
                ),
                ...(extraCount > 0
                  ? [
                      <Badge
                        key={`extra-${project.id}`}
                        variant="secondary"
                        className="inline-flex h-5 whitespace-nowrap text-[9px] uppercase leading-none px-2"
                        title={`+${extraCount} tags`}
                      >
                        +{extraCount}
                      </Badge>,
                    ]
                  : []),
              ];
            })()}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
          {project.status ? (
            <span className="shrink-0 rounded-full bg-background/50 px-3 py-1 truncate">
              {project.status}
            </span>
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
    </Link>
  );
};

const Projects = () => {
  usePageMeta({ title: "Projetos" });

  const apiBase = getApiBase();
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

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(pageStart, pageStart + projectsPerPage);

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
                <span className="hidden text-muted-foreground md:inline">•</span>
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
            <div className="mt-10 grid gap-6 md:grid-cols-2 md:auto-rows-fr">
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


















