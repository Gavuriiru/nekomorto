import { renderOptimizedOgBuffer } from "./og-delivery-shared.js";

export const PROJECT_STYLE_OG_TIMING_ORDER = [
  "cache_read",
  "artwork_load",
  "backdrop_process",
  "image_render",
  "image_optimize",
  "total",
];

export const renderProjectStyleOgBuffer = async ({
  baseModel,
  origin,
  buildImageResponse,
  loadArtworkDataUrl,
  loadProcessedBackdropDataUrl,
  loadAdditionalAssets,
} = {}) =>
  renderOptimizedOgBuffer({
    baseModel,
    loadAssets: async ({ baseModel: model, timings, measureTiming }) => {
      const [artworkDataUrl, backdropDataUrl, additionalAssets] = await Promise.all([
        measureTiming(timings, "artwork_load", async () =>
          loadArtworkDataUrl?.({
            artworkUrl: model?.artworkUrl,
            origin,
          }),
        ),
        measureTiming(timings, "backdrop_process", async () =>
          loadProcessedBackdropDataUrl?.({
            artworkUrl: model?.backdropUrl,
            origin,
            layout: model?.layout,
          }),
        ),
        typeof loadAdditionalAssets === "function"
          ? loadAdditionalAssets({
              baseModel: model,
              timings,
              measureTiming,
              origin,
            })
          : Promise.resolve({}),
      ]);

      return {
        artworkDataUrl,
        backdropDataUrl,
        ...(additionalAssets && typeof additionalAssets === "object" ? additionalAssets : {}),
      };
    },
    buildImageResponse,
  });
