import { useCallback, useEffect, useMemo, useState } from "react";

import PublicProjectCard, {
  PUBLIC_PROJECT_CARD_CLAMP_PROFILES,
  type PublicProjectCardBadge,
  resolvePublicProjectCardClampState,
  resolvePublicProjectCardResponsiveMaxLines,
} from "@/components/project/PublicProjectCard";
import type { Project } from "@/data/projects";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { buildTranslationMap, sortByTranslatedLabel, translateTag } from "@/lib/project-taxonomy";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import "@/styles/project-embed-card.css";
import type { PublicBootstrapPayload } from "@/types/public-bootstrap";

type ProjectEmbedCardProps = {
  projectId?: string | null;
};

type ProjectEmbedRecord = Pick<
  Project,
  "id" | "cover" | "episodes" | "status" | "studio" | "synopsis" | "tags" | "title" | "type"
>;

const PROJECT_EMBED_IMAGE_SIZES = "124px";
const embedClampProfile = PUBLIC_PROJECT_CARD_CLAMP_PROFILES.embed;

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
  const resolveEmbedSynopsisMaxLines = useCallback(
    ({ columnWidth, defaultMaxLines }: { columnWidth: number; defaultMaxLines: number }) =>
      resolvePublicProjectCardResponsiveMaxLines({
        profile: embedClampProfile,
        columnWidth,
        defaultMaxLines,
      }),
    [],
  );
  const { rootRef: synopsisRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: Boolean(projectId),
    keys: [synopsisKey],
    maxLines: embedClampProfile.defaultMaxLines,
    resolveMaxLines: resolveEmbedSynopsisMaxLines,
  });
  const sortedTags = useMemo(() => {
    const tags = Array.isArray(project?.tags) ? project.tags : [];
    return sortByTranslatedLabel(tags, (tag) => translateTag(tag, tagTranslationMap));
  }, [project?.tags, tagTranslationMap]);
  const primaryBadges = useMemo<PublicProjectCardBadge[]>(() => {
    const badges: Array<PublicProjectCardBadge | null> = [
      project?.status
        ? {
            key: "status",
            label: project.status,
            variant: "outline" as const,
            className: "max-w-[8.5rem] truncate",
          }
        : null,
      project?.studio
        ? {
            key: "studio",
            label: project.studio,
            variant: "outline" as const,
            className: "max-w-[8.5rem] truncate",
          }
        : null,
      project?.episodes
        ? {
            key: "episodes",
            label: project.episodes,
            variant: "outline" as const,
            className: "hidden sm:inline-flex",
          }
        : null,
    ];
    return badges.filter((badge): badge is PublicProjectCardBadge => badge != null);
  }, [project?.episodes, project?.status, project?.studio]);
  const synopsisClampState = resolvePublicProjectCardClampState({
    profile: embedClampProfile,
    lines: lineByKey[synopsisKey],
  });

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
    <PublicProjectCard
      variant="embed"
      testIdBase="project-embed"
      rowRef={synopsisRootRef}
      model={{
        href: `/projeto/${project?.id ?? projectId}`,
        title: project?.title || "Projeto",
        coverSrc: project?.cover || "/placeholder.svg",
        coverAlt: project?.title || "Projeto",
        mediaVariants: projectMediaVariants,
        eyebrow: project?.type || "",
        synopsis: project?.synopsis || "",
        synopsisKey,
        synopsisLines: synopsisClampState.synopsisLines,
        synopsisClampClass: synopsisClampState.synopsisClampClass,
        primaryBadges,
        secondaryBadges: sortedTags.slice(0, 4).map((tag) => ({
          key: `tag-${tag}`,
          label: translateTag(tag, tagTranslationMap),
          variant: "secondary",
        })),
      }}
      imageSizes={PROJECT_EMBED_IMAGE_SIZES}
    />
  );
};

export default ProjectEmbedCard;
