import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Project } from "@/data/projects";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import { buildTranslationMap, sortByTranslatedLabel, translateTag } from "@/lib/project-taxonomy";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type { PublicBootstrapPayload } from "@/types/public-bootstrap";

type ProjectEmbedCardProps = {
  projectId?: string | null;
};

type ProjectEmbedRecord = Pick<
  Project,
  "id" | "cover" | "episodes" | "status" | "studio" | "synopsis" | "tags" | "title" | "type"
>;

const COVER_ROW_HEIGHT = "calc(8rem * 65 / 46)";

const resolveBootstrapProject = (
  bootstrapData: PublicBootstrapPayload | null,
  projectId: string | null | undefined,
): ProjectEmbedRecord | null => {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return null;
  }
  const match =
    bootstrapData?.projects.find(
      (candidate) => String(candidate.id || "").trim() === normalizedProjectId,
    ) || null;
  if (!match) {
    return null;
  }
  return {
    id: match.id,
    cover: match.cover,
    episodes: match.episodes,
    status: match.status,
    studio: match.studio,
    synopsis: match.synopsis,
    tags: match.tags,
    title: match.title,
    type: match.type,
  };
};

const mergeMediaVariants = (base: UploadMediaVariantsMap, nextValue: unknown) => ({
  ...base,
  ...(nextValue && typeof nextValue === "object" ? (nextValue as UploadMediaVariantsMap) : {}),
});

const ProjectEmbedCard = ({ projectId }: ProjectEmbedCardProps) => {
  const apiBase = getApiBase();
  const [bootstrapData] = useState<PublicBootstrapPayload | null>(() =>
    readWindowPublicBootstrap(),
  );
  const bootstrapProject = useMemo(
    () => resolveBootstrapProject(bootstrapData, projectId),
    [bootstrapData, projectId],
  );
  const [project, setProject] = useState<ProjectEmbedRecord | null>(bootstrapProject);
  const [projectMediaVariants, setProjectMediaVariants] = useState<UploadMediaVariantsMap>(
    () => bootstrapData?.mediaVariants || {},
  );
  const [hasLoaded, setHasLoaded] = useState(Boolean(bootstrapProject));
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    () => bootstrapData?.tagTranslations?.tags || {},
  );
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
    setProject(bootstrapProject);
    setProjectMediaVariants(bootstrapData?.mediaVariants || {});
    setHasLoaded(Boolean(bootstrapProject));
    setTagTranslations(bootstrapData?.tagTranslations?.tags || {});
  }, [bootstrapData, bootstrapProject]);

  useEffect(() => {
    if (!projectId || bootstrapProject) {
      return;
    }
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, `/api/public/projects/${projectId}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
          setProjectMediaVariants((current) =>
            mergeMediaVariants(bootstrapData?.mediaVariants || current, data?.mediaVariants),
          );
        }
      } catch {
        if (isActive) {
          setProject(null);
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, bootstrapData?.mediaVariants, bootstrapProject, projectId]);

  useEffect(() => {
    if (Object.keys(tagTranslations).length > 0) {
      return;
    }
    let isActive = true;
    const loadTranslations = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });
        if (!response.ok || !isActive) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setTagTranslations(
            data?.tags && typeof data.tags === "object"
              ? (data.tags as Record<string, string>)
              : {},
          );
        }
      } catch {
        // Ignore translation fallback failures outside bootstrap-enabled routes.
      }
    };
    void loadTranslations();
    return () => {
      isActive = false;
    };
  }, [apiBase, tagTranslations]);

  if (!projectId) {
    return null;
  }
  if (!project && hasLoaded) {
    return null;
  }

  return (
    <Link
      to={`/projeto/${project?.id ?? projectId}`}
      className="block rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg">
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
                <span className="clamp-safe-2 text-lg font-semibold text-foreground transition group-hover:text-primary">
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
                <div
                  data-testid="project-embed-primary-badges"
                  className="flex flex-nowrap items-center gap-2 overflow-hidden text-xs sm:flex-wrap"
                >
                  {project?.status ? (
                    <Badge
                      data-testid="project-embed-status-badge"
                      variant="outline"
                      className="max-w-[8.5rem] truncate"
                    >
                      {project.status}
                    </Badge>
                  ) : null}
                  {project?.studio ? (
                    <Badge
                      data-testid="project-embed-studio-badge"
                      variant="outline"
                      className="max-w-[8.5rem] truncate"
                    >
                      {project.studio}
                    </Badge>
                  ) : null}
                  {project?.episodes ? (
                    <Badge
                      data-testid="project-embed-episodes-badge"
                      variant="outline"
                      className="hidden sm:inline-flex"
                    >
                      {project.episodes}
                    </Badge>
                  ) : null}
                </div>
                {project?.tags?.length ? (
                  <div
                    data-testid="project-embed-tags"
                    className="hidden flex-wrap gap-1.5 sm:flex"
                  >
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
