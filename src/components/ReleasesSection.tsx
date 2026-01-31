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
import { CalendarDays, ChevronLeft, ChevronRight, User } from "lucide-react";

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
    tags: ["Anime", "Lançamento"],
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
    tags: ["Anime", "Especial"],
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
    tags: ["Anime", "OVA"],
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
    tags: ["Anime", "Aviso"],
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
    tags: ["Anime", "ONA"],
  },
];

const ReleasesSection = () => {
  const postsPerPage = 8;
  const totalPages = Math.ceil(recentReleases.length / postsPerPage);

  return (
    <section className="py-16 px-6 md:px-12 bg-background">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">
          Lançamentos Recentes
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-stretch">
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {recentReleases.map((release, index) => {
                const isLastOdd = recentReleases.length % 2 === 1 && index === recentReleases.length - 1;

                return (
                  <Card
                    key={release.id}
                    className={`bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in overflow-hidden ${
                      isLastOdd ? "md:col-span-2 md:max-w-[calc(50%-12px)] md:justify-self-center" : ""
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="p-0 flex flex-col h-full">
                      <div className="relative h-48 w-full overflow-hidden bg-secondary">
                        <img
                          src={release.image}
                          alt={release.anime}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute right-4 top-4 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {release.tags.map((tag) => (
                            <Badge
                              key={`${release.id}-${tag}`}
                              className="bg-background/80 text-foreground border border-border/60 backdrop-blur text-xs font-semibold"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {release.anime}
                            </Badge>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              EP {release.episode}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                            {release.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {release.excerpt}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-4 w-4 text-primary/70" aria-hidden="true" />
                            {release.author}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden="true" />
                            {new Date(release.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {totalPages > 1 && (
              <Pagination className="justify-center pt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationLink href="#" size="default" className="text-xs gap-1 pl-2.5">
                      <ChevronLeft className="h-4 w-4" />
                      <span>Anterior</span>
                    </PaginationLink>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, pageIndex) => (
                    <PaginationItem key={`page-${pageIndex + 1}`}>
                      <PaginationLink href="#" size="default" isActive={pageIndex === 0} className="text-xs">
                        {pageIndex + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationLink href="#" size="default" className="text-xs gap-1 pr-2.5">
                      <span>Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>

          <div className="space-y-6">
            <LatestEpisodeCard />
            <WorkStatusCard />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReleasesSection;
