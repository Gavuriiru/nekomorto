import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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

const formatReaderChapterLabel = (value: string) => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.replace(/^cap(?:itulo|\u00edtulo|\.)?\s+/i, "Cap\u00edtulo ");
};

const ProjectReadingInfoBar = ({
  projectTitle,
  projectHref,
  chapterTitle,
  chapterLabel,
  synopsis = "",
  actions,
  variant = "default",
}: ProjectReadingInfoBarProps) => {
  const isReaderVariant = variant === "reader-full-bleed" || variant === "reader-cinema";
  const isCinemaVariant = variant === "reader-cinema";
  const chapterContextTitle =
    String(chapterTitle || "").trim() || formatReaderChapterLabel(chapterLabel);
  const trimmedSynopsis = String(synopsis || "").trim();

  const projectTitleNode = projectHref ? (
    <Link
      data-testid="project-reading-project-title"
      to={projectHref}
      className={cn(
        "project-reading-masthead__overline min-w-0 transition-colors hover:text-primary/85",
        isReaderVariant ? "project-reading-info-project-link" : "",
      )}
    >
      {projectTitle}
    </Link>
  ) : (
    <p
      data-testid="project-reading-project-title"
      className={cn(
        "project-reading-masthead__overline min-w-0",
        isReaderVariant ? "project-reading-info-project-link" : "",
      )}
    >
      {projectTitle}
    </p>
  );

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
          "project-reading-info-bar flex w-full flex-col gap-4 px-4 py-3 md:flex-row md:items-start md:justify-between md:px-6 md:py-4",
          isReaderVariant ? "" : "mx-auto",
          isCinemaVariant ? "pointer-events-auto" : "",
        )}
        style={isReaderVariant ? undefined : { maxWidth: "1600px" }}
      >
        <div className="min-w-0 flex-1">
          {isReaderVariant ? (
            <div className="project-reading-masthead__heading space-y-3">
              <div
                data-testid="project-reading-context-row"
                className="project-reading-info-context-row flex flex-wrap items-center gap-2.5"
              >
                {projectTitleNode}
              </div>

              {chapterContextTitle ? (
                <h1
                  data-testid="project-reading-chapter-context"
                  className="project-reading-masthead__title project-reading-info-title line-clamp-2 max-w-none"
                >
                  {chapterContextTitle}
                </h1>
              ) : null}

              {trimmedSynopsis ? (
                <p
                  data-testid="project-reading-synopsis"
                  className="project-reading-masthead__synopsis project-reading-info-synopsis max-w-3xl"
                >
                  {trimmedSynopsis}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="project-reading-masthead__heading space-y-2">
                {projectTitleNode}

                {chapterContextTitle ? (
                  <h1
                    data-testid="project-reading-chapter-context"
                    className="project-reading-masthead__title project-reading-info-title line-clamp-2 max-w-none"
                  >
                    {chapterContextTitle}
                  </h1>
                ) : null}
              </div>

              {trimmedSynopsis ? (
                <p
                  data-testid="project-reading-synopsis"
                  className="project-reading-masthead__synopsis mt-4 max-w-3xl"
                >
                  {trimmedSynopsis}
                </p>
              ) : null}
            </>
          )}
        </div>

        {actions ? (
          <div
            data-testid="project-reading-actions"
            className={cn(
              "project-reading-info-actions flex w-full shrink-0 flex-wrap items-center justify-start gap-2",
              isReaderVariant
                ? "md:w-auto md:max-w-xs md:justify-end md:self-start"
                : "md:w-auto md:justify-end md:self-end",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ProjectReadingInfoBar;
