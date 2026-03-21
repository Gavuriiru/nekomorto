import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProjectReadingInfoBarProps = {
  projectTitle: string;
  projectHref?: string;
  chapterTitle: string;
  chapterLabel: string;
  projectType: string;
  synopsis?: string;
  volume?: number;
  pageSummary?: string | null;
  actions?: ReactNode;
  variant?: "default" | "reader-full-bleed" | "reader-cinema";
};

const normalizeProjectType = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const formatReaderChapterLabel = (value: string) => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.replace(/^cap(?:itulo|ítulo|\.)?\s+/i, "Capítulo ");
};

const ProjectReadingInfoBar = ({
  projectTitle,
  projectHref,
  chapterTitle,
  chapterLabel,
  projectType,
  synopsis = "",
  volume,
  pageSummary,
  actions,
  variant = "default",
}: ProjectReadingInfoBarProps) => {
  const isReaderVariant = variant === "reader-full-bleed" || variant === "reader-cinema";
  const isCinemaVariant = variant === "reader-cinema";
  const shouldShowProjectTypeBadge = normalizeProjectType(projectType) !== "manga";
  const chapterContextTitle =
    String(chapterTitle || "").trim() || formatReaderChapterLabel(chapterLabel);

  return (
    <section
      data-testid="project-reading-info-bar"
      data-variant={variant}
      className={cn(
        "project-reading-info-shell w-full",
        isCinemaVariant ? "pointer-events-none" : "",
      )}
    >
      <div
        data-testid="project-reading-reader-bar"
        className={cn(
          "project-reading-info-bar flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between",
          isReaderVariant ? "" : "mx-auto",
          isCinemaVariant
            ? "pointer-events-auto border-b border-border/60 bg-background/80 px-4 py-2 md:px-6 md:py-3"
            : "px-4 py-2 md:px-6 md:py-3",
        )}
        style={isReaderVariant ? undefined : { maxWidth: "1600px" }}
      >
        <div className={cn("min-w-0 flex-1", isCinemaVariant ? "space-y-1.5" : "space-y-2.5")}>
          <div
            data-testid="project-reading-context-row"
            className={cn("min-w-0", isCinemaVariant ? "space-y-1" : "space-y-1.5")}
          >
            {shouldShowProjectTypeBadge ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/35 bg-primary/10 text-foreground"
                >
                  {projectType}
                </Badge>
              </div>
            ) : null}

            {chapterContextTitle ? (
              <h1
                data-testid="project-reading-chapter-context"
                className={cn(
                  "line-clamp-2 font-semibold tracking-tight text-foreground",
                  isCinemaVariant ? "text-lg md:text-2xl" : "text-2xl md:text-3xl",
                )}
              >
                {chapterContextTitle}
              </h1>
            ) : null}
          </div>

          <div className="min-w-0">
            {projectHref ? (
              <Link
                data-testid="project-reading-project-title"
                to={projectHref}
                className={cn(
                  "min-w-0 font-medium text-primary transition-colors hover:text-primary/85",
                  isCinemaVariant ? "text-xs md:text-sm" : "text-sm md:text-base",
                )}
              >
                {projectTitle}
              </Link>
            ) : (
              <p
                data-testid="project-reading-project-title"
                className={cn(
                  "min-w-0 font-medium text-primary",
                  isCinemaVariant ? "text-xs md:text-sm" : "text-sm md:text-base",
                )}
              >
                {projectTitle}
              </p>
            )}
          </div>

          {synopsis ? (
            <p
              data-testid="project-reading-synopsis"
              className={cn(
                isCinemaVariant
                  ? "line-clamp-1 text-xs leading-5 text-muted-foreground md:line-clamp-2 md:text-sm md:leading-6"
                  : "line-clamp-2 text-sm leading-6 text-muted-foreground",
                isReaderVariant ? "max-w-none" : "max-w-4xl",
              )}
            >
              {synopsis}
            </p>
          ) : null}

          <div data-testid="project-reading-meta-row" className="flex flex-wrap items-center gap-2">
            {Number.isFinite(volume) ? (
              <Badge
                variant="outline"
                className="border-border/70 bg-background/80 text-foreground"
              >
                Volume {volume}
              </Badge>
            ) : null}
            {pageSummary ? (
              <Badge
                variant="outline"
                className="border-border/70 bg-background/80 text-foreground"
              >
                Página {pageSummary}
              </Badge>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap items-start justify-start gap-2 md:w-auto md:justify-end md:self-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ProjectReadingInfoBar;
