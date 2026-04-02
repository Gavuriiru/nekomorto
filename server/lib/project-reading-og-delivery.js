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
  createProjectStyleOgCachedRenderResolver,
  createProjectStyleBaseModelBuilder,
  buildProjectStyleOgDeliveryHeaders,
  resolveProjectStyleTranslationArgs,
  normalizeOgRevision,
} from "./og-delivery-shared.js";

const buildProjectReadingOgBaseModel = createProjectStyleBaseModelBuilder(
  buildProjectReadingOgCardModel,
);
const resolveProjectReadingOgCachedRender = createProjectStyleOgCachedRenderResolver({
  buildBaseModel: (options) => buildProjectReadingOgBaseModel(options),
  buildImageResponse: (model) => buildProjectReadingOgImageResponse(model),
  kind: "project-reading",
  resolveId: ({ model, options }) =>
    `${String(options?.project?.id || "").trim()}:${String(model?.chapterNumberResolved || "").trim()}:${String(model?.volumeResolved ?? "").trim()}`,
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
  return resolveProjectReadingOgCachedRender({
    chapterNumber,
    ogRenderCache,
    origin,
    project,
    resolveVariantUrl,
    settings,
    translations,
    volume,
  });
};
