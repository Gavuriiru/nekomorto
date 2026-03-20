import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProjectReadingInfoBarProps = {
  projectTitle: string;
  chapterTitle: string;
  chapterLabel: string;
  projectType: string;
  synopsis?: string;
  volume?: number;
  pageSummary?: string | null;
  actions?: ReactNode;
  variant?: "default" | "reader-full-bleed" | "reader-cinema";
};

const ProjectReadingInfoBar = ({
  projectTitle,
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

  return (
    <section
      data-testid="project-reading-info-bar"
      data-variant={variant}
      className={cn("project-reading-info-shell w-full", isCinemaVariant ? "pointer-events-none" : "")}
    >
      <div
        data-testid="project-reading-reader-bar"
        className={cn(
          "project-reading-info-bar flex w-full gap-4",
          isReaderVariant ? "" : "mx-auto",
          isCinemaVariant
            ? "pointer-events-auto items-start border-b border-border/60 bg-background/80 px-4 py-3 md:px-6 md:py-4"
            : "px-4 py-3 md:px-6 md:py-4",
        )}
        style={isReaderVariant ? undefined : { maxWidth: "1600px" }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className={cn("min-w-0 space-y-3", isCinemaVariant ? "space-y-2" : "")}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/35 bg-primary/10 text-foreground">
                {projectType || "Mangá"}
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
                {chapterLabel}
              </Badge>
              {Number.isFinite(volume) ? (
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
                  Volume {volume}
                </Badge>
              ) : null}
              {pageSummary ? (
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
                  Página {pageSummary}
                </Badge>
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-primary/80">
                {projectTitle}
              </p>
              <h1
                className={cn(
                  "line-clamp-2 font-semibold tracking-tight text-foreground",
                  isCinemaVariant ? "text-lg md:text-2xl" : "text-2xl md:text-3xl",
                )}
              >
                {chapterTitle}
              </h1>
            </div>

            {synopsis ? (
              <p
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
          </div>
        </div>

        {actions ? (
          <div className={cn("flex shrink-0 items-start gap-2", isCinemaVariant ? "pt-0.5" : "")}>
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ProjectReadingInfoBar;
