import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";

const LatestEpisodeCard = () => {
  const latestEpisode = {
    anime: "Fate/Kaleid Liner Prisma Illya",
    episode: 12,
    season: 1,
    image: "/placeholder.svg",
    slug: "fate-kaleid-liner-prisma-illya",
  };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          Último Episódio
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Link 
          to={`/anime/${latestEpisode.slug}`}
          className="block group"
        >
          <div className="relative aspect-video overflow-hidden">
            <img 
              src={latestEpisode.image}
              alt={latestEpisode.anime}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <Badge className="mb-2 bg-primary text-primary-foreground">
                EP {latestEpisode.episode}
              </Badge>
              <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {latestEpisode.anime}
              </h4>
              <span className="text-xs text-muted-foreground">
                Temporada {latestEpisode.season}
              </span>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default LatestEpisodeCard;
