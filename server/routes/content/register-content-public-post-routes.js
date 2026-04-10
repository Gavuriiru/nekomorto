import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../../bootstrap/assert-required-dependencies.js";
import { registerContentPostAdminListRoute } from "./public-posts/register-content-post-admin-list-route.js";
import { registerContentPostPollVoteRoute } from "./public-posts/register-content-post-poll-vote-route.js";
import { registerContentPostPublicDetailRoute } from "./public-posts/register-content-post-public-detail-route.js";
import { registerContentPostPublicListRoute } from "./public-posts/register-content-post-public-list-route.js";
import { registerContentPostViewRoute } from "./public-posts/register-content-post-view-route.js";

const pickContentPublicPostDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);

const ADMIN_LIST_DEPENDENCY_KEYS = [
  "app",
  "buildPublicMediaVariants",
  "createRevisionToken",
  "loadPosts",
  "normalizePosts",
  "requireAuth",
  "resolvePostCover",
];

const PUBLIC_LIST_DEPENDENCY_KEYS = [
  "PUBLIC_READ_CACHE_TAGS",
  "PUBLIC_READ_CACHE_TTL_MS",
  "app",
  "buildPublicMediaVariants",
  "loadPosts",
  "normalizePosts",
  "readPublicCachedJson",
  "resolvePostCover",
  "writePublicCachedJson",
];

const PUBLIC_DETAIL_DEPENDENCY_KEYS = [
  "app",
  "buildPublicMediaVariants",
  "loadPosts",
  "normalizePosts",
  "resolvePostCover",
];

const VIEW_DEPENDENCY_KEYS = [
  "app",
  "appendAnalyticsEvent",
  "canRegisterView",
  "getRequestIp",
  "incrementPostViews",
  "loadPosts",
  "normalizePosts",
];

const POLL_VOTE_DEPENDENCY_KEYS = [
  "app",
  "canRegisterPollVote",
  "getRequestIp",
  "loadPosts",
  "normalizePosts",
  "updateLexicalPollVotes",
  "writePosts",
];

export const registerContentPublicPostRoutes = (dependencies = {}) => {
  registerContentPostAdminListRoute(
    pickContentPublicPostDependencies(
      dependencies,
      "register-content-public-post-routes.admin-list",
      ADMIN_LIST_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostPublicListRoute(
    pickContentPublicPostDependencies(
      dependencies,
      "register-content-public-post-routes.public-list",
      PUBLIC_LIST_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostPublicDetailRoute(
    pickContentPublicPostDependencies(
      dependencies,
      "register-content-public-post-routes.public-detail",
      PUBLIC_DETAIL_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostViewRoute(
    pickContentPublicPostDependencies(
      dependencies,
      "register-content-public-post-routes.view",
      VIEW_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostPollVoteRoute(
    pickContentPublicPostDependencies(
      dependencies,
      "register-content-public-post-routes.poll-vote",
      POLL_VOTE_DEPENDENCY_KEYS,
    ),
  );
};

export default registerContentPublicPostRoutes;
