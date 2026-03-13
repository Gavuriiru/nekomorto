import { buildOgRenderCacheKey } from "./og-render-cache.js";
import {
  buildPostOgCardModel,
  buildPostOgImageResponse,
} from "./post-og.js";
import {
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";

const buildPostOgBaseModel = ({
  post,
  relatedProject,
  resolvedCover,
  firstPostImage,
  resolvedAuthor,
  defaultBackdropUrl,
  settings,
  translations,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildPostOgCardModel({
    post,
    relatedProject,
    resolvedCover,
    firstPostImage,
    resolvedAuthor,
    defaultBackdropUrl,
    settings,
    tagTranslations: translations?.tags,
    genreTranslations: translations?.genres,
    origin,
    resolveVariantUrl,
  });

const renderPostOgBuffer = async ({
  baseModel,
  origin,
} = {}) => {
  const [artworkDataUrl, backdropDataUrl, subtitleAvatarDataUrl] = await Promise.all([
    loadProjectOgArtworkDataUrl({
      artworkUrl: baseModel?.artworkUrl,
      origin,
    }),
    loadProjectOgProcessedBackdropDataUrl({
      artworkUrl: baseModel?.backdropUrl,
      origin,
      layout: baseModel?.layout,
    }),
    loadProjectOgArtworkDataUrl({
      artworkUrl: baseModel?.subtitleAvatarUrl,
      origin,
    }),
  ]);
  const imageResponse = buildPostOgImageResponse({
    ...baseModel,
    artworkDataUrl,
    backdropDataUrl,
    subtitleAvatarDataUrl,
  });

  return {
    buffer: Buffer.from(await imageResponse.arrayBuffer()),
    contentType: imageResponse.headers.get("content-type") || "image/png",
    model: baseModel,
  };
};

export const getPostOgCachedRender = async ({
  post,
  relatedProject,
  resolvedCover,
  firstPostImage,
  resolvedAuthor,
  defaultBackdropUrl,
  settings,
  translations,
  origin,
  resolveVariantUrl,
  ogRenderCache,
} = {}) => {
  const model = buildPostOgBaseModel({
    post,
    relatedProject,
    resolvedCover,
    firstPostImage,
    resolvedAuthor,
    defaultBackdropUrl,
    settings,
    translations,
    origin,
    resolveVariantUrl,
  });
  const cacheKey = buildOgRenderCacheKey({
    kind: "post",
    id: String(post?.slug || "").trim(),
    model,
  });
  const cached = ogRenderCache?.read?.(cacheKey) || null;

  if (cached) {
    return {
      buffer: Buffer.from(cached.buffer),
      contentType: cached.contentType || "image/png",
      cacheHit: true,
      cacheKey,
      model,
    };
  }

  const renderFactory = async () => {
    const rendered = await renderPostOgBuffer({
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

  return {
    buffer: Buffer.from(rendered.buffer),
    contentType: rendered.contentType || "image/png",
    cacheHit: false,
    cacheKey,
    model,
  };
};
