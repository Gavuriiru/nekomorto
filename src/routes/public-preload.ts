import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import type { PublicRoutePayload, PublicRouteProjectDetailPayload } from "@/types/public-bootstrap";
import {
  PUBLIC_ROUTE_KIND_ABOUT,
  PUBLIC_ROUTE_KIND_DONATIONS,
  PUBLIC_ROUTE_KIND_FAQ,
  PUBLIC_ROUTE_KIND_HOME,
  PUBLIC_ROUTE_KIND_LOGIN,
  PUBLIC_ROUTE_KIND_NOT_FOUND,
  PUBLIC_ROUTE_KIND_POST,
  PUBLIC_ROUTE_KIND_PRIVACY,
  PUBLIC_ROUTE_KIND_PROJECT_DETAIL,
  PUBLIC_ROUTE_KIND_PROJECT_READING,
  PUBLIC_ROUTE_KIND_PROJECTS_LIST,
  PUBLIC_ROUTE_KIND_RECRUITMENT,
  PUBLIC_ROUTE_KIND_TEAM,
  PUBLIC_ROUTE_KIND_TERMS,
  resolvePublicRouteKind,
} from "../../shared/public-route-registry.js";

const normalizePublicPrefetchPath = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) {
    return "";
  }
  return normalized;
};

const preloadedPublicRouteKinds = new Set<string>();
const preloadedPublicRoutePayloads = new Map<string, PublicRoutePayload | null>();
const inflightPublicRoutePayloads = new Map<string, Promise<PublicRoutePayload | null>>();
const prewarmedImageUrls = new Set<string>();

const normalizePathname = (value: string) => {
  const normalized = normalizePublicPrefetchPath(value);
  if (!normalized) {
    return "";
  }
  try {
    const url = new URL(normalized, "https://nekomata.moe");
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return normalized.replace(/\/+$/, "") || "/";
  }
};

const resolvePreloadCacheKey = (path: string) => normalizePathname(path);

const normalizeProjectRouteKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const resolveProjectSlugFromPath = (path: string) => {
  const pathname = normalizePathname(path);
  const match = pathname.match(/^\/projeto(?:s)?\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

const resolveBootstrapProjectForSlug = (slug: string) => {
  const routeKey = normalizeProjectRouteKey(slug);
  if (!routeKey) {
    return null;
  }
  const bootstrap = readWindowPublicBootstrap();
  return (
    bootstrap?.projects.find((candidate) => {
      const candidateId = String(candidate.id || "").trim();
      return (
        candidateId === slug ||
        normalizeProjectRouteKey(candidateId) === routeKey ||
        normalizeProjectRouteKey(candidate.title) === routeKey
      );
    }) || null
  );
};

const buildRelationProjectLookup = ({
  project,
  projects,
}: {
  project: {
    relations?: Array<{ projectId?: string | null; anilistId?: number | null }>;
  } | null;
  projects: Array<{ id?: string | null; anilistId?: number | null }>;
}) => {
  if (!project?.relations?.length) {
    return {};
  }
  const relationKeys = new Set<string>();
  project.relations.forEach((relation) => {
    const relationProjectId = String(relation?.projectId || "").trim();
    const relationAniListId = String(relation?.anilistId || "").trim();
    if (relationProjectId) {
      relationKeys.add(relationProjectId);
    }
    if (relationAniListId) {
      relationKeys.add(relationAniListId);
    }
  });
  return projects.reduce<Record<string, string>>((result, entry) => {
    const projectId = String(entry.id || "").trim();
    const anilistId = String(entry.anilistId || "").trim();
    if (projectId && relationKeys.has(projectId)) {
      result[projectId] = projectId;
    }
    if (anilistId && relationKeys.has(anilistId)) {
      result[anilistId] = projectId;
    }
    return result;
  }, {});
};

const prewarmImage = (value: string) => {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return;
  }
  const src = String(value || "").trim();
  if (!src || prewarmedImageUrls.has(src)) {
    return;
  }
  prewarmedImageUrls.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
};

const buildProjectDetailRoutePayload = ({
  generatedAt,
  project,
  response,
}: {
  generatedAt: string;
  project: Record<string, unknown> | null;
  response: Record<string, unknown>;
}): PublicRouteProjectDetailPayload => {
  const bootstrap = readWindowPublicBootstrap();
  const tagTranslations =
    response?.translations && typeof response.translations === "object"
      ? (response.translations as PublicRouteProjectDetailPayload["tagTranslations"])
      : bootstrap?.tagTranslations || { tags: {}, genres: {}, staffRoles: {} };
  const mediaVariants =
    response?.mediaVariants && typeof response.mediaVariants === "object"
      ? (response.mediaVariants as PublicRouteProjectDetailPayload["mediaVariants"])
      : {};
  return {
    kind: "project-detail",
    generatedAt,
    project: project as PublicRouteProjectDetailPayload["project"],
    revision: String(response?.revision || "").trim(),
    mediaVariants,
    relationProjectLookup: buildRelationProjectLookup({
      project: project as {
        relations?: Array<{ projectId?: string | null; anilistId?: number | null }>;
      } | null,
      projects: bootstrap?.projects || [],
    }),
    tagTranslations,
  };
};

const preloadProjectDetailPayload = async (path: string): Promise<PublicRoutePayload | null> => {
  const cacheKey = resolvePreloadCacheKey(path);
  if (!cacheKey) {
    return null;
  }
  if (preloadedPublicRoutePayloads.has(cacheKey)) {
    return preloadedPublicRoutePayloads.get(cacheKey) || null;
  }
  const inflight = inflightPublicRoutePayloads.get(cacheKey);
  if (inflight) {
    return await inflight;
  }
  const slug = resolveProjectSlugFromPath(cacheKey);
  if (!slug) {
    return null;
  }
  const requestPromise = (async () => {
    try {
      const bootstrap = readWindowPublicBootstrap();
      const bootstrapProject = resolveBootstrapProjectForSlug(slug);
      const projectId = String(bootstrapProject?.id || slug).trim();
      if (!projectId) {
        return null;
      }
      const response = await apiFetch(getApiBase(), `/api/public/projects/${encodeURIComponent(projectId)}`, {
        cache: "force-cache",
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, unknown>;
      const project =
        data?.project && typeof data.project === "object"
          ? (data.project as Record<string, unknown>)
          : null;
      const payload = buildProjectDetailRoutePayload({
        generatedAt: String(bootstrap?.generatedAt || ""),
        project,
        response: data,
      });
      prewarmImage(String(project?.banner || ""));
      prewarmImage(String(project?.heroImageUrl || ""));
      prewarmImage(String(project?.cover || ""));
      return payload;
    } catch {
      return null;
    } finally {
      inflightPublicRoutePayloads.delete(cacheKey);
    }
  })();
  inflightPublicRoutePayloads.set(cacheKey, requestPromise);
  const payload = await requestPromise;
  preloadedPublicRoutePayloads.set(cacheKey, payload);
  return payload;
};

const loadPublicRouteModule = (routeKind: string) => {
  switch (routeKind) {
    case PUBLIC_ROUTE_KIND_HOME:
      return import("@/pages/Index");
    case PUBLIC_ROUTE_KIND_POST:
      return import("@/pages/Post");
    case PUBLIC_ROUTE_KIND_TEAM:
      return import("@/pages/Team");
    case PUBLIC_ROUTE_KIND_ABOUT:
      return import("@/pages/About");
    case PUBLIC_ROUTE_KIND_DONATIONS:
      return import("@/pages/Donations");
    case PUBLIC_ROUTE_KIND_FAQ:
      return import("@/pages/FAQ");
    case PUBLIC_ROUTE_KIND_PROJECTS_LIST:
      return import("@/pages/Projects");
    case PUBLIC_ROUTE_KIND_PROJECT_DETAIL:
      return import("@/pages/Project");
    case PUBLIC_ROUTE_KIND_PROJECT_READING:
      return import("@/pages/ProjectReading");
    case PUBLIC_ROUTE_KIND_RECRUITMENT:
      return import("@/pages/Recruitment");
    case PUBLIC_ROUTE_KIND_TERMS:
      return import("@/pages/TermsOfService");
    case PUBLIC_ROUTE_KIND_PRIVACY:
      return import("@/pages/PrivacyPolicy");
    case PUBLIC_ROUTE_KIND_LOGIN:
      return import("@/pages/Login");
    default:
      return null;
  }
};

export const preloadPublicRoute = async (path: string) => {
  const normalizedPath = normalizePublicPrefetchPath(path);
  if (!normalizedPath) {
    return null;
  }
  const routeKind = resolvePublicRouteKind(normalizedPath);
  if (routeKind === PUBLIC_ROUTE_KIND_NOT_FOUND) {
    return null;
  }
  if (preloadedPublicRouteKinds.has(routeKind)) {
    return routeKind === PUBLIC_ROUTE_KIND_PROJECT_DETAIL
      ? preloadProjectDetailPayload(normalizedPath)
      : preloadedPublicRoutePayloads.get(resolvePreloadCacheKey(normalizedPath)) || null;
  }
  const loadRoute = loadPublicRouteModule(routeKind);
  if (!loadRoute) {
    return null;
  }
  preloadedPublicRouteKinds.add(routeKind);
  const codePreloadPromise = loadRoute.catch(() => {
    preloadedPublicRouteKinds.delete(routeKind);
    return null;
  });
  const payloadPreloadPromise =
    routeKind === PUBLIC_ROUTE_KIND_PROJECT_DETAIL
      ? preloadProjectDetailPayload(normalizedPath)
      : Promise.resolve(null);
  const [, payload] = await Promise.all([codePreloadPromise, payloadPreloadPromise]);
  return payload;
};

export const preloadPublicRoutePayload = async (path: string) => {
  const normalizedPath = normalizePublicPrefetchPath(path);
  if (!normalizedPath) {
    return null;
  }
  const routeKind = resolvePublicRouteKind(normalizedPath);
  if (routeKind !== PUBLIC_ROUTE_KIND_PROJECT_DETAIL) {
    return null;
  }
  return await preloadProjectDetailPayload(normalizedPath);
};

export const peekPreloadedPublicRoutePayload = (path: string) => {
  const cacheKey = resolvePreloadCacheKey(path);
  if (!cacheKey) {
    return null;
  }
  return preloadedPublicRoutePayloads.get(cacheKey) || null;
};

export const getPublicRoutePreloadHandlers = (path: string) => {
  const runPreload = () => {
    void preloadPublicRoute(path);
  };
  return {
    onFocus: runPreload,
    onMouseEnter: runPreload,
    onTouchStart: runPreload,
  };
};

export const clearPublicRoutePreloadCacheForTests = () => {
  preloadedPublicRouteKinds.clear();
  preloadedPublicRoutePayloads.clear();
  inflightPublicRoutePayloads.clear();
  prewarmedImageUrls.clear();
};
