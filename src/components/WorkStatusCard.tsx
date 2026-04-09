import { useMemo, type CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import {
  getProjectProgressKindForPublicCard,
  getProjectProgressStateForPublicCard,
} from "@/lib/project-progress";
import type { PublicBootstrapInProgressItem } from "@/types/public-bootstrap";

interface WorkItem {
  id: string;
  title: string;
  entry: string;
  progressState: NonNullable<ReturnType<typeof getProjectProgressStateForPublicCard>>;
  projectId: string;
}

const themedBadgeClass = "bg-primary text-primary-foreground border-primary/80";
const themedIndicatorClass = "bg-primary";
const VISIBLE_PROGRESS_ITEMS = 5;
const PROGRESS_CARD_ITEM_MIN_HEIGHT = "5.75rem";
const PROGRESS_CARD_LIST_MAX_HEIGHT = `calc((${PROGRESS_CARD_ITEM_MIN_HEIGHT} * ${VISIBLE_PROGRESS_ITEMS}) + (0.75rem * ${VISIBLE_PROGRESS_ITEMS - 1}) + 0.5rem)`;

const hasNumericVolume = (value: number | undefined) => Number.isFinite(Number(value));

const buildEntryLabel = (
  item: PublicBootstrapInProgressItem,
  progressKind: ReturnType<typeof getProjectProgressKindForPublicCard>,
) => {
  const displayLabel = String(item.displayLabel || "").trim();
  if (item.entryKind === "extra" && displayLabel) {
    return displayLabel;
  }
  if (progressKind === "manga") {
    const volumeLabel = hasNumericVolume(item.volume) ? ` • Vol. ${Number(item.volume)}` : "";
    return `Capítulo ${item.number}${volumeLabel}`;
  }
  return `Episódio ${item.number}`;
};

const progressListStyle: CSSProperties = {
  maxHeight: PROGRESS_CARD_LIST_MAX_HEIGHT,
};

const WorkStatusCard = () => {
  const { data: bootstrapData, isLoading } = usePublicBootstrap();
  const inProgressItems = bootstrapData?.inProgressItems || [];
  const isLoadingProjects = isLoading && !bootstrapData;
  const useAccentInProgressCard = bootstrapData?.settings?.theme?.useAccentInProgressCard === true;

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [];
    inProgressItems.forEach((item) => {
      const typeLabel = item.projectType || "";
      const progressKind = getProjectProgressKindForPublicCard(typeLabel);
      const progressState = getProjectProgressStateForPublicCard(
        typeLabel,
        item.completedStages,
        item.progressStage,
      );
      if (!progressState) {
        return;
      }
      items.push({
        id: `${item.projectId}-${buildEpisodeKey(item.number, item.volume)}`,
        title: item.projectTitle,
        entry: buildEntryLabel(item, progressKind),
        progressState,
        projectId: item.projectId,
      });
    });
    return items;
  }, [inProgressItems]);

  const itemsInProgress = workItems.filter((item) => item.progressState.isInProgress);

  return (
    <Card lift={false} className="bg-card border-border reveal shadow-none" data-reveal>
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
          <div
            data-testid="work-status-scroll-region"
            className="no-scrollbar space-y-3 overflow-y-auto overscroll-contain pr-1 pt-1 pb-1"
            style={progressListStyle}
          >
            {itemsInProgress.map((item) => {
              const progressLabel = `${item.title} ${item.entry} ${item.progressState.progress}% concluído`;

              return (
                <Link
                  key={item.id}
                  to={`/projeto/${item.projectId}`}
                  className="group/item block min-h-[5.75rem] rounded-md border border-border/50 bg-secondary/50 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-secondary hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate transition-colors duration-300 group-hover/item:text-primary">
                        {item.title}
                      </p>
                      <span className="block truncate text-xs text-muted-foreground transition-colors duration-300 group-hover/item:text-foreground/80">
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkStatusCard;
