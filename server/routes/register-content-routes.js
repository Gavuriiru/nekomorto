import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../bootstrap/assert-required-dependencies.js";
import { registerContentCommentRoutes } from "./content/register-content-comment-routes.js";
import { registerContentEditorialCalendarRoutes } from "./content/register-content-editorial-calendar-routes.js";
import { registerContentLinkTypeRoutes } from "./content/register-content-link-type-routes.js";
import { registerContentPostRoutes } from "./content/register-content-post-routes.js";
import { registerContentPostVersionRoutes } from "./content/register-content-post-version-routes.js";
import { registerContentPublicPostRoutes } from "./content/register-content-public-post-routes.js";

const pickContentDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);

const LINK_TYPE_DEPENDENCY_KEYS = [
  "app",
  "canManageSettings",
  "collectLinkTypeIconUploads",
  "createRevisionToken",
  "deletePrivateUploadByUrl",
  "ensureNoEditConflict",
  "loadLinkTypes",
  "normalizeLinkTypes",
  "parseEditRevisionOptions",
  "requireAuth",
  "writeLinkTypes",
];

const PUBLIC_POST_DEPENDENCY_KEYS = [
  "PUBLIC_READ_CACHE_TAGS",
  "PUBLIC_READ_CACHE_TTL_MS",
  "app",
  "appendAnalyticsEvent",
  "buildPublicMediaVariants",
  "canRegisterPollVote",
  "canRegisterView",
  "createRevisionToken",
  "incrementPostViews",
  "loadPosts",
  "normalizePosts",
  "readPublicCachedJson",
  "requireAuth",
  "resolvePostCover",
  "updateLexicalPollVotes",
  "writePosts",
  "writePublicCachedJson",
];

const COMMENT_DEPENDENCY_KEYS = [
  "PRIMARY_APP_ORIGIN",
  "app",
  "appendAnalyticsEvent",
  "appendAuditLog",
  "applyCommentCountToPosts",
  "applyCommentCountToProjects",
  "buildGravatarUrl",
  "bulkModeratePendingComments",
  "canManageComments",
  "canSubmitComment",
  "createGravatarHash",
  "loadComments",
  "loadPosts",
  "loadProjects",
  "normalizeEmail",
  "normalizePosts",
  "normalizeProjects",
  "requireAuth",
  "resolveGravatarAvatarUrl",
  "writeComments",
  "writePosts",
  "writeProjects",
];

const POST_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "canManagePosts",
  "createRevisionToken",
  "createSlug",
  "createUniqueSlug",
  "dispatchEditorialWebhookEvent",
  "ensureNoEditConflict",
  "isWithinRestoreWindow",
  "loadPosts",
  "normalizePosts",
  "normalizeTags",
  "parseEditRevisionOptions",
  "requireAuth",
  "resolvePostStatus",
  "runAutoUploadReorganization",
  "writePosts",
];

const POST_VERSION_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "applyPostSnapshotForRollback",
  "canManagePosts",
  "listPostVersions",
  "loadPostVersions",
  "loadPosts",
  "normalizePosts",
  "postVersionReasonLabel",
  "requireAuth",
  "runAutoUploadReorganization",
  "writePosts",
];

const EDITORIAL_CALENDAR_DEPENDENCY_KEYS = [
  "app",
  "buildEditorialCalendarItems",
  "canManagePosts",
  "loadPosts",
  "normalizePosts",
  "requireAuth",
];

export const registerContentRoutes = (dependencies = {}) => {
  registerContentLinkTypeRoutes(
    pickContentDependencies(
      dependencies,
      "register-content-routes.link-types",
      LINK_TYPE_DEPENDENCY_KEYS,
    ),
  );
  registerContentPublicPostRoutes(
    pickContentDependencies(
      dependencies,
      "register-content-routes.public-posts",
      PUBLIC_POST_DEPENDENCY_KEYS,
    ),
  );
  registerContentCommentRoutes(
    pickContentDependencies(
      dependencies,
      "register-content-routes.comments",
      COMMENT_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostRoutes(
    pickContentDependencies(dependencies, "register-content-routes.posts", POST_DEPENDENCY_KEYS),
  );
  registerContentPostVersionRoutes(
    pickContentDependencies(
      dependencies,
      "register-content-routes.post-versions",
      POST_VERSION_DEPENDENCY_KEYS,
    ),
  );
  registerContentEditorialCalendarRoutes(
    pickContentDependencies(
      dependencies,
      "register-content-routes.editorial-calendar",
      EDITORIAL_CALENDAR_DEPENDENCY_KEYS,
    ),
  );
};

export default registerContentRoutes;
