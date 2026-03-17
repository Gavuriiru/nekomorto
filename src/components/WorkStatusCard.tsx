import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import {
  getProjectProgressKindForPublicCard,
  getProjectProgressState,
} from "@/lib/project-progress";

interface WorkItem {
  id: string;
  title: string;
  entry: string;
  progressState: ReturnType<typeof getProjectProgressState>;
  projectId: string;
}

const themedBadgeClass = "bg-primary text-primary-foreground border-primary/80";
const themedIndicatorClass = "bg-primary";

const WorkStatusCard = () => {
  const { data: bootstrapData, isLoading } = usePublicBootstrap();
  const projects = bootstrapData?.projects || [];
  const isLoadingProjects = isLoading && !bootstrapData;
  const useAccentInProgressCard = bootstrapData?.settings?.theme?.useAccentInProgressCard === true;

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [];
    projects.forEach((project) => {
      const typeLabel = project.type || "";
      const progressKind = getProjectProgressKindForPublicCard(typeLabel);
      if (!progressKind) {
        return;
      }
      (project.episodeDownloads || []).forEach((episode) => {
        const sources = Array.isArray(episode.sources)
          ? episode.sources.filter((source) => source.url)
          : [];
        if (sources.length > 0) {
          return;
        }
        const entryLabel = progressKind === "manga"
          ? `Capítulo ${episode.number}${episode.volume ? ` • Vol. ${episode.volume}` : ""}`
          : `Episódio ${episode.number}`;
        items.push({
          id: `${project.id}-${episode.number}`,
          title: project.title,
          entry: entryLabel,
          progressState: getProjectProgressState({
            kind: progressKind,
            completedStages: episode.completedStages,
          }),
          projectId: project.id,
        });
      });
    });
    return items;
  }, [projects]);

  const itemsInProgress = workItems;

  return (
    <Card lift={false} className="bg-card border-border reveal" data-reveal>
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
              <div key={`progress-skeleton-${index}`} className="rounded-md bg-secondary/40 p-3">
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
            const progressLabel = `${item.title} ${item.entry} ${item.progressState.progress}% concluído`;

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
                    className={`shrink-0 flex items-center gap-1 ${
                      useAccentInProgressCard
                        ? themedBadgeClass
                        : item.progressState.currentStage.badgeClassName
                    }`}
                  >
                    {item.progressState.currentStage.label}
                  </Badge>
                </div>
                <div className="mt-3">
                  <Progress
                    value={item.progressState.progress}
                    className="h-2"
                    aria-label={progressLabel}
                    aria-valuetext={progressLabel}
                    indicatorClassName={
                      useAccentInProgressCard
                        ? themedIndicatorClass
                        : item.progressState.currentStage.indicatorClassName
                    }
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
