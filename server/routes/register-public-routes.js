import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../bootstrap/assert-required-dependencies.js";
import { registerPublicAnalyticsRoutes } from "./public/register-public-analytics-routes.js";
import { registerPublicBootstrapSearchRoutes } from "./public/register-public-bootstrap-search-routes.js";
import { registerPublicFeedsSitemapRoutes } from "./public/register-public-feeds-sitemap-routes.js";
import { registerPublicProjectRoutes } from "./public/register-public-project-routes.js";
import { registerPublicUpdateRoutes } from "./public/register-public-update-routes.js";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const pickPublicDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);
const shouldRegisterPublicGroup = (dependencies, activationKeys = []) =>
  activationKeys.some((key) => hasOwn(dependencies, key));

const FEEDS_SITEMAP_DEPENDENCY_KEYS = [
  "PRIMARY_APP_ORIGIN",
  "app",
  "buildLaunchesRssItems",
  "buildPostsRssItems",
  "buildPublicSitemapEntries",
  "buildRssXml",
  "buildSitemapXml",
  "loadSiteSettings",
  "sendXmlResponse",
];

const BOOTSTRAP_SEARCH_DEPENDENCY_KEYS = [
  "PUBLIC_BOOTSTRAP_MODE_FULL",
  "PUBLIC_READ_CACHE_TAGS",
  "PUBLIC_READ_CACHE_TTL_MS",
  "app",
  "buildPublicBootstrapResponsePayload",
  "buildPublicMediaVariants",
  "buildPublicSearchSuggestions",
  "loadPosts",
  "loadProjects",
  "loadTagTranslations",
  "normalizePosts",
  "normalizeProjects",
  "normalizeSearchQuery",
  "parseSearchLimit",
  "parseSearchScope",
  "publicSearchConfig",
  "readPublicCachedJson",
  "resolvePostCover",
  "writePublicCachedJson",
];

const PROJECT_DEPENDENCY_KEYS = [
  "PRIMARY_APP_ORIGIN",
  "PUBLIC_READ_CACHE_TAGS",
  "PUBLIC_READ_CACHE_TTL_MS",
  "app",
  "appendAnalyticsEvent",
  "buildProjectOgRevision",
  "buildPublicMediaVariants",
  "canRegisterPollVote",
  "canRegisterView",
  "deriveChapterSynopsis",
  "getProjectEpisodePageCount",
  "getPublicReadableProjects",
  "getPublicVisibleProjects",
  "hasProjectEpisodePages",
  "incrementProjectViews",
  "loadProjects",
  "loadSiteSettings",
  "loadTagTranslations",
  "normalizeProjectEpisodeContentFormat",
  "normalizeProjectEpisodePages",
  "normalizeProjects",
  "readPublicCachedJson",
  "resolveMetaImageVariantUrl",
  "resolveProjectReaderConfig",
  "updateLexicalPollVotes",
  "writeProjects",
  "writePublicCachedJson",
];

const ANALYTICS_DEPENDENCY_KEYS = [
  "PUBLIC_ANALYTICS_EVENT_TYPE_SET",
  "PUBLIC_ANALYTICS_RESOURCE_TYPE_SET",
  "app",
  "appendAnalyticsEvent",
  "canRegisterView",
];

const UPDATE_DEPENDENCY_KEYS = ["app", "getPublicVisibleUpdates"];

export const registerPublicRoutes = (dependencies = {}) => {
  if (shouldRegisterPublicGroup(dependencies, ["buildSitemapXml", "sendXmlResponse"])) {
    registerPublicFeedsSitemapRoutes(
      pickPublicDependencies(
        dependencies,
        "register-public-routes.feeds-sitemap",
        FEEDS_SITEMAP_DEPENDENCY_KEYS,
      ),
    );
  }
  if (
    shouldRegisterPublicGroup(dependencies, [
      "buildPublicBootstrapResponsePayload",
      "buildPublicSearchSuggestions",
    ])
  ) {
    registerPublicBootstrapSearchRoutes(
      pickPublicDependencies(
        dependencies,
        "register-public-routes.bootstrap-search",
        BOOTSTRAP_SEARCH_DEPENDENCY_KEYS,
      ),
    );
  }
  if (
    shouldRegisterPublicGroup(dependencies, [
      "getPublicVisibleProjects",
      "getPublicReadableProjects",
      "buildProjectOgRevision",
    ])
  ) {
    registerPublicProjectRoutes(
      pickPublicDependencies(
        dependencies,
        "register-public-routes.projects",
        PROJECT_DEPENDENCY_KEYS,
      ),
    );
  }
  if (
    shouldRegisterPublicGroup(dependencies, [
      "PUBLIC_ANALYTICS_EVENT_TYPE_SET",
      "PUBLIC_ANALYTICS_RESOURCE_TYPE_SET",
    ])
  ) {
    registerPublicAnalyticsRoutes(
      pickPublicDependencies(
        dependencies,
        "register-public-routes.public-analytics",
        ANALYTICS_DEPENDENCY_KEYS,
      ),
    );
  }
  if (shouldRegisterPublicGroup(dependencies, ["getPublicVisibleUpdates"])) {
    registerPublicUpdateRoutes(
      pickPublicDependencies(
        dependencies,
        "register-public-routes.updates",
        UPDATE_DEPENDENCY_KEYS,
      ),
    );
  }
};

export default registerPublicRoutes;
