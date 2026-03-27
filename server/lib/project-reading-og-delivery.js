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
  renderOptimizedOgBuffer,
} from "./og-delivery-shared.js";

const PROJECT_READING_OG_TIMING_ORDER = [
  "cache_read",
  "artwork_load",
  "backdrop_process",
  "image_render",
  "image_optimize",
  "total",
];

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
    timingOrder: PROJECT_READING_OG_TIMING_ORDER,
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
  return renderOptimizedOgBuffer({
    baseModel,
    loadAssets: async ({ baseModel: model, timings, measureTiming }) => {
      const [artworkDataUrl, backdropDataUrl] = await Promise.all([
        measureTiming(timings, "artwork_load", async () =>
          loadProjectOgArtworkDataUrl({
            artworkUrl: model?.artworkUrl,
            origin,
          }),
        ),
        measureTiming(timings, "backdrop_process", async () =>
          loadProjectOgProcessedBackdropDataUrl({
            artworkUrl: model?.backdropUrl,
            origin,
            layout: model?.layout,
          }),
        ),
      ]);
      return {
        artworkDataUrl,
        backdropDataUrl,
      };
    },
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
