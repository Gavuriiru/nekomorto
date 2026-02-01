import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { getApiBase } from "@/lib/api-base";

const formatLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    return dateString;
  }

  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
};

type UpdateRecord = {
  id: string;
  projectId: string;
  projectTitle: string;
  episodeNumber: number;
  kind: string;
  reason: string;
  updatedAt: string;
  image: string;
};

const LatestEpisodeCard = () => {
  const apiBase = getApiBase();
  const [recentUpdates, setRecentUpdates] = useState<UpdateRecord[]>([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/updates`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setRecentUpdates(Array.isArray(data.updates) ? data.updates : []);
        }
      } catch {
        if (isActive) {
          setRecentUpdates([]);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Atualizações Recentes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Episódios que receberam ajustes ou revisões recentemente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {recentUpdates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-4 text-xs text-muted-foreground">
            Nenhuma atualização recente cadastrada.
          </div>
        ) : (
          recentUpdates.map((update) => (
            <Link
              key={update.id}
              to={`/projeto/${update.projectId}`}
              className="group flex items-start gap-4 rounded-xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="w-24 flex-shrink-0 overflow-hidden rounded-lg bg-secondary aspect-[2/3]">
                <img
                  src={update.image || "/placeholder.svg"}
                  alt={update.projectTitle}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    EP {update.episodeNumber}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {update.kind}
                  </Badge>
                </div>
                <h4 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                  {update.projectTitle}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {update.reason}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 text-primary/70" aria-hidden="true" />
                  {formatLocalDate(update.updatedAt.split("T")[0])}
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default LatestEpisodeCard;
