import {
  PROJECT_OG_SCENE_VERSION,
  buildProjectOgCardModel,
  buildProjectOgImagePath,
  buildProjectOgImageResponse,
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";
import {
  buildOgDeliveryHeaders,
  getCachedOgRender,
} from "./og-delivery-shared.js";
import { PROJECT_STYLE_OG_TIMING_ORDER, renderProjectStyleOgBuffer } from "./og-project-render.js";
import { createRevisionToken } from "./revision-token.js";

const normalizeRevision = (value) => String(value || "").trim();

const buildProjectOgBaseModel = ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildProjectOgCardModel({
    project,
    settings,
    tagTranslations: translations?.tags,
    genreTranslations: translations?.genres,
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
    sceneVersion: normalizeRevision(
      sceneVersion || baseModel.sceneVersion || PROJECT_OG_SCENE_VERSION,
    ),
  });
};

export const buildVersionedProjectOgImagePath = ({ projectId, revision } = {}) => {
  const basePath = buildProjectOgImagePath(projectId);
  const normalizedRevision = normalizeRevision(revision);
  if (!normalizedRevision) {
    return basePath;
  }
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}v=${encodeURIComponent(normalizedRevision)}`;
};

export const buildProjectOgDeliveryHeaders = ({ cacheHit, timings } = {}) => {
  return buildOgDeliveryHeaders({
    cacheHit,
    timings,
    timingOrder: PROJECT_STYLE_OG_TIMING_ORDER,
  });
};

const renderProjectOgBuffer = async ({ baseModel, origin } = {}) => {
  return renderProjectStyleOgBuffer({
    baseModel,
    origin,
    loadArtworkDataUrl: loadProjectOgArtworkDataUrl,
    loadProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrl,
    buildImageResponse: (model) => buildProjectOgImageResponse(model),
  });
};

export const getProjectOgCachedRender = async ({
  project,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  return getCachedOgRender({
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
    renderModel: ({ model }) =>
      renderProjectOgBuffer({
        baseModel: model,
        origin,
      }),
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
