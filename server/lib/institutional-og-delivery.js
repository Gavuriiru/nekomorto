import {
  buildInstitutionalOgCardModel,
  buildInstitutionalOgImageResponse,
  loadInstitutionalOgBackgroundDataUrl,
} from "./institutional-og.js";
import {
  INSTITUTIONAL_OG_SCENE_VERSION,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";
import {
  buildOgDeliveryHeaders,
  getCachedOgRender,
  renderOptimizedOgBuffer,
} from "./og-delivery-shared.js";

const INSTITUTIONAL_OG_TIMING_ORDER = [
  "cache_read",
  "background_load",
  "image_render",
  "image_optimize",
  "total",
];

const buildInstitutionalOgBaseModel = ({
  pageKey,
  pages,
  settings,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildInstitutionalOgCardModel({
    pageKey,
    pages,
    settings,
    origin,
    resolveVariantUrl,
  });

const renderInstitutionalOgBuffer = async ({ baseModel, origin } = {}) => {
  return renderOptimizedOgBuffer({
    baseModel,
    loadAssets: ({ baseModel: model, timings, measureTiming }) =>
      measureTiming(timings, "background_load", async () => ({
        backgroundDataUrl: await loadInstitutionalOgBackgroundDataUrl({
          backgroundUrl: model?.backgroundUrl,
          origin,
        }),
      })),
    buildImageResponse: (model) => buildInstitutionalOgImageResponse(model),
  });
};

export const buildInstitutionalOgDeliveryHeaders = ({ cacheHit, timings } = {}) => {
  return buildOgDeliveryHeaders({
    cacheHit,
    timings,
    timingOrder: INSTITUTIONAL_OG_TIMING_ORDER,
  });
};

export const buildInstitutionalOgRevisionValue = ({ pageKey, pages, settings } = {}) =>
  buildInstitutionalOgRevision({
    pageKey,
    pages,
    settings,
    sceneVersion: INSTITUTIONAL_OG_SCENE_VERSION,
  });

export { buildVersionedInstitutionalOgImagePath };

export const getInstitutionalOgCachedRender = async ({
  pageKey,
  pages,
  settings,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  return getCachedOgRender({
    kind: "institutional",
    id: String(pageKey || "").trim(),
    ogRenderCache,
    buildModel: () =>
      buildInstitutionalOgBaseModel({
        pageKey,
        pages,
        settings,
        origin,
        resolveVariantUrl,
      }),
    renderModel: ({ model }) =>
      renderInstitutionalOgBuffer({
        baseModel: model,
        origin,
      }),
  });
};
