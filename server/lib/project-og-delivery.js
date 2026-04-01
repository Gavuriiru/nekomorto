import {
  PROJECT_OG_SCENE_VERSION,
  buildProjectOgCardModel,
  buildProjectOgImagePath,
  buildProjectOgImageResponse,
} from "./project-og.js";
import {
  appendVersionQueryParam,
  buildProjectStyleBaseModel,
  buildProjectStyleOgDeliveryHeaders,
  getProjectStyleOgCachedRender,
  normalizeOgRevision,
} from "./og-delivery-shared.js";
import { createRevisionToken } from "./revision-token.js";

const buildProjectOgBaseModel = ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildProjectStyleBaseModel({
    buildCardModel: buildProjectOgCardModel,
    project,
    settings,
    translations,
    origin,
    resolveVariantUrl,
  });

export const buildProjectOgRevision = ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  sceneVersion = PROJECT_OG_SCENE_VERSION,
} = {}) => {
  const baseModel = buildProjectOgBaseModel({
    project,
    settings,
    translations,
    origin,
    resolveVariantUrl,
  });
  return createRevisionToken({
    model: baseModel,
    sceneVersion: normalizeOgRevision(
      sceneVersion || baseModel.sceneVersion || PROJECT_OG_SCENE_VERSION,
    ),
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
  const safeProjects = Array.isArray(projects) ? projects.filter(Boolean) : [];
  let warmed = 0;
  let cacheHits = 0;

  for (const project of safeProjects) {
    const rendered = await getProjectOgCachedRender({
      project,
      settings,
      translations,
      origin,
      resolveVariantUrl,
      ogRenderCache,
    });
    if (rendered.cacheHit) {
      cacheHits += 1;
    } else {
      warmed += 1;
    }
  }

  return {
    total: safeProjects.length,
    warmed,
    cacheHits,
  };
};
