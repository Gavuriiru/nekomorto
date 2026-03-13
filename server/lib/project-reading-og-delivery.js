import { performance } from "node:perf_hooks";

import { buildOgRenderCacheKey } from "./og-render-cache.js";
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
  optimizeOgPublicImageBuffer,
  resolveOgPublicImageEncodingConfig,
} from "./og-image-output.js";

const PROJECT_READING_OG_TIMING_ORDER = [
  "cache_read",
  "artwork_load",
  "backdrop_process",
  "image_render",
  "image_optimize",
  "total",
];

const roundTimingMs = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));
const normalizeRevision = (value) => String(value || "").trim();

const measureTiming = async (timings, key, factory) => {
  const startedAt = performance.now();
  const result = await factory();
  timings[key] = roundTimingMs(performance.now() - startedAt);
  return result;
};

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
  const serverTiming = PROJECT_READING_OG_TIMING_ORDER.filter((key) =>
    Number.isFinite(Number(timings?.[key])),
  )
    .map((key) => `${key};dur=${roundTimingMs(timings[key])}`)
    .join(", ");

  return {
    serverTiming,
    cache: cacheHit ? "hit" : "miss",
  };
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

const renderProjectReadingOgBuffer = async ({
  baseModel,
  origin,
} = {}) => {
  const timings = {};
  const imageEncodingConfig = resolveOgPublicImageEncodingConfig();
  const [artworkDataUrl, backdropDataUrl] = await Promise.all([
    measureTiming(timings, "artwork_load", async () =>
      loadProjectOgArtworkDataUrl({
        artworkUrl: baseModel?.artworkUrl,
        origin,
      }),
    ),
    measureTiming(timings, "backdrop_process", async () =>
      loadProjectOgProcessedBackdropDataUrl({
        artworkUrl: baseModel?.backdropUrl,
        origin,
        layout: baseModel?.layout,
      }),
    ),
  ]);

  const imageResponse = buildProjectReadingOgImageResponse({
    ...baseModel,
    artworkDataUrl,
    backdropDataUrl,
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
    model: baseModel,
  };
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
  const totalStartedAt = performance.now();
  const timings = {};
  const model = buildProjectReadingOgBaseModel({
    project,
    chapterNumber,
    volume,
    settings,
    translations,
    origin,
    resolveVariantUrl,
  });
  if (!model) {
    return null;
  }

  const cacheKey = buildOgRenderCacheKey({
    kind: "project-reading",
    id: `${String(project?.id || "").trim()}:${String(model.chapterNumberResolved || "").trim()}:${String(model.volumeResolved ?? "").trim()}`,
    model,
  });
  const cached = await measureTiming(timings, "cache_read", async () =>
    ogRenderCache?.read?.(cacheKey) || null,
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
    const rendered = await renderProjectReadingOgBuffer({
      baseModel: model,
      origin,
    });
    ogRenderCache?.write?.(cacheKey, {
      buffer: rendered.buffer,
      contentType: rendered.contentType,
    });
    return rendered;
  };
  const rendered = ogRenderCache?.getOrCreateInFlight
    ? await ogRenderCache.getOrCreateInFlight(cacheKey, renderFactory)
    : await renderFactory();

  Object.assign(timings, rendered.timings || {});
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
