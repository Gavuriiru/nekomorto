import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
import type { Project } from "@/data/projects";

const typeOptions = [
  "Todos",
  "Anime",
  "Especial",
  "Filme",
  "OVA",
  "ONA",
  "Mangá",
  "Webtoon",
  "Spin-off",
];

const alphabetOptions = ["Todas", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

const Projects = () => {
  const apiBase = getApiBase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTag, setSelectedTag] = useState("Todas");
  const [selectedLetter, setSelectedLetter] = useState("Todas");
  const [selectedType, setSelectedType] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 16;

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/projects`);
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

  const tagOptions = useMemo(() => {
    const tags = projects.flatMap((project) => project.tags);
    return ["Todas", ...Array.from(new Set(tags)).sort()];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const matchesTag = selectedTag === "Todas" || project.tags.includes(selectedTag);
        const matchesType = selectedType === "Todos" || project.type === selectedType;
        const matchesLetter =
          selectedLetter === "Todas" || project.title.toUpperCase().startsWith(selectedLetter);
        return matchesTag && matchesType && matchesLetter;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [projects, selectedLetter, selectedTag, selectedType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLetter, selectedTag, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(pageStart, pageStart + projectsPerPage);

  const resetFilters = () => {
    setSelectedTag("Todas");
    setSelectedLetter("Todas");
    setSelectedType("Todos");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
      <Header />
      <main className="pt-28">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
          <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-lg backdrop-blur md:grid-cols-[repeat(3,minmax(0,1fr))]">
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
                      {tag}
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

            <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
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
            <div className="mt-10 rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhum projeto encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {paginatedProjects.map((project, index) => {
                const isLastSingle =
                  paginatedProjects.length % 2 === 1 && index === paginatedProjects.length - 1;

                const card = (
                  <Link
                    key={project.id}
                    to={`/projeto/${project.id}`}
                    className="group flex w-full max-w-xl gap-5 rounded-2xl border border-border/60 bg-gradient-card p-5 transition hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="w-28 flex-shrink-0 overflow-hidden rounded-xl bg-secondary shadow-inner aspect-[2/3] md:w-36">
                      <img
                        src={project.cover}
                        alt={project.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
                          {project.type}
                        </p>
                        <h2 className="text-xl font-semibold text-foreground md:text-2xl">
                          {project.title}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {project.synopsis}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] uppercase">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-background/50 px-3 py-1">
                          {project.status}
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/50 px-3 py-1">
                          {project.studio}
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/50 px-3 py-1">
                          {project.episodes}
                        </span>
                      </div>
                    </div>
                  </Link>
                );

                if (!isLastSingle) {
                  return card;
                }

                return (
                  <div key={project.id} className="md:col-span-2 flex justify-center">
                    {card}
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
      <Footer />
    </div>
  );
};

export default Projects;
