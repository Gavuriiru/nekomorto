import {
  assertRequiredDependencies,
  pickDependencyKeys,
} from "../../bootstrap/assert-required-dependencies.js";
import { registerProjectWriteAniListRoutes } from "./write/register-project-write-anilist-routes.js";
import { registerProjectWriteChapterRoutes } from "./write/register-project-write-chapter-routes.js";
import { registerProjectWriteCreateRoutes } from "./write/register-project-write-create-routes.js";
import { registerProjectWriteManagementRoutes } from "./write/register-project-write-management-routes.js";
import { registerProjectWriteProjectRoutes } from "./write/register-project-write-project-routes.js";

const pickProjectWriteDependencies = (dependencies, scopeName, keys) =>
  assertRequiredDependencies(scopeName, pickDependencyKeys(dependencies, keys), keys);

const CREATE_DEPENDENCY_KEYS = [
  "PUBLIC_UPLOADS_DIR",
  "app",
  "appendAuditLog",
  "applyEpisodePublicationMetadata",
  "canManageProjects",
  "collectEpisodeUpdatesByVisibility",
  "dispatchEditorialWebhookEvent",
  "enqueueProjectOgPrewarm",
  "findDuplicateEpisodeKey",
  "findDuplicateVolumeCover",
  "findProjectChapterByEpisodeNumber",
  "importRemoteImageFile",
  "loadProjects",
  "loadUpdates",
  "localizeProjectImageFields",
  "normalizeProjects",
  "requireAuth",
  "resolveProjectWebhookEventKey",
  "runAutoUploadReorganization",
  "upsertUploadEntries",
  "writeProjects",
  "writeUpdates",
];

const CHAPTER_DEPENDENCY_KEYS = [
  "PUBLIC_UPLOADS_DIR",
  "app",
  "appendAuditLog",
  "applyEpisodePublicationMetadata",
  "applyProjectChapterUpdate",
  "canManageProjects",
  "collectEpisodeUpdatesByVisibility",
  "createRevisionToken",
  "dispatchEditorialWebhookEvent",
  "enqueueProjectOgPrewarm",
  "ensureNoEditConflict",
  "findDuplicateEpisodeKey",
  "findDuplicateVolumeCover",
  "findProjectChapterByEpisodeNumber",
  "findPublishedImageEpisodeWithoutPages",
  "importRemoteImageFile",
  "loadProjects",
  "loadUpdates",
  "localizeProjectImageFields",
  "normalizeProjects",
  "parseEditRevisionOptions",
  "requireAuth",
  "resolveEpisodeLookup",
  "resolveProjectWebhookEventKey",
  "runAutoUploadReorganization",
  "upsertUploadEntries",
  "writeProjects",
  "writeUpdates",
];

const PROJECT_DEPENDENCY_KEYS = [
  "PUBLIC_UPLOADS_DIR",
  "app",
  "appendAuditLog",
  "applyEpisodePublicationMetadata",
  "canManageProjects",
  "collectEpisodeUpdatesByVisibility",
  "createRevisionToken",
  "dispatchEditorialWebhookEvent",
  "enqueueProjectOgPrewarm",
  "ensureNoEditConflict",
  "findDuplicateEpisodeKey",
  "findDuplicateVolumeCover",
  "findProjectChapterByEpisodeNumber",
  "findPublishedImageEpisodeWithoutPages",
  "importRemoteImageFile",
  "loadProjects",
  "loadUpdates",
  "localizeProjectImageFields",
  "normalizeProjects",
  "parseEditRevisionOptions",
  "requireAuth",
  "resolveProjectWebhookEventKey",
  "runAutoUploadReorganization",
  "upsertUploadEntries",
  "writeProjects",
  "writeUpdates",
];

const MANAGEMENT_DEPENDENCY_KEYS = [
  "app",
  "appendAuditLog",
  "canManageProjects",
  "collectEpisodeUpdatesByVisibility",
  "enqueueProjectOgPrewarm",
  "isWithinRestoreWindow",
  "loadProjects",
  "loadUpdates",
  "normalizeProjects",
  "requireAuth",
  "writeProjects",
  "writeUpdates",
];

const ANILIST_DEPENDENCY_KEYS = [
  "app",
  "canManageIntegrations",
  "deriveAniListMediaOrganization",
  "fetchAniListMediaById",
  "requireAuth",
];

export const registerProjectWriteRoutes = (dependencies = {}) => {
  registerProjectWriteCreateRoutes(
    pickProjectWriteDependencies(
      dependencies,
      "register-project-write-routes.create",
      CREATE_DEPENDENCY_KEYS,
    ),
  );
  registerProjectWriteChapterRoutes(
    pickProjectWriteDependencies(
      dependencies,
      "register-project-write-routes.chapter",
      CHAPTER_DEPENDENCY_KEYS,
    ),
  );
  registerProjectWriteProjectRoutes(
    pickProjectWriteDependencies(
      dependencies,
      "register-project-write-routes.project",
      PROJECT_DEPENDENCY_KEYS,
    ),
  );
  registerProjectWriteManagementRoutes(
    pickProjectWriteDependencies(
      dependencies,
      "register-project-write-routes.management",
      MANAGEMENT_DEPENDENCY_KEYS,
    ),
  );
  registerProjectWriteAniListRoutes(
    pickProjectWriteDependencies(
      dependencies,
      "register-project-write-routes.anilist",
      ANILIST_DEPENDENCY_KEYS,
    ),
  );
};

export default registerProjectWriteRoutes;
