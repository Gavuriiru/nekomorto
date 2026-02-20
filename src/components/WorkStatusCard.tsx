import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";

type WorkKind = "anime" | "manga";

interface WorkItem {
  id: string;
  title: string;
  entry: string;
  kind: WorkKind;
  currentStage: string;
  completedStages: string[];
  projectId: string;
}

const animeStages = [
  {
    id: "aguardando-raw",
    label: "Aguardando Raw",
    color: "bg-slate-500",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  {
    id: "traducao",
    label: "Tradução",
    color: "bg-blue-500",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "revisao",
    label: "Revisão",
    color: "bg-yellow-500",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  {
    id: "timing",
    label: "Timing",
    color: "bg-pink-500",
    badge: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
  {
    id: "typesetting",
    label: "Typesetting",
    color: "bg-indigo-500",
    badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  {
    id: "quality-check",
    label: "Quality Check",
    color: "bg-orange-500",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  {
    id: "encode",
    label: "Encode",
    color: "bg-purple-500",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
];

const mangaStages = [
  {
    id: "aguardando-raw",
    label: "Aguardando Raw",
    color: "bg-slate-500",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  {
    id: "traducao",
    label: "Tradução",
    color: "bg-blue-500",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "limpeza",
    label: "Limpeza",
    color: "bg-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "redrawing",
    label: "Redrawing",
    color: "bg-cyan-500",
    badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "revisao",
    label: "Revisão",
    color: "bg-yellow-500",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  {
    id: "typesetting",
    label: "Typesetting",
    color: "bg-indigo-500",
    badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  {
    id: "quality-check",
    label: "Quality Check",
    color: "bg-orange-500",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
];

const WorkStatusCard = () => {
  const { data: bootstrapData, isLoading } = usePublicBootstrap();
  const projects = bootstrapData?.projects || [];
  const isLoadingProjects = isLoading && !bootstrapData;

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [];
    projects.forEach((project) => {
      const typeLabel = project.type || "";
      const isLightNovel = isLightNovelType(typeLabel);
      const isManga = isMangaType(typeLabel);
      if (isLightNovel) {
        return;
      }
      const kind: WorkKind = isManga ? "manga" : "anime";
      (project.episodeDownloads || []).forEach((episode) => {
        const sources = Array.isArray(episode.sources)
          ? episode.sources.filter((source) => source.url)
          : [];
        if (sources.length > 0) {
          return;
        }
        const entryLabel = isManga
          ? `Capítulo ${episode.number}${episode.volume ? ` • Vol. ${episode.volume}` : ""}`
          : `Episódio ${episode.number}`;
        const completedStages = episode.completedStages || [];
        const stages = kind === "anime" ? animeStages : mangaStages;
        const completedSet = new Set(completedStages);
        const currentStage =
          stages.find((stage) => !completedSet.has(stage.id))?.id ||
          stages[stages.length - 1]?.id ||
          "aguardando-raw";
        items.push({
          id: `${project.id}-${episode.number}`,
          title: project.title,
          entry: entryLabel,
          kind,
          currentStage,
          completedStages,
          projectId: project.id,
        });
      });
    });
    return items;
  }, [projects]);

  const itemsInProgress = workItems;

  return (
    <Card className="bg-card border-border reveal" data-reveal>
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary/80" />
          Em Progresso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoadingProjects ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`progress-skeleton-${index}`}
                className="rounded-md bg-secondary/40 p-3"
              >
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-2 h-2 w-1/2" />
                <Skeleton className="mt-3 h-2 w-full" />
              </div>
            ))}
          </div>
        ) : itemsInProgress.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-4 text-xs text-muted-foreground">
            Nenhum episódio em progresso no momento.
          </div>
        ) : (
          itemsInProgress.map((item) => {
            const stages = item.kind === "anime" ? animeStages : mangaStages;
            const completedSet = new Set(item.completedStages);
            const completedCount = stages.filter((stage) => completedSet.has(stage.id)).length;
            const progress = Math.round((completedCount / stages.length) * 100);
            const currentStage =
              stages.find((stage) => stage.id === item.currentStage) ?? stages[0];

            return (
              <Link
                key={item.id}
                to={`/projeto/${item.projectId}`}
                className="group/item block rounded-md border border-border/50 bg-secondary/50 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-secondary hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate transition-colors duration-300 group-hover/item:text-primary">
                      {item.title}
                    </p>
                    <span className="text-xs text-muted-foreground transition-colors duration-300 group-hover/item:text-foreground/80">
                      {item.entry}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 flex items-center gap-1 ${currentStage.badge}`}
                  >
                    {currentStage.label}
                  </Badge>
                </div>
                <div className="mt-3">
                  <Progress
                    value={progress}
                    className="h-2"
                    indicatorClassName={currentStage.color}
                  />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default WorkStatusCard;
