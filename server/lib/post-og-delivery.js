import { buildPostOgCardModel, buildPostOgImageResponse } from "./post-og.js";
import {
  loadProjectOgArtworkDataUrl,
  loadProjectOgProcessedBackdropDataUrl,
} from "./project-og.js";
import {
  getCachedOgRender,
} from "./og-delivery-shared.js";
import { renderProjectStyleOgBuffer } from "./og-project-render.js";

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
  return renderProjectStyleOgBuffer({
    baseModel,
    origin,
    loadArtworkDataUrl: loadProjectOgArtworkDataUrl,
    loadProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrl,
    loadAdditionalAssets: async ({ baseModel: model, timings, measureTiming, origin: renderOrigin }) => ({
      subtitleAvatarDataUrl: await measureTiming(timings, "avatar_load", async () =>
        loadProjectOgArtworkDataUrl({
          artworkUrl: model?.subtitleAvatarUrl,
          origin: renderOrigin,
        }),
      ),
    }),
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
