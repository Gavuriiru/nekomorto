import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import UploadPicture from "@/components/UploadPicture";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { buildTranslationMap, sortByTranslatedLabel, translateTag } from "@/lib/project-taxonomy";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import type { Project } from "@/data/projects";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

type ProjectEmbedCardProps = {
  projectId?: string | null;
};

const COVER_ROW_HEIGHT = "calc(8rem * 65 / 46)";

const ProjectEmbedCard = ({ projectId }: ProjectEmbedCardProps) => {
  const apiBase = getApiBase();
  const [project, setProject] = useState<Project | null>(null);
  const [projectMediaVariants, setProjectMediaVariants] = useState<UploadMediaVariantsMap>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const synopsisKey = project?.id ?? projectId ?? "project-embed";
  const { rootRef: synopsisRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: Boolean(projectId),
    keys: [synopsisKey],
    maxLines: 4,
  });
  const sortedTags = useMemo(() => {
    const tags = Array.isArray(project?.tags) ? project.tags : [];
    return sortByTranslatedLabel(tags, (tag) => translateTag(tag, tagTranslationMap));
  }, [project?.tags, tagTranslationMap]);
  const synopsisMaxLines = (() => {
    const lines = lineByKey[synopsisKey];
    if (typeof lines !== "number") {
      return 2;
    }
    return Math.max(1, Math.min(lines, 4));
  })();

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, `/api/public/projects/${projectId}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
            setProjectMediaVariants({});
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
          setProjectMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
        }
      } catch {
        if (isActive) {
          setProject(null);
          setProjectMediaVariants({});
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, projectId]);

  useEffect(() => {
    let isActive = true;
    const loadTranslations = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setTagTranslations(data.tags || {});
        }
      } catch {
        if (isActive) {
          setTagTranslations({});
        }
      }
    };
    loadTranslations();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  if (!projectId) {
    return null;
  }
  if (!project && hasLoaded) {
    return null;
  }

  return (
    <Link
      to={`/projeto/${project?.id ?? projectId}`}
      className="block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
    >
      <Card className="border-border bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
        <CardContent className="space-y-4 p-4">
          <div
            ref={synopsisRootRef}
            data-testid="project-embed-row"
            className="group flex items-stretch gap-4"
            style={{ height: COVER_ROW_HEIGHT }}
          >
            <div
              className="h-full shrink-0 self-start overflow-hidden rounded-xl"
              style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
            >
              <UploadPicture
                src={project?.cover || "/placeholder.svg"}
                alt={project?.title || "Projeto"}
                preset="poster"
                mediaVariants={projectMediaVariants}
                className="block h-full w-full"
                imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div
              data-synopsis-role="column"
              data-synopsis-key={synopsisKey}
              className="flex min-h-0 min-w-0 flex-1 self-stretch flex-col overflow-hidden"
            >
              <div data-synopsis-role="title" className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                  {project?.type || ""}
                </p>
                <span className="line-clamp-2 text-lg font-semibold text-foreground transition group-hover:text-primary">
                  {project?.title || "Projeto"}
                </span>
              </div>
              <p
                data-synopsis-role="synopsis"
                data-synopsis-lines={synopsisMaxLines}
                className="mt-2 text-sm text-muted-foreground break-normal [overflow-wrap:normal] [word-break:normal]"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: synopsisMaxLines,
                  overflow: "hidden",
                }}
              >
                {project?.synopsis || ""}
              </p>
              <div data-synopsis-role="badges" className="mt-auto space-y-2 pt-2">
                <div data-testid="project-embed-primary-badges" className="flex flex-nowrap items-center gap-2 overflow-hidden text-xs sm:flex-wrap">
                  {project?.status ? (
                    <Badge data-testid="project-embed-status-badge" variant="outline" className="max-w-[8.5rem] truncate">
                      {project.status}
                    </Badge>
                  ) : null}
                  {project?.studio ? (
                    <Badge data-testid="project-embed-studio-badge" variant="outline" className="max-w-[8.5rem] truncate">
                      {project.studio}
                    </Badge>
                  ) : null}
                  {project?.episodes ? (
                    <Badge data-testid="project-embed-episodes-badge" variant="outline" className="hidden sm:inline-flex">
                      {project.episodes}
                    </Badge>
                  ) : null}
                </div>
                {project?.tags?.length ? (
                  <div data-testid="project-embed-tags" className="hidden flex-wrap gap-1.5 sm:flex">
                    {sortedTags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] uppercase">
                        {translateTag(tag, tagTranslationMap)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProjectEmbedCard;
