import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Eye, Hash } from "lucide-react";
import { Link } from "react-router-dom";
import UploadPicture from "@/components/UploadPicture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import { cn } from "@/lib/utils";

const TOP_PROJECTS_LIMIT = 10;
const TOP_PROJECTS_LAST_7_DAYS = 7;
const TOP_PROJECTS_LAST_30_DAYS = 30;
const TOP_PROJECTS_CARD_HEIGHT_PX = 164;
const TOP_PROJECTS_GAP_PX = 12;
const TOP_PROJECTS_VISIBLE_MOBILE = 2;
const TOP_PROJECTS_VISIBLE_DESKTOP = 3;

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
      className="bg-card border-border reveal shadow-none"
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
                    style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
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
          <div className="overflow-hidden">
            <div
              ref={synopsisRootRef}
              data-testid="top-projects-list"
              style={listLayoutStyle}
              className={`no-scrollbar -my-1 space-y-[var(--top-gap)] overflow-y-auto overscroll-contain pr-1 pt-1 pb-1 max-h-[calc((var(--top-card-h)*${TOP_PROJECTS_VISIBLE_MOBILE})+(var(--top-gap)*${TOP_PROJECTS_VISIBLE_MOBILE - 1})+0.5rem)] md:max-h-[calc((var(--top-card-h)*${TOP_PROJECTS_VISIBLE_DESKTOP})+(var(--top-gap)*${TOP_PROJECTS_VISIBLE_DESKTOP - 1})+0.5rem)]`}
            >
              {topProjects.map((entry, index) => {
                const metricValue =
                  mode === "30d" ? entry.views30d : mode === "7d" ? entry.views7d : entry.viewsAll;

                return (
                  <Link
                    key={entry.id}
                    data-testid={`top-project-item-${index + 1}`}
                    to={`/projeto/${entry.id}`}
                    className="group relative block h-(--top-card-h) rounded-2xl border border-border/50 bg-linear-to-br from-background/70 via-background/40 to-background/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
                  >
                    <div className="absolute inset-4 flex h-auto items-stretch gap-4">
                      <div
                        className="h-full shrink-0 overflow-hidden rounded-xl bg-secondary/60"
                        style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
                      >
                        <UploadPicture
                          src={entry.project.cover || "/placeholder.svg"}
                          alt={entry.title}
                          preset="posterThumb"
                          mediaVariants={mediaVariants}
                          sizes="96px"
                          className="block h-full w-full"
                          imgClassName="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      <div
                        data-synopsis-role="column"
                        data-synopsis-key={entry.id}
                        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                      >
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
                        <div data-synopsis-role="title" className="mt-1.5 space-y-1.5">
                          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
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
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopProjectsSection;
