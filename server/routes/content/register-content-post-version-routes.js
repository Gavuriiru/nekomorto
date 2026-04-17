import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../../bootstrap/assert-required-dependencies.js";
import { registerContentPostManualVersionRoute } from "./post-versions/register-content-post-manual-version-route.js";
import { registerContentPostRollbackRoute } from "./post-versions/register-content-post-rollback-route.js";
import { registerContentPostVersionListRoute } from "./post-versions/register-content-post-version-list-route.js";

const pickContentPostVersionDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);

const LIST_DEPENDENCY_KEYS = [
  "app",
  "canManagePosts",
  "listPostVersions",
  "loadPosts",
  "normalizePosts",
  "postVersionReasonLabel",
  "requireAuth",
];

const MANUAL_VERSION_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "canManagePosts",
  "loadPosts",
  "normalizePosts",
  "postVersionReasonLabel",
  "requireAuth",
];

const ROLLBACK_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "applyPostSnapshotForRollback",
  "canManagePosts",
  "loadPostVersions",
  "loadPosts",
  "normalizePosts",
  "requireAuth",
  "runAutoUploadReorganization",
  "writePosts",
];

export const registerContentPostVersionRoutes = (dependencies = {}) => {
  registerContentPostVersionListRoute(
    pickContentPostVersionDependencies(
      dependencies,
      "register-content-post-version-routes.list",
      LIST_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostManualVersionRoute(
    pickContentPostVersionDependencies(
      dependencies,
      "register-content-post-version-routes.manual-version",
      MANUAL_VERSION_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostRollbackRoute(
    pickContentPostVersionDependencies(
      dependencies,
      "register-content-post-version-routes.rollback",
      ROLLBACK_DEPENDENCY_KEYS,
    ),
  );
};

export default registerContentPostVersionRoutes;
