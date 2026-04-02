import { buildPostOgCardModel, buildPostOgImageResponse } from "./post-og.js";
import { loadProjectOgArtworkDataUrl } from "./project-og.js";
import {
  createProjectStyleBaseModelBuilder,
  getProjectStyleOgCachedRender,
} from "./og-delivery-shared.js";

const buildPostOgBaseModel = createProjectStyleBaseModelBuilder(buildPostOgCardModel);

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
    loadAdditionalAssets: async ({ baseModel: model, timings, measureTiming, origin: renderOrigin }) => ({
      subtitleAvatarDataUrl: await measureTiming(timings, "avatar_load", async () =>
        loadProjectOgArtworkDataUrl({
          artworkUrl: model?.subtitleAvatarUrl,
          origin: renderOrigin,
        }),
      ),
    }),
  });
};
