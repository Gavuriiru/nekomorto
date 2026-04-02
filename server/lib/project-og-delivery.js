import {
  PROJECT_OG_SCENE_VERSION,
  buildProjectOgCardModel,
  buildProjectOgImagePath,
  buildProjectOgImageResponse,
} from "./project-og.js";
import {
  appendVersionQueryParam,
  buildProjectStyleRevisionFromModel,
  buildProjectStyleOgDeliveryHeaders,
  createProjectStyleBaseModelBuilder,
  getProjectStyleOgCachedRender,
  prewarmProjectStyleOgCache,
  normalizeOgRevision,
} from "./og-delivery-shared.js";
import { createRevisionToken } from "./revision-token.js";

const buildProjectOgBaseModel = createProjectStyleBaseModelBuilder(buildProjectOgCardModel);

export const buildProjectOgRevision = ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  sceneVersion = PROJECT_OG_SCENE_VERSION,
} = {}) => {
  return buildProjectStyleRevisionFromModel({
    buildBaseModel: buildProjectOgBaseModel,
    project,
    settings,
    translations,
    origin,
    resolveVariantUrl,
    buildRevision: (baseModel) =>
      createRevisionToken({
        model: baseModel,
        sceneVersion: normalizeOgRevision(
          sceneVersion || baseModel?.sceneVersion || PROJECT_OG_SCENE_VERSION,
        ),
      }),
  });
};

export const buildVersionedProjectOgImagePath = ({ projectId, revision } = {}) => {
  return appendVersionQueryParam(buildProjectOgImagePath(projectId), revision);
};

export const buildProjectOgDeliveryHeaders = buildProjectStyleOgDeliveryHeaders;

export const getProjectOgCachedRender = async ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  return getProjectStyleOgCachedRender({
    kind: "project",
    id: String(project?.id || "").trim(),
    ogRenderCache,
    buildModel: () =>
      buildProjectOgBaseModel({
        project,
        settings,
        translations,
        origin,
        resolveVariantUrl,
      }),
    origin,
    buildImageResponse: (model) => buildProjectOgImageResponse(model),
  });
};

export const prewarmProjectOgCache = async ({
  projects,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  return prewarmProjectStyleOgCache({
    items: projects,
    renderItem: (project) =>
      getProjectOgCachedRender({
        project,
        settings,
        translations,
        origin,
        resolveVariantUrl,
        ogRenderCache,
      }),
  });
};
