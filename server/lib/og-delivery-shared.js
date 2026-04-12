import { performance } from "node:perf_hooks";

import { buildOgRenderCacheKey } from "./og-render-cache.js";
import {
  optimizeOgPublicImageBuffer,
  resolveOgPublicImageEncodingConfig,
} from "./og-image-output.js";
import { PROJECT_STYLE_OG_TIMING_ORDER, renderProjectStyleOgBuffer } from "./og-project-render.js";
import {
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";

export const roundTimingMs = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));

export const measureTiming = async (timings, key, factory) => {
  const startedAt = performance.now();
  const result = await factory();
  timings[key] = roundTimingMs(performance.now() - startedAt);
  return result;
};

export const buildMeasuredOgAsset = async ({
  assetKey,
  factory,
  measureTiming: measure = measureTiming,
  timingKey,
  timings,
} = {}) => ({
  [assetKey]: await measure(timings, timingKey, factory),
});

export const createMeasuredOgAssetLoader =
  ({ assetKey, loadAsset, timingKey } = {}) =>
  async (context = {}) =>
    buildMeasuredOgAsset({
      assetKey,
      factory: () => loadAsset?.(context),
      measureTiming: context.measureTiming,
      timingKey,
      timings: context.timings,
    });

export const buildOgDeliveryHeaders = ({ cacheHit, timings, timingOrder = [] } = {}) => {
  const serverTiming = timingOrder
    .filter((key) => Number.isFinite(Number(timings?.[key])))
    .map((key) => `${key};dur=${roundTimingMs(timings[key])}`)
    .join(", ");

  return {
    serverTiming,
    cache: cacheHit ? "hit" : "miss",
  };
};

export const createOgDeliveryHeadersBuilder =
  (timingOrder = []) =>
  ({ cacheHit, timings } = {}) =>
    buildOgDeliveryHeaders({
      cacheHit,
      timings,
      timingOrder,
    });
const buildProjectStyleHeaders = createOgDeliveryHeadersBuilder(PROJECT_STYLE_OG_TIMING_ORDER);

export const normalizeOgRevision = (value) => String(value || "").trim();

export const appendVersionQueryParam = (basePath, revision) => {
  const normalizedRevision = normalizeOgRevision(revision);
  if (!normalizedRevision) {
    return basePath;
  }

  const separator = String(basePath || "").includes("?") ? "&" : "?";
  return `${basePath}${separator}v=${encodeURIComponent(normalizedRevision)}`;
};

export const buildProjectStyleOgDeliveryHeaders = ({ cacheHit, timings } = {}) =>
  buildProjectStyleHeaders({
    cacheHit,
    timings,
  });

export const renderProjectStyleOgAssetBuffer = async ({
  baseModel,
  origin,
  buildImageResponse,
  loadAdditionalAssets,
} = {}) =>
  renderProjectStyleOgBuffer({
    baseModel,
    origin,
    loadArtworkDataUrl: loadProjectOgArtworkDataUrl,
    loadProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrl,
    loadAdditionalAssets,
    buildImageResponse,
  });

export const resolveProjectStyleTranslationArgs = (translations = {}) => ({
  tagTranslations: translations?.tags,
  genreTranslations: translations?.genres,
});

export const buildProjectStyleBaseModel = ({ buildCardModel, translations, ...rest } = {}) =>
  buildCardModel?.({
    ...rest,
    ...resolveProjectStyleTranslationArgs(translations),
  }) || null;

export const createProjectStyleBaseModelBuilder =
  (buildCardModel) =>
  (options = {}) =>
    buildProjectStyleBaseModel({
      buildCardModel,
      ...options,
    });

export const buildProjectStyleRevisionFromModel = ({
  buildBaseModel,
  buildRevision,
  ...options
} = {}) => {
  const baseModel = buildBaseModel?.(options);
  return buildRevision?.(baseModel, options) || null;
};

export const renderOptimizedOgBuffer = async ({
  baseModel,
  loadAssets,
  buildImageResponse,
} = {}) => {
  const timings = {};
  const imageEncodingConfig = resolveOgPublicImageEncodingConfig();
  const assets =
    typeof loadAssets === "function"
      ? await loadAssets({
          baseModel,
          timings,
          measureTiming,
        })
      : {};
  const imageResponse = await buildImageResponse({
    ...baseModel,
    ...(assets && typeof assets === "object" ? assets : {}),
  });
  const sourceContentType = imageResponse.headers.get("content-type") || "image/png";
  const rawBuffer = await measureTiming(timings, "image_render", async () =>
    Buffer.from(await imageResponse.arrayBuffer()),
  );
  const optimizedAsset = await measureTiming(timings, "image_optimize", async () =>
    optimizeOgPublicImageBuffer({
      buffer: rawBuffer,
      sourceContentType,
      targetFormat: "jpeg",
      profile: "visually-lossless",
      maxBytes: imageEncodingConfig.maxBytes,
      qualityLadder: imageEncodingConfig.qualityLadder,
    }),
  );

  return {
    buffer: optimizedAsset.buffer,
    contentType: optimizedAsset.contentType || sourceContentType,
    timings,
  };
};

export const getProjectStyleOgCachedRender = async ({
  kind,
  id,
  resolveId,
  buildModel,
  origin,
  ogRenderCache,
  buildImageResponse,
  loadAdditionalAssets,
} = {}) =>
  getCachedOgRender({
    kind,
    id,
    resolveId,
    ogRenderCache,
    buildModel,
    renderModel: ({ model }) =>
      renderProjectStyleOgAssetBuffer({
        baseModel: model,
        origin,
        buildImageResponse,
        loadAdditionalAssets,
      }),
  });

export const prewarmProjectStyleOgCache = async ({ items, renderItem } = {}) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  let warmed = 0;
  let cacheHits = 0;

  for (const item of safeItems) {
    const rendered = await renderItem?.(item);
    if (!rendered) {
      continue;
    }
    if (rendered.cacheHit) {
      cacheHits += 1;
    } else {
      warmed += 1;
    }
  }

  return {
    total: safeItems.length,
    warmed,
    cacheHits,
  };
};

export const getCachedOgRender = async ({
  kind,
  id,
  resolveId,
  buildModel,
  renderModel,
  ogRenderCache,
} = {}) => {
  const totalStartedAt = performance.now();
  const timings = {};
  const model = await buildModel?.();
  if (!model) {
    return null;
  }

  const cacheId = typeof resolveId === "function" ? resolveId(model) : id;
  const cacheKey = buildOgRenderCacheKey({
    kind,
    id: String(cacheId || "").trim(),
    model,
  });
  const cached = await measureTiming(
    timings,
    "cache_read",
    async () => ogRenderCache?.read?.(cacheKey) || null,
  );

  if (cached) {
    timings.total = roundTimingMs(performance.now() - totalStartedAt);
    return {
      buffer: Buffer.from(cached.buffer),
      contentType: cached.contentType || "image/png",
      cacheHit: true,
      cacheKey,
      model,
      timings,
    };
  }

  const renderFactory = async () => {
    const rendered = await renderModel?.({ model });
    ogRenderCache?.write?.(cacheKey, {
      buffer: rendered.buffer,
      contentType: rendered.contentType,
    });
    return rendered;
  };
  const rendered = ogRenderCache?.getOrCreateInFlight
    ? await ogRenderCache.getOrCreateInFlight(cacheKey, renderFactory)
    : await renderFactory();

  Object.assign(timings, rendered?.timings || {});
  timings.total = roundTimingMs(performance.now() - totalStartedAt);
  return {
    buffer: Buffer.from(rendered.buffer),
    contentType: rendered.contentType || "image/png",
    cacheHit: false,
    cacheKey,
    model,
    timings,
  };
};

export const createProjectStyleOgCachedRenderResolver =
  ({ buildBaseModel, buildImageResponse, kind, loadAdditionalAssets, resolveId } = {}) =>
  async (options = {}) =>
    getProjectStyleOgCachedRender({
      kind,
      ogRenderCache: options.ogRenderCache,
      buildModel: () => buildBaseModel?.(options),
      origin: options.origin,
      loadAdditionalAssets,
      buildImageResponse,
      resolveId: resolveId
        ? (model) =>
            resolveId({
              model,
              options,
            })
        : undefined,
      id: options.id,
    });
