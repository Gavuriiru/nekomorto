import {
  createMeasuredOgAssetLoader,
  createProjectStyleBaseModelBuilder,
  createProjectStyleOgCachedRenderResolver,
} from "./og-delivery-shared.js";
import { buildPostOgCardModel, buildPostOgImageResponse } from "./post-og.js";
import { loadProjectOgArtworkDataUrl } from "./project-og.js";

const buildPostOgBaseModel = createProjectStyleBaseModelBuilder(buildPostOgCardModel);
const loadPostSubtitleAvatarAsset = createMeasuredOgAssetLoader({
  assetKey: "subtitleAvatarDataUrl",
  timingKey: "avatar_load",
  loadAsset: ({ baseModel: model, origin }) =>
    loadProjectOgArtworkDataUrl({
      artworkUrl: model?.subtitleAvatarUrl,
      origin,
    }),
});
const resolvePostOgCachedRender = createProjectStyleOgCachedRenderResolver({
  buildBaseModel: (options) => buildPostOgBaseModel(options),
  buildImageResponse: (model) => buildPostOgImageResponse({ ...model }),
  kind: "post",
  loadAdditionalAssets: loadPostSubtitleAvatarAsset,
});

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
  return resolvePostOgCachedRender({
    defaultBackdropUrl,
    firstPostImage,
    id: String(post?.slug || "").trim(),
    ogRenderCache,
    origin,
    post,
    relatedProject,
    resolveVariantUrl,
    resolvedAuthor,
    resolvedCover,
    settings,
    translations,
  });
};
