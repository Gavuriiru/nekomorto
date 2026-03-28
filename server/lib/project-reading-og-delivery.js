import {
  buildProjectReadingOgCardModel,
  buildProjectReadingOgImagePath,
  buildProjectReadingOgImageResponse,
} from "./project-reading-og.js";
import {
  buildProjectReadingOgRevision,
  PROJECT_READING_OG_SCENE_VERSION,
} from "../../shared/project-reading-og-seo.js";
import {
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";
import {
  buildOgDeliveryHeaders,
  getCachedOgRender,
} from "./og-delivery-shared.js";
import { PROJECT_STYLE_OG_TIMING_ORDER, renderProjectStyleOgBuffer } from "./og-project-render.js";

const normalizeRevision = (value) => String(value || "").trim();

const buildProjectReadingOgBaseModel = ({
  project,
  chapterNumber,
  volume,
  settings,
  translations,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildProjectReadingOgCardModel({
    project,
    chapterNumber,
    volume,
    settings,
    tagTranslations: translations?.tags,
    genreTranslations: translations?.genres,
    origin,
    resolveVariantUrl,
  });

export const buildVersionedProjectReadingOgImagePath = ({
  projectId,
  chapterNumber,
  volume,
  revision,
} = {}) =>
  buildProjectReadingOgImagePath({
    projectId,
    chapterNumber,
    volume,
    revision: normalizeRevision(revision),
  });

export const buildProjectReadingOgDeliveryHeaders = ({ cacheHit, timings } = {}) => {
  return buildOgDeliveryHeaders({
    cacheHit,
    timings,
    timingOrder: PROJECT_STYLE_OG_TIMING_ORDER,
  });
};

export const buildProjectReadingOgRevisionValue = ({
  project,
  chapterNumber,
  volume,
  settings,
  translations,
} = {}) =>
  buildProjectReadingOgRevision({
    project,
    chapterNumber,
    volume,
    settings,
    tagTranslations: translations?.tags,
    genreTranslations: translations?.genres,
    sceneVersion: PROJECT_READING_OG_SCENE_VERSION,
  });

const renderProjectReadingOgBuffer = async ({ baseModel, origin } = {}) => {
  return renderProjectStyleOgBuffer({
    baseModel,
    origin,
    loadArtworkDataUrl: loadProjectOgArtworkDataUrl,
    loadProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrl,
    buildImageResponse: (model) => buildProjectReadingOgImageResponse(model),
  });
};

export const getProjectReadingOgCachedRender = async ({
  project,
  chapterNumber,
  volume,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  return getCachedOgRender({
    kind: "project-reading",
    ogRenderCache,
    buildModel: () =>
      buildProjectReadingOgBaseModel({
        project,
        chapterNumber,
        volume,
        settings,
        translations,
        origin,
        resolveVariantUrl,
      }),
    resolveId: (model) =>
      `${String(project?.id || "").trim()}:${String(model?.chapterNumberResolved || "").trim()}:${String(model?.volumeResolved ?? "").trim()}`,
    renderModel: ({ model }) =>
      renderProjectReadingOgBuffer({
        baseModel: model,
        origin,
      }),
  });
};
