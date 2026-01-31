import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LatestEpisodeCard from "./LatestEpisodeCard";
import WorkStatusCard from "./WorkStatusCard";

// Mock data for recent releases (blog posts about episodes)
const recentReleases = [
  {
    id: 1,
    anime: "Fate/Kaleid Liner Prisma Illya",
    episode: 12,
    title: "O Grande Final da Temporada",
    excerpt: "Finalmente chegamos ao fim dessa jornada incrível. Neste post compartilhamos nossas impressões sobre o desfecho épico...",
    date: "2024-01-28",
    image: "/placeholder.svg",
  },
  {
    id: 2,
    anime: "Spy x Family",
    episode: 8,
    title: "Anya e suas travessuras",
    excerpt: "Este episódio foi particularmente difícil de traduzir por conta dos trocadilhos. Veja como resolvemos...",
    date: "2024-01-25",
    image: "/placeholder.svg",
  },
  {
    id: 3,
    anime: "Jujutsu Kaisen",
    episode: 15,
    title: "A batalha que nos surpreendeu",
    excerpt: "A animação deste episódio estava impecável. Discutimos os desafios de legendar cenas de ação intensas...",
    date: "2024-01-22",
    image: "/placeholder.svg",
  },
  {
    id: 4,
    anime: "Frieren",
    episode: 20,
    title: "Reflexões sobre a passagem do tempo",
    excerpt: "Um episódio contemplativo que exigiu cuidado especial na tradução das nuances emocionais...",
    date: "2024-01-20",
    image: "/placeholder.svg",
  },
  {
    id: 5,
    anime: "Oshi no Ko",
    episode: 6,
    title: "Os bastidores do entretenimento",
    excerpt: "Traduzir referências culturais japonesas é sempre um desafio. Explicamos nossas escolhas...",
    date: "2024-01-18",
    image: "/placeholder.svg",
  },
];

const ReleasesSection = () => {
  return (
    <section className="py-16 px-6 md:px-12 bg-background">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">
          Lançamentos Recentes
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - Release cards (blog posts) */}
          <div className="lg:col-span-2 space-y-4">
            {recentReleases.map((release, index) => (
              <Card 
                key={release.id} 
                className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-4 flex gap-4">
                  <div className="w-24 h-32 md:w-32 md:h-40 rounded-md overflow-hidden flex-shrink-0 bg-secondary">
                    <img 
                      src={release.image} 
                      alt={release.anime}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {release.anime}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          EP {release.episode}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                        {release.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {release.excerpt}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-2">
                      {new Date(release.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Right side - Sidebar */}
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
