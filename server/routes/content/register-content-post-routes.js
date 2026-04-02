import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../../bootstrap/assert-required-dependencies.js";
import { registerContentPostCreateRoute } from "./posts/register-content-post-create-route.js";
import { registerContentPostDeleteRoute } from "./posts/register-content-post-delete-route.js";
import { registerContentPostRestoreRoute } from "./posts/register-content-post-restore-route.js";
import { registerContentPostUpdateRoute } from "./posts/register-content-post-update-route.js";

const pickContentPostDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);

const CREATE_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "canManagePosts",
  "createSlug",
  "createUniqueSlug",
  "dispatchEditorialWebhookEvent",
  "loadPosts",
  "normalizePosts",
  "normalizeTags",
  "requireAuth",
  "resolvePostStatus",
  "runAutoUploadReorganization",
  "writePosts",
];

const UPDATE_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "appendPostVersion",
  "canManagePosts",
  "createRevisionToken",
  "createSlug",
  "dispatchEditorialWebhookEvent",
  "ensureNoEditConflict",
  "loadPosts",
  "normalizePosts",
  "normalizeTags",
  "parseEditRevisionOptions",
  "requireAuth",
  "resolvePostStatus",
  "runAutoUploadReorganization",
  "writePosts",
];

const DELETE_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "canManagePosts",
  "isWithinRestoreWindow",
  "loadPosts",
  "normalizePosts",
  "requireAuth",
  "writePosts",
];

const RESTORE_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "canManagePosts",
  "isWithinRestoreWindow",
  "loadPosts",
  "normalizePosts",
  "requireAuth",
  "writePosts",
];

export const registerContentPostRoutes = (dependencies = {}) => {
  registerContentPostCreateRoute(
    pickContentPostDependencies(
      dependencies,
      "register-content-post-routes.create",
      CREATE_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostUpdateRoute(
    pickContentPostDependencies(
      dependencies,
      "register-content-post-routes.update",
      UPDATE_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostDeleteRoute(
    pickContentPostDependencies(
      dependencies,
      "register-content-post-routes.delete",
      DELETE_DEPENDENCY_KEYS,
    ),
  );
  registerContentPostRestoreRoute(
    pickContentPostDependencies(
      dependencies,
      "register-content-post-routes.restore",
      RESTORE_DEPENDENCY_KEYS,
    ),
  );
};

export default registerContentPostRoutes;
