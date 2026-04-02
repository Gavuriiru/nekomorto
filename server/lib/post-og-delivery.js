import { buildPostOgCardModel, buildPostOgImageResponse } from "./post-og.js";
import { loadProjectOgArtworkDataUrl } from "./project-og.js";
import {
  createMeasuredOgAssetLoader,
  createProjectStyleBaseModelBuilder,
  getProjectStyleOgCachedRender,
} from "./og-delivery-shared.js";

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
  return getProjectStyleOgCachedRender({
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
    origin,
    buildImageResponse: (model) => buildPostOgImageResponse({ ...model }),
    loadAdditionalAssets: loadPostSubtitleAvatarAsset,
  });
};
