import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const LatestEpisodeCard = () => {
  const recentUpdates = [
    {
      id: 1,
      anime: "Gabriel Dropout",
      episode: 7,
      season: 1,
      reason: "Correção de timing e revisão de script",
      updatedAt: "2024-01-29",
      image: "/placeholder.svg",
      slug: "gabriel-dropout",
    },
    {
      id: 2,
      anime: "Jujutsu Kaisen",
      episode: 15,
      season: 2,
      reason: "Ajuste de karaoke e notas de tradução",
      updatedAt: "2024-01-28",
      image: "/placeholder.svg",
      slug: "jujutsu-kaisen",
    },
    {
      id: 3,
      anime: "Frieren",
      episode: 20,
      season: 1,
      reason: "Revisão de contexto cultural e tips",
      updatedAt: "2024-01-27",
      image: "/placeholder.svg",
      slug: "frieren",
    },
    {
      id: 4,
      anime: "Spy x Family",
      episode: 8,
      season: 2,
      reason: "Correções finas de legendagem",
      updatedAt: "2024-01-26",
      image: "/placeholder.svg",
      slug: "spy-x-family",
    },
    {
      id: 5,
      anime: "Oshi no Ko",
      episode: 6,
      season: 1,
      reason: "Sincronização com novo encode",
      updatedAt: "2024-01-24",
      image: "/placeholder.svg",
      slug: "oshi-no-ko",
    },
  ];

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Atualizações Recentes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Episódios que receberam ajustes ou revisões recentemente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentUpdates.map((update) => (
          <Link
            key={update.id}
            to={`/anime/${update.slug}`}
            className="group flex items-start gap-4 rounded-xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary aspect-[2/3]">
              <img
                src={update.image}
                alt={update.anime}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  EP {update.episode}
                </Badge>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Temporada {update.season}
                </span>
              </div>
              <h4 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {update.anime}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {update.reason}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3 text-primary/70" aria-hidden="true" />
                {new Date(update.updatedAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
};

export default LatestEpisodeCard;
