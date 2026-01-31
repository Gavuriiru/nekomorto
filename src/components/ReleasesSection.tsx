import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import LatestEpisodeCard from "./LatestEpisodeCard";
import WorkStatusCard from "./WorkStatusCard";
import DiscordInviteCard from "./DiscordInviteCard";
import { CalendarDays, User } from "lucide-react";

// Mock data for recent releases (blog posts about episodes)
const recentReleases = [
  {
    id: 1,
    anime: "Fate/Kaleid Liner Prisma Illya",
    episode: 12,
    title: "O Grande Final da Temporada",
    excerpt: "Finalmente chegamos ao fim dessa jornada incrível. Neste post compartilhamos nossas impressões sobre o desfecho épico...",
    date: "2024-01-28",
    author: "Marina Aoki",
    image: "/placeholder.svg",
    tags: ["Anime", "Lançamento", "Especial"],
  },
  {
    id: 2,
    anime: "Spy x Family",
    episode: 8,
    title: "Anya e suas travessuras",
    excerpt: "Este episódio foi particularmente difícil de traduzir por conta dos trocadilhos. Veja como resolvemos...",
    date: "2024-01-25",
    author: "Lucas Sato",
    image: "/placeholder.svg",
    tags: ["Anime", "Aviso"],
  },
  {
    id: 3,
    anime: "Jujutsu Kaisen",
    episode: 15,
    title: "A batalha que nos surpreendeu",
    excerpt: "A animação deste episódio estava impecável. Discutimos os desafios de legendar cenas de ação intensas...",
    date: "2024-01-22",
    author: "Renata Takeda",
    image: "/placeholder.svg",
    tags: ["Anime", "Lançamento"],
  },
  {
    id: 4,
    anime: "Frieren",
    episode: 20,
    title: "Reflexões sobre a passagem do tempo",
    excerpt: "Um episódio contemplativo que exigiu cuidado especial na tradução das nuances emocionais...",
    date: "2024-01-20",
    author: "Caio Matsumoto",
    image: "/placeholder.svg",
    tags: ["Anime", "Especial"],
  },
  {
    id: 5,
    anime: "Oshi no Ko",
    episode: 6,
    title: "Os bastidores do entretenimento",
    excerpt: "Traduzir referências culturais japonesas é sempre um desafio. Explicamos nossas escolhas...",
    date: "2024-01-18",
    author: "Bruna Ishida",
    image: "/placeholder.svg",
    tags: ["Anime", "Ova"],
  },
  {
    id: 6,
    anime: "Dungeon Meshi",
    episode: 9,
    title: "Receitas improváveis no abismo",
    excerpt: "O episódio trouxe momentos de humor e tensão. Comentamos como adaptamos piadas culinárias sem perder o tom original...",
    date: "2024-01-16",
    author: "Felipe Kawahara",
    image: "/placeholder.svg",
    tags: ["Anime", "Ona"],
  },
  {
    id: 7,
    anime: "Bocchi the Rock!",
    episode: 4,
    title: "Música, ansiedade e tradução criativa",
    excerpt: "Lidamos com trocadilhos musicais e gírias modernas. Confira as decisões que tomamos para manter o ritmo...",
    date: "2024-01-14",
    author: "Lívia Nishimura",
    image: "/placeholder.svg",
    tags: ["Anime", "Especial"],
  },
  {
    id: 8,
    anime: "Solo Leveling",
    episode: 3,
    title: "A ascensão do caçador",
    excerpt: "Explicamos como equilibramos termos técnicos e a fluidez da leitura para cenas de ação aceleradas...",
    date: "2024-01-12",
    author: "Daniel Mori",
    image: "/placeholder.svg",
    tags: ["Anime", "Lançamento"],
  },
];

const ReleasesSection = () => {
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(recentReleases.length / pageSize);
  const pagedReleases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return recentReleases.slice(startIndex, startIndex + pageSize);
  }, [currentPage]);
  const showPagination = totalPages > 1;

  return (
    <section className="py-16 px-6 md:px-12 bg-background">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">
          Lançamentos Recentes
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - Release cards (blog posts) */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {pagedReleases.map((release, index) => (
                <Card
                  key={release.id}
                  className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-5 flex flex-col h-full gap-4">
                    <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden bg-secondary">
                      <img
                        src={release.image}
                        alt={release.anime}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        {release.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] uppercase tracking-wide bg-background/80 text-foreground"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {release.anime}
                      </Badge>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        EP {release.episode}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                        {release.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {release.excerpt}
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        {release.author}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden="true" />
                        {new Date(release.date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {showPagination ? (
              <Pagination className="justify-start pt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      className="text-xs"
                      aria-disabled={currentPage === 1}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((page) => page - 1);
                        }
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          size="default"
                          isActive={page === currentPage}
                          className="text-xs"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      className="text-xs"
                      aria-disabled={currentPage === totalPages}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((page) => page + 1);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
          
          {/* Right side - Sidebar */}
          <div className="flex h-full flex-col gap-6">
            <LatestEpisodeCard />
            <WorkStatusCard />
            <DiscordInviteCard />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReleasesSection;
