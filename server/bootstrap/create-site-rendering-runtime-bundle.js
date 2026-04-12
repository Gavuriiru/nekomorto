import { createHtmlSender, createMetaHtmlRenderer } from "../lib/meta-html.js";
import { createSiteMetaBuilders } from "../lib/site-meta-builders.js";
import { createBuildEditorialWebhookImageContext } from "../lib/webhook-support.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const SITE_RENDERING_RUNTIME_DEPENDENCY_KEYS = [
  "PRIMARY_APP_ORIGIN",
  "applyHtmlCachingHeaders",
  "buildInstitutionalOgImageAlt",
  "buildInstitutionalOgRevisionValue",
  "buildPostOgImageAlt",
  "buildPostOgRevision",
  "buildProjectOgRevision",
  "buildProjectReadingOgCardModel",
  "buildProjectReadingOgRevisionValue",
  "buildVersionedInstitutionalOgImagePath",
  "buildVersionedPostOgImagePath",
  "buildVersionedProjectOgImagePath",
  "buildVersionedProjectReadingOgImagePath",
  "extractFirstImageFromPostContent",
  "getIndexHtml",
  "injectNonceIntoHtmlScripts",
  "loadPages",
  "loadSiteSettings",
  "loadTagTranslations",
  "resolveInstitutionalOgPagePath",
  "resolveInstitutionalOgPageTitle",
  "resolveInstitutionalOgSupportText",
  "resolveMetaImageVariantUrl",
  "resolvePostCover",
  "serializeSchemaOrgEntry",
  "toAbsoluteUrl",
  "truncateMetaDescription",
  "viteDevServer",
];

export const createSiteRenderingRuntimeBundle = (dependencies = {}) => {
  assertRequiredDependencies(
    "createSiteRenderingRuntimeBundle",
    dependencies,
    SITE_RENDERING_RUNTIME_DEPENDENCY_KEYS,
  );

  const metaHtmlRenderer = createMetaHtmlRenderer({
    getIndexHtml: dependencies.getIndexHtml,
    primaryAppOrigin: dependencies.PRIMARY_APP_ORIGIN,
    resolveMetaImageVariantUrl: dependencies.resolveMetaImageVariantUrl,
    serializeSchemaOrgEntry: dependencies.serializeSchemaOrgEntry,
    toAbsoluteUrl: dependencies.toAbsoluteUrl,
    truncateMetaDescription: dependencies.truncateMetaDescription,
  });

  const sendHtml = createHtmlSender({
    applyHtmlCachingHeaders: dependencies.applyHtmlCachingHeaders,
    injectNonceIntoHtmlScripts: dependencies.injectNonceIntoHtmlScripts,
    viteDevServer: dependencies.viteDevServer,
  });

  const siteMetaBuilders = createSiteMetaBuilders({
    buildInstitutionalOgImageAlt: dependencies.buildInstitutionalOgImageAlt,
    buildInstitutionalOgRevisionValue: dependencies.buildInstitutionalOgRevisionValue,
    buildPostOgImageAlt: dependencies.buildPostOgImageAlt,
    buildPostOgRevision: dependencies.buildPostOgRevision,
    buildProjectOgRevision: dependencies.buildProjectOgRevision,
    buildProjectReadingOgCardModel: dependencies.buildProjectReadingOgCardModel,
    buildProjectReadingOgRevisionValue: dependencies.buildProjectReadingOgRevisionValue,
    buildVersionedInstitutionalOgImagePath: dependencies.buildVersionedInstitutionalOgImagePath,
    buildVersionedPostOgImagePath: dependencies.buildVersionedPostOgImagePath,
    buildVersionedProjectOgImagePath: dependencies.buildVersionedProjectOgImagePath,
    buildVersionedProjectReadingOgImagePath: dependencies.buildVersionedProjectReadingOgImagePath,
    extractFirstImageFromPostContent: dependencies.extractFirstImageFromPostContent,
    loadPages: dependencies.loadPages,
    loadSiteSettings: dependencies.loadSiteSettings,
    loadTagTranslations: dependencies.loadTagTranslations,
    primaryAppOrigin: dependencies.PRIMARY_APP_ORIGIN,
    resolveInstitutionalOgPagePath: dependencies.resolveInstitutionalOgPagePath,
    resolveInstitutionalOgPageTitle: dependencies.resolveInstitutionalOgPageTitle,
    resolveInstitutionalOgSupportText: dependencies.resolveInstitutionalOgSupportText,
    resolveMetaImageVariantUrl: dependencies.resolveMetaImageVariantUrl,
    resolvePostCover: dependencies.resolvePostCover,
    truncateMetaDescription: dependencies.truncateMetaDescription,
  });

  const buildEditorialWebhookImageContext = createBuildEditorialWebhookImageContext({
    buildPostOgRevision: dependencies.buildPostOgRevision,
    buildProjectOgRevision: dependencies.buildProjectOgRevision,
    buildProjectReadingOgCardModel: dependencies.buildProjectReadingOgCardModel,
    buildProjectReadingOgRevisionValue: dependencies.buildProjectReadingOgRevisionValue,
    buildVersionedPostOgImagePath: dependencies.buildVersionedPostOgImagePath,
    buildVersionedProjectOgImagePath: dependencies.buildVersionedProjectOgImagePath,
    buildVersionedProjectReadingOgImagePath: dependencies.buildVersionedProjectReadingOgImagePath,
    extractFirstImageFromPostContent: dependencies.extractFirstImageFromPostContent,
    primaryAppOrigin: dependencies.PRIMARY_APP_ORIGIN,
    resolveMetaImageVariantUrl: dependencies.resolveMetaImageVariantUrl,
    resolvePostCover: dependencies.resolvePostCover,
  });

  return {
    ...metaHtmlRenderer,
    buildEditorialWebhookImageContext,
    sendHtml,
    ...siteMetaBuilders,
  };
};

export default createSiteRenderingRuntimeBundle;
