import { buildPostOgCardModel, buildPostOgImageResponse } from "./post-og.js";
import {
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";
import {
  getCachedOgRender,
  renderOptimizedOgBuffer,
} from "./og-delivery-shared.js";

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

const renderPostOgBuffer = async ({ baseModel, origin } = {}) => {
  return renderOptimizedOgBuffer({
    baseModel,
    loadAssets: async ({ baseModel: model, timings, measureTiming }) => {
      const [artworkDataUrl, backdropDataUrl, subtitleAvatarDataUrl] = await Promise.all([
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
        measureTiming(timings, "avatar_load", async () =>
          loadProjectOgArtworkDataUrl({
            artworkUrl: model?.subtitleAvatarUrl,
            origin,
          }),
        ),
      ]);
      return {
        artworkDataUrl,
        backdropDataUrl,
        subtitleAvatarDataUrl,
      };
    },
    buildImageResponse: (model) =>
      buildPostOgImageResponse({
        ...model,
      }),
  });
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
  return getCachedOgRender({
    kind: "post",
    id: String(post?.slug || "").trim(),
    ogRenderCache,
    buildModel: () =>
      buildPostOgBaseModel({
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
      }),
    renderModel: ({ model }) =>
      renderPostOgBuffer({
        baseModel: model,
        origin,
      }),
  });
};
