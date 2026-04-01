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
  buildProjectStyleBaseModel,
  buildProjectStyleOgDeliveryHeaders,
  getProjectStyleOgCachedRender,
  resolveProjectStyleTranslationArgs,
  normalizeOgRevision,
} from "./og-delivery-shared.js";

const buildProjectReadingOgBaseModel = ({
  project,
  chapterNumber,
  volume,
  settings,
  translations,
  origin,
  resolveVariantUrl,
} = {}) =>
  buildProjectStyleBaseModel({
    buildCardModel: buildProjectReadingOgCardModel,
    project,
    chapterNumber,
    volume,
    settings,
    translations,
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
    revision: normalizeOgRevision(revision),
  });

export const buildProjectReadingOgDeliveryHeaders = buildProjectStyleOgDeliveryHeaders;

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
    ...resolveProjectStyleTranslationArgs(translations),
    sceneVersion: PROJECT_READING_OG_SCENE_VERSION,
  });

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
  return getProjectStyleOgCachedRender({
    kind: "project-reading",
    ogRenderCache,
    buildModel: () =>
      buildProjectReadingOgBaseModel({
        project,
        chapterNumber,
        volume,
        settings,
        translations,
        origin,
        resolveVariantUrl,
      }),
    origin,
    resolveId: (model) =>
      `${String(project?.id || "").trim()}:${String(model?.chapterNumberResolved || "").trim()}:${String(model?.volumeResolved ?? "").trim()}`,
    buildImageResponse: (model) => buildProjectReadingOgImageResponse(model),
  });
};
