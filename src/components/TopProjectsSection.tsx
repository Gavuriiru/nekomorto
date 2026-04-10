import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Eye, Hash } from "lucide-react";
import { Link } from "react-router-dom";

import PublicInteractiveCardShell from "@/components/PublicInteractiveCardShell";
import UploadPicture from "@/components/UploadPicture";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/public-form-controls";
import { publicStrongSurfaceHoverClassName } from "@/components/public-page-tokens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { cn } from "@/lib/utils";

const TOP_PROJECTS_LIMIT = 10;
const TOP_PROJECTS_LAST_7_DAYS = 7;
const TOP_PROJECTS_LAST_30_DAYS = 30;
const TOP_PROJECTS_CARD_HEIGHT_PX = 164;
const TOP_PROJECTS_GAP_PX = 12;
const TOP_PROJECTS_VISIBLE_MOBILE = 2;
const TOP_PROJECTS_VISIBLE_DESKTOP = 3;
const TOP_PROJECTS_THUMB_ASPECT_RATIO = "9 / 14";
const TOP_PROJECTS_THUMB_WIDTH = "calc(var(--top-card-h) * 9 / 14)";

type TopProjectsMode = "all" | "7d" | "30d";

const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toSafeNonNegativeInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const buildRecentUtcDayKeys = (days: number, now = new Date()) => {
  const keys: string[] = [];
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(endDate);
    day.setUTCDate(endDate.getUTCDate() - offset);
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
};

const sumViewsByDayKeys = (viewsDaily: Record<string, number>, dayKeys: string[]) => {
  if (!viewsDaily || typeof viewsDaily !== "object") {
    return 0;
  }
  let total = 0;
  dayKeys.forEach((dayKey) => {
    total += toSafeNonNegativeInt(viewsDaily[dayKey]);
  });
  return total;
};

const TopProjectsSection = () => {
  const [mode, setMode] = useState<TopProjectsMode>("all");
  const { data: bootstrapData, isLoading } = usePublicBootstrap();
  const projects = bootstrapData?.projects || [];
  const mediaVariants = bootstrapData?.mediaVariants || {};
  const isLoadingProjects = isLoading && !bootstrapData;
  const numberFormatter = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
  const listLayoutStyle = {
    "--top-card-h": `${TOP_PROJECTS_CARD_HEIGHT_PX}px`,
    "--top-gap": `${TOP_PROJECTS_GAP_PX}px`,
  } as CSSProperties;

  const topProjects = useMemo(() => {
    const dayKeys7d = buildRecentUtcDayKeys(TOP_PROJECTS_LAST_7_DAYS);
    const dayKeys30d = buildRecentUtcDayKeys(TOP_PROJECTS_LAST_30_DAYS);
    return projects
      .map((project) => {
        const id = String(project?.id || "").trim();
        const title = String(project?.title || "").trim();
        const viewsAll = toSafeNonNegativeInt(project?.views);
        const normalizedViewsDaily =
          project?.viewsDaily && typeof project.viewsDaily === "object"
            ? Object.entries(project.viewsDaily).reduce<Record<string, number>>(
                (result, [rawDay, rawViews]) => {
                  const day = String(rawDay || "").trim();
                  if (!DAY_KEY_REGEX.test(day)) {
                    return result;
                  }
                  result[day] = toSafeNonNegativeInt(rawViews);
                  return result;
                },
                {},
              )
            : {};
        const views7d = sumViewsByDayKeys(normalizedViewsDaily, dayKeys7d);
        const views30d = sumViewsByDayKeys(normalizedViewsDaily, dayKeys30d);
        return {
          project,
          id,
          title,
          viewsAll,
          views7d,
          views30d,
        };
      })
      .filter((item) => item.id && item.title)
      .sort((left, right) => {
        const leftMetric =
          mode === "30d" ? left.views30d : mode === "7d" ? left.views7d : left.viewsAll;
        const rightMetric =
          mode === "30d" ? right.views30d : mode === "7d" ? right.views7d : right.viewsAll;
        if (rightMetric !== leftMetric) {
          return rightMetric - leftMetric;
        }
        if (right.viewsAll !== left.viewsAll) {
          return right.viewsAll - left.viewsAll;
        }
        return left.title.localeCompare(right.title, "pt-BR");
      })
      .slice(0, TOP_PROJECTS_LIMIT);
  }, [mode, projects]);

  const synopsisKeys = useMemo(() => topProjects.map((item) => item.id), [topProjects]);
  const { rootRef: synopsisRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: topProjects.length > 0,
    keys: synopsisKeys,
    maxLines: 3,
  });

  const getSynopsisClampClass = (projectId: string) => {
    const lines = lineByKey[projectId] ?? 2;
    if (lines <= 0) {
      return "hidden";
    }
    if (lines === 1) {
      return "line-clamp-1";
    }
    if (lines === 2) {
      return "line-clamp-2";
    }
    return "line-clamp-3";
  };

  return (
    <Card
      id="top-projetos"
      lift={false}
      className="bg-card reveal rounded-lg border border-border/60 shadow-none"
      data-reveal
    >
      <CardHeader className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            Projetos Populares
          </CardTitle>
          <Select
            value={mode}
            onValueChange={(value) =>
              setMode(value === "30d" ? "30d" : value === "7d" ? "7d" : "all")
            }
          >
            <SelectTrigger
              aria-label="Ordenar Top 10 por visualizacoes"
              data-testid="top-projects-mode-trigger"
              className="h-7 w-[92px] bg-background/70 px-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sempre</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
              <SelectItem value="30d">30d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoadingProjects ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`top-projects-skeleton-${index}`}
                className="rounded-2xl bg-background/40 p-4"
              >
                <div className="flex gap-4">
                  <Skeleton
                    className="h-32 shrink-0 rounded-xl"
                    style={{ aspectRatio: TOP_PROJECTS_THUMB_ASPECT_RATIO }}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : topProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-4 text-xs text-muted-foreground">
            Ainda sem dados de visualizacao.
          </div>
        ) : (
          <div className="top-projects-viewport">
            <div
              ref={synopsisRootRef}
              data-testid="top-projects-scroll-region"
              style={listLayoutStyle}
              className="top-projects-scroll-region no-scrollbar"
            >
              <div data-testid="top-projects-list" className="top-projects-list">
                {topProjects.map((entry, index) => {
                  const metricValue =
                    mode === "30d"
                      ? entry.views30d
                      : mode === "7d"
                        ? entry.views7d
                        : entry.viewsAll;

                  return (
                    <PublicInteractiveCardShell
                      key={entry.id}
                      shadowPreset="none"
                      className="group/top-project-item rounded-2xl"
                    >
                      <Link
                        data-testid={`top-project-item-${index + 1}`}
                        to={`/projeto/${entry.id}`}
                        className={cn(
                          "top-projects-link relative z-10 rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/45",
                          publicStrongSurfaceHoverClassName,
                        )}
                      >
                        <div
                          className="h-full shrink-0 overflow-hidden bg-secondary/60"
                          style={{
                            aspectRatio: TOP_PROJECTS_THUMB_ASPECT_RATIO,
                            width: TOP_PROJECTS_THUMB_WIDTH,
                          }}
                        >
                          <UploadPicture
                            src={entry.project.cover || "/placeholder.svg"}
                            alt={entry.title}
                            preset="posterThumb"
                            mediaVariants={mediaVariants}
                            sizes="96px"
                            className="block h-full w-full"
                            imgClassName="home-card-media-transition h-full w-full object-cover object-center group-hover/top-project-item:scale-[1.03] group-focus-within/top-project-item:scale-[1.03]"
                            loading="lazy"
                          />
                        </div>

                        <div
                          data-synopsis-role="column"
                          data-synopsis-key={entry.id}
                          className="top-projects-link-body flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                        >
                          <div data-synopsis-role="title" className="space-y-1.5">
                            <div
                              data-testid={`top-project-item-${index + 1}-meta-row`}
                              className="flex min-w-0 items-center justify-between gap-2"
                            >
                              <span
                                data-testid={`top-project-item-${index + 1}-type`}
                                className="min-w-0 truncate text-[10px] uppercase tracking-[0.16em] text-primary/80"
                              >
                                {entry.project.type || "Projeto"}
                              </span>
                              <div className="ml-auto inline-flex shrink-0 items-center gap-3 whitespace-nowrap">
                                <span
                                  data-testid={`top-project-item-${index + 1}-rank`}
                                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                  aria-label={`Posicao: ${index + 1}`}
                                >
                                  <Hash
                                    className="h-3.5 w-3.5 text-muted-foreground/80"
                                    aria-hidden="true"
                                  />
                                  {index + 1}
                                </span>
                                <span
                                  data-testid={`top-project-item-${index + 1}-metric`}
                                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                  aria-label={`Visualizacoes: ${numberFormatter.format(metricValue)}`}
                                >
                                  <Eye
                                    className="h-3.5 w-3.5 text-muted-foreground/80"
                                    aria-hidden="true"
                                  />
                                  {numberFormatter.format(metricValue)}
                                </span>
                              </div>
                            </div>
                            <h3 className="clamp-safe-2 interactive-content-transition text-base font-semibold leading-snug text-foreground group-hover/top-project-item:text-primary group-focus-within/top-project-item:text-primary">
                              {entry.title}
                            </h3>
                          </div>
                          <p
                            data-synopsis-role="synopsis"
                            className={cn(
                              "mt-2 text-xs leading-relaxed text-muted-foreground",
                              getSynopsisClampClass(entry.id),
                            )}
                          >
                            {entry.project.synopsis ||
                              entry.project.description ||
                              "Sem sinopse cadastrada."}
                          </p>
                        </div>
                      </Link>
                    </PublicInteractiveCardShell>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopProjectsSection;
