import {
  createPublicVisibilityRuntime,
} from "../lib/public-visibility-runtime.js";
import {
  createPublicSiteRuntime,
} from "../lib/public-site-runtime.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const PUBLIC_RUNTIME_DEPENDENCY_KEYS = [
  "buildPublicBootstrapPayload",
  "buildPublicMediaVariants",
  "buildPublicReadableProjects",
  "buildPublicTeamMembers",
  "buildPublicVisibleProjects",
  "buildUserPayload",
  "createGuid",
  "createSlug",
  "extractLocalStylesheetHrefs",
  "injectBootstrapGlobals",
  "injectHomeHeroShell",
  "injectPreloadLinks",
  "isEpisodePublic",
  "loadLinkTypes",
  "loadPages",
  "loadPosts",
  "loadProjects",
  "loadSiteSettings",
  "loadTagTranslations",
  "loadUpdates",
  "normalizePosts",
  "normalizeProjects",
  "primaryAppOrigin",
  "resolveEpisodeLookup",
  "resolveHomeHeroPreloadFromSlide",
  "resolveMetaImageVariantUrl",
  "resolvePostCover",
  "resolvePublicPostCoverPreload",
  "resolvePublicProjectsListPreloads",
  "resolvePublicReaderHeroPreload",
  "resolvePublicTeamAvatarPreload",
  "sitemapStaticPublicPaths",
  "stripHtml",
];

export const createPublicRuntimeBundle = (dependencies = {}) => {
  assertRequiredDependencies(
    "createPublicRuntimeBundle",
    dependencies,
    PUBLIC_RUNTIME_DEPENDENCY_KEYS,
  );
  if (
    dependencies.bootstrapPwaEnabled === undefined &&
    typeof dependencies.resolveBootstrapPwaEnabled !== "function"
  ) {
    throw new Error(
      "[createPublicRuntimeBundle] missing required dependencies: bootstrapPwaEnabled or resolveBootstrapPwaEnabled",
    );
  }

  const publicVisibilityRuntime = createPublicVisibilityRuntime({
    buildPublicReadableProjects: dependencies.buildPublicReadableProjects,
    buildPublicVisibleProjects: dependencies.buildPublicVisibleProjects,
    isEpisodePublic: dependencies.isEpisodePublic,
    loadPosts: dependencies.loadPosts,
    loadProjects: dependencies.loadProjects,
    loadUpdates: dependencies.loadUpdates,
    normalizePosts: dependencies.normalizePosts,
    normalizeProjects: dependencies.normalizeProjects,
    resolveEpisodeLookup: dependencies.resolveEpisodeLookup,
  });

  const publicSiteRuntime = createPublicSiteRuntime({
    bootstrapPwaEnabled: dependencies.bootstrapPwaEnabled,
    buildPublicBootstrapPayload: dependencies.buildPublicBootstrapPayload,
    buildPublicMediaVariants: dependencies.buildPublicMediaVariants,
    buildPublicTeamMembers: dependencies.buildPublicTeamMembers,
    buildUserPayload: dependencies.buildUserPayload,
    createGuid: dependencies.createGuid,
    createSlug: dependencies.createSlug,
    extractLocalStylesheetHrefs: dependencies.extractLocalStylesheetHrefs,
    getPublicVisiblePosts: publicVisibilityRuntime.getPublicVisiblePosts,
    getPublicVisibleProjects: publicVisibilityRuntime.getPublicVisibleProjects,
    getPublicVisibleUpdates: publicVisibilityRuntime.getPublicVisibleUpdates,
    injectBootstrapGlobals: dependencies.injectBootstrapGlobals,
    injectHomeHeroShell: dependencies.injectHomeHeroShell,
    injectPreloadLinks: dependencies.injectPreloadLinks,
    loadLinkTypes: dependencies.loadLinkTypes,
    loadPages: dependencies.loadPages,
    loadSiteSettings: dependencies.loadSiteSettings,
    loadTagTranslations: dependencies.loadTagTranslations,
    primaryAppOrigin: dependencies.primaryAppOrigin,
    resolveBootstrapPwaEnabled: dependencies.resolveBootstrapPwaEnabled,
    resolveHomeHeroPreloadFromSlide: dependencies.resolveHomeHeroPreloadFromSlide,
    resolveMetaImageVariantUrl: dependencies.resolveMetaImageVariantUrl,
    resolvePostCover: dependencies.resolvePostCover,
    resolvePublicPostCoverPreload: dependencies.resolvePublicPostCoverPreload,
    resolvePublicProjectsListPreloads: dependencies.resolvePublicProjectsListPreloads,
    resolvePublicReaderHeroPreload: dependencies.resolvePublicReaderHeroPreload,
    resolvePublicTeamAvatarPreload: dependencies.resolvePublicTeamAvatarPreload,
    sitemapStaticPublicPaths: dependencies.sitemapStaticPublicPaths,
    stripHtml: dependencies.stripHtml,
  });

  return {
    ...publicVisibilityRuntime,
    ...publicSiteRuntime,
  };
};

export default createPublicRuntimeBundle;
