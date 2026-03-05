import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";

const TOP_PROJECTS_LIMIT = 10;
const TOP_PROJECTS_LAST_DAYS = 30;
const TOP_PROJECTS_CARD_HEIGHT_PX = 164;
const TOP_PROJECTS_GAP_PX = 12;
const TOP_PROJECTS_VISIBLE_MOBILE = 2;
const TOP_PROJECTS_VISIBLE_DESKTOP = 3;

type TopProjectsMode = "all" | "30d";

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
    const dayKeys = buildRecentUtcDayKeys(TOP_PROJECTS_LAST_DAYS);
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
        const views30d = sumViewsByDayKeys(normalizedViewsDaily, dayKeys);
        return {
          project,
          id,
          title,
          viewsAll,
          views30d,
        };
      })
      .filter((item) => item.id && item.title)
      .sort((left, right) => {
        const leftMetric = mode === "30d" ? left.views30d : left.viewsAll;
        const rightMetric = mode === "30d" ? right.views30d : right.viewsAll;
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

  return (
    <Card id="top-projetos" className="bg-card border-border reveal" data-reveal>
      <CardHeader className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold text-foreground">Projetos Populares</CardTitle>
          <Select value={mode} onValueChange={(value) => setMode(value === "30d" ? "30d" : "all")}>
            <SelectTrigger
              aria-label="Ordenar Top 10 por visualizacoes"
              data-testid="top-projects-mode-trigger"
              className="h-7 w-[92px] bg-background/70 px-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sempre</SelectItem>
              <SelectItem value="30d">30d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoadingProjects ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`top-projects-skeleton-${index}`} className="rounded-2xl bg-background/40 p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-32 shrink-0 rounded-xl" style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }} />
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
            Sem dados de visualizacao ainda.
          </div>
        ) : (
          <div
            data-testid="top-projects-list"
            style={listLayoutStyle}
            className={`no-scrollbar space-y-[var(--top-gap)] overflow-y-auto overscroll-contain pr-1 max-h-[calc((var(--top-card-h)*${TOP_PROJECTS_VISIBLE_MOBILE})+(var(--top-gap)*${TOP_PROJECTS_VISIBLE_MOBILE - 1}))] md:max-h-[calc((var(--top-card-h)*${TOP_PROJECTS_VISIBLE_DESKTOP})+(var(--top-gap)*${TOP_PROJECTS_VISIBLE_DESKTOP - 1}))]`}
          >
            {topProjects.map((entry, index) => {
              const metricValue = mode === "30d" ? entry.views30d : entry.viewsAll;

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

                    <div className="flex h-full min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          #{index + 1}
                        </Badge>
                        <span
                          data-testid={`top-project-item-${index + 1}-metric`}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                          aria-label={`Visualizacoes: ${numberFormatter.format(metricValue)}`}
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground/80" aria-hidden="true" />
                          {numberFormatter.format(metricValue)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px]">
                          <span className="max-w-full truncate uppercase tracking-[0.16em] text-primary/80">
                            {entry.project.type || "Projeto"}
                          </span>
                          {entry.project.status ? (
                            <span className="max-w-full truncate text-muted-foreground">- {entry.project.status}</span>
                          ) : null}
                        </div>
                        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                          {entry.title}
                        </h3>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
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
        )}
      </CardContent>
    </Card>
  );
};

export default TopProjectsSection;

