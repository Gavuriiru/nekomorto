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

const projectData = [
  {
    id: "aurora-no-horizonte",
    title: "Aurora no Horizonte",
    synopsis: "Uma jornada sci-fi sobre amizade, esperança e o renascimento de uma nave perdida.",
    type: "Anime",
    status: "Em andamento",
    year: "2024",
    studio: "Studio Polaris",
    episodes: "12 episódios",
    tags: ["Sci-fi", "Drama", "Aventura"],
    cover: "/placeholder.svg",
  },
  {
    id: "nekomata-eclipse",
    title: "Nekomata: Eclipse",
    synopsis: "Mangá sobrenatural que acompanha um clã felino e seus pactos com o submundo.",
    type: "Mangá",
    status: "Completo",
    year: "2023",
    studio: "Kitsune Press",
    episodes: "38 capítulos",
    tags: ["Sobrenatural", "Ação", "Mistério"],
    cover: "/placeholder.svg",
  },
  {
    id: "rainbow-pulse",
    title: "Rainbow Pulse",
    synopsis: "Idols futuristas lutam para manter a música viva em uma metrópole distópica.",
    type: "Anime",
    status: "Em andamento",
    year: "2024",
    studio: "Sakura Wave",
    episodes: "24 episódios",
    tags: ["Música", "Ficção", "Ação"],
    cover: "/placeholder.svg",
  },
  {
    id: "boreal-nocturne",
    title: "Boreal Nocturne",
    synopsis: "Um especial musical sobre um festival mágico de inverno e seus mistérios.",
    type: "Especial",
    status: "Lançado",
    year: "2022",
    studio: "Lumière",
    episodes: "1 especial",
    tags: ["Fantasia", "Música", "Slice of Life"],
    cover: "/placeholder.svg",
  },
  {
    id: "estacoes-em-orbita",
    title: "Estações em Órbita",
    synopsis: "Filme romântico que acompanha encontros improváveis em uma estação espacial.",
    type: "Filme",
    status: "Lançado",
    year: "2023",
    studio: "Orbit Works",
    episodes: "1 filme",
    tags: ["Romance", "Sci-fi", "Drama"],
    cover: "/placeholder.svg",
  },
  {
    id: "fragmentos-de-verao",
    title: "Fragmentos de Verão",
    synopsis: "OVA delicado sobre amizades e segredos em uma cidade litorânea.",
    type: "OVA",
    status: "Lançado",
    year: "2021",
    studio: "Blue Tide",
    episodes: "2 OVAs",
    tags: ["Drama", "Slice of Life", "Romance"],
    cover: "/placeholder.svg",
  },
  {
    id: "galaxia-ona",
    title: "Galáxia ONA",
    synopsis: "ONA de aventura espacial com humor e uma tripulação inesperada.",
    type: "ONA",
    status: "Em andamento",
    year: "2024",
    studio: "Nebula Lab",
    episodes: "8 episódios",
    tags: ["Aventura", "Comédia", "Sci-fi"],
    cover: "/placeholder.svg",
  },
  {
    id: "harmonia-sakura",
    title: "Harmonia Sakura",
    synopsis: "Webtoon sobre uma academia de artes onde rivalidade vira amizade.",
    type: "Webtoon",
    status: "Em andamento",
    year: "2024",
    studio: "Hanami Studio",
    episodes: "45 capítulos",
    tags: ["Escolar", "Drama", "Música"],
    cover: "/placeholder.svg",
  },
  {
    id: "iris-black",
    title: "Iris Black",
    synopsis: "Thriller urbano com detetives psíquicos em uma cidade neon.",
    type: "Anime",
    status: "Em produção",
    year: "2025",
    studio: "Noir Edge",
    episodes: "Anunciado",
    tags: ["Suspense", "Ação", "Cyberpunk"],
    cover: "/placeholder.svg",
  },
  {
    id: "jardim-das-marés",
    title: "Jardim das Marés",
    synopsis: "Mangá poético sobre guardiões que protegem aldeias costeiras.",
    type: "Mangá",
    status: "Em andamento",
    year: "2022",
    studio: "Horizon Ink",
    episodes: "27 capítulos",
    tags: ["Fantasia", "Aventura", "Drama"],
    cover: "/placeholder.svg",
  },
  {
    id: "lumina-kizuna",
    title: "Lumina Kizuna",
    synopsis: "Especial animado sobre uma ligação luminosa entre duas irmãs mágicas.",
    type: "Especial",
    status: "Lançado",
    year: "2020",
    studio: "Aurora Bloom",
    episodes: "1 especial",
    tags: ["Fantasia", "Família", "Slice of Life"],
    cover: "/placeholder.svg",
  },
  {
    id: "memento-arc",
    title: "Memento Arc",
    synopsis: "Filme de fantasia sobre memórias perdidas e viagens temporais.",
    type: "Filme",
    status: "Lançado",
    year: "2021",
    studio: "Chronos Lab",
    episodes: "1 filme",
    tags: ["Fantasia", "Drama", "Mistério"],
    cover: "/placeholder.svg",
  },
  {
    id: "nova-primavera",
    title: "Nova Primavera",
    synopsis: "Ova musical que celebra uma nova geração de idols.",
    type: "OVA",
    status: "Lançado",
    year: "2022",
    studio: "Idol Forge",
    episodes: "3 OVAs",
    tags: ["Música", "Slice of Life", "Comédia"],
    cover: "/placeholder.svg",
  },
  {
    id: "oraculo-de-cristal",
    title: "Oráculo de Cristal",
    synopsis: "ONA de fantasia com guerreiros que usam cristais para salvar reinos.",
    type: "ONA",
    status: "Em andamento",
    year: "2023",
    studio: "Crystal Spine",
    episodes: "10 episódios",
    tags: ["Fantasia", "Ação", "Aventura"],
    cover: "/placeholder.svg",
  },
  {
    id: "prisma-ryu",
    title: "Prisma Ryu",
    synopsis: "Spin-off que acompanha uma nova heroína em um universo mágico.",
    type: "Spin-off",
    status: "Em produção",
    year: "2025",
    studio: "Rainbow Works",
    episodes: "Anunciado",
    tags: ["Fantasia", "Ação", "Shojo"],
    cover: "/placeholder.svg",
  },
];

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
  const [selectedTag, setSelectedTag] = useState("Todas");
  const [selectedLetter, setSelectedLetter] = useState("Todas");
  const [selectedType, setSelectedType] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 16;

  const tagOptions = useMemo(() => {
    const tags = projectData.flatMap((project) => project.tags);
    return ["Todas", ...Array.from(new Set(tags)).sort()];
  }, []);

  const filteredProjects = useMemo(() => {
    return projectData
      .filter((project) => {
        const matchesTag = selectedTag === "Todas" || project.tags.includes(selectedTag);
        const matchesType = selectedType === "Todos" || project.type === selectedType;
        const matchesLetter =
          selectedLetter === "Todas" || project.title.toUpperCase().startsWith(selectedLetter);
        return matchesTag && matchesType && matchesLetter;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [selectedLetter, selectedTag, selectedType]);

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
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pt-28">
        <section className="relative overflow-hidden pb-16">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Biblioteca de projetos
              </span>
              <h1 className="text-4xl font-black md:text-5xl lg:text-6xl">
                Projetos que levam nossa identidade para novas histórias.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Explore animes, filmes, especiais, OVAs, ONAs e mangás. Filtre por tags, ordem
                alfabética ou formato para encontrar o que mais combina com você.
              </p>
            </div>

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
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
          {paginatedProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhum projeto encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {paginatedProjects.map((project, index) => {
                const isLastSingle =
                  paginatedProjects.length % 2 === 1 && index === paginatedProjects.length - 1;

                const card = (
                  <Link
                    key={project.id}
                    to={`/projetos/${project.id}`}
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
