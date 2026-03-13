import { performance } from "node:perf_hooks";

import { buildOgRenderCacheKey } from "./og-render-cache.js";
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

const INSTITUTIONAL_OG_TIMING_ORDER = [
  "cache_read",
  "background_load",
  "image_render",
  "png_optimize",
  "total",
];

const roundTimingMs = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));

const measureTiming = async (timings, key, factory) => {
  const startedAt = performance.now();
  const result = await factory();
  timings[key] = roundTimingMs(performance.now() - startedAt);
  return result;
};

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

const renderInstitutionalOgBuffer = async ({
  baseModel,
  origin,
} = {}) => {
  const timings = {};
  const backgroundDataUrl = await measureTiming(timings, "background_load", async () =>
    loadInstitutionalOgBackgroundDataUrl({
      backgroundUrl: baseModel?.backgroundUrl,
      origin,
    }),
  );
  const imageResponse = buildInstitutionalOgImageResponse({
    ...baseModel,
    backgroundDataUrl,
  });
  const rawBuffer = await measureTiming(timings, "image_render", async () =>
    Buffer.from(await imageResponse.arrayBuffer()),
  );
  timings.png_optimize = 0;

  return {
    buffer: rawBuffer,
    contentType: imageResponse.headers.get("content-type") || "image/png",
    timings,
    model: baseModel,
  };
};

export const buildInstitutionalOgDeliveryHeaders = ({ cacheHit, timings } = {}) => {
  const serverTiming = INSTITUTIONAL_OG_TIMING_ORDER.filter((key) =>
    Number.isFinite(Number(timings?.[key])),
  )
    .map((key) => `${key};dur=${roundTimingMs(timings[key])}`)
    .join(", ");

  return {
    serverTiming,
    cache: cacheHit ? "hit" : "miss",
  };
};

export const buildInstitutionalOgRevisionValue = ({
  pageKey,
  pages,
  settings,
} = {}) =>
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
  const totalStartedAt = performance.now();
  const timings = {};
  const model = buildInstitutionalOgBaseModel({
    pageKey,
    pages,
    settings,
    origin,
    resolveVariantUrl,
  });
  if (!model) {
    return null;
  }

  const cacheKey = buildOgRenderCacheKey({
    kind: "institutional",
    id: String(pageKey || "").trim(),
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
    const rendered = await renderInstitutionalOgBuffer({
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
