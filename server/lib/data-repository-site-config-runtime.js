const REQUIRED_DEPENDENCY_KEYS = [
  "defaultSiteSettings",
  "fixMojibakeDeep",
  "getBuildEnvOperationalWebhookSettings",
  "getBuildEnvSecurityWebhookSettings",
  "getBuildSiteSettingsStoragePayload",
  "getBuildWebhookSettingsBundle",
  "getNormalizeSiteSettings",
  "invalidateJsonFileCache",
  "invalidatePublicReadCacheTags",
  "normalizeOperationalWebhookSettings",
  "normalizeSecurityWebhookSettings",
  "normalizeUploadsDeep",
  "publicReadCacheTags",
  "readJsonFileFromCache",
  "writeJsonFileToCache",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[data-repository-site-config-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(
      `[data-repository-site-config-runtime] ${dependencyName} getter must be a function`,
    );
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(
    `[data-repository-site-config-runtime] ${dependencyName} getter must resolve to a function`,
  );
};

export const createDataRepositorySiteConfigRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    dataRepository = null,
    defaultSiteSettings,
    fixMojibakeDeep,
    getBuildEnvOperationalWebhookSettings,
    getBuildEnvSecurityWebhookSettings,
    getBuildSiteSettingsStoragePayload,
    getBuildWebhookSettingsBundle,
    getNormalizeSiteSettings,
    invalidateJsonFileCache,
    invalidatePublicReadCacheTags,
    normalizeOperationalWebhookSettings,
    normalizeSecurityWebhookSettings,
    normalizeUploadsDeep,
    publicReadCacheTags,
    readJsonFileFromCache,
    writeJsonFileToCache,
  } = dependencies;

  const hasMethod = (methodName) =>
    Boolean(dataRepository) && typeof dataRepository[methodName] === "function";

  const writeTagTranslations = (payload) => {
    if (hasMethod("writeTagTranslations")) {
      dataRepository.writeTagTranslations(payload);
    }
    invalidatePublicReadCacheTags([publicReadCacheTags.BOOTSTRAP]);
    invalidateJsonFileCache("tag-translations");
  };

  const loadTagTranslations = () => {
    const cached = readJsonFileFromCache("tag-translations");
    if (cached) {
      return cached;
    }
    if (!hasMethod("loadTagTranslations")) {
      return { tags: {}, genres: {}, staffRoles: {} };
    }
    const parsed = dataRepository.loadTagTranslations();
    const normalized = {
      tags: parsed?.tags && typeof parsed.tags === "object" ? parsed.tags : {},
      genres: parsed?.genres && typeof parsed.genres === "object" ? parsed.genres : {},
      staffRoles:
        parsed?.staffRoles && typeof parsed.staffRoles === "object" ? parsed.staffRoles : {},
    };
    writeJsonFileToCache("tag-translations", normalized);
    return normalized;
  };

  const writePages = (pages) => {
    if (hasMethod("writePages")) {
      dataRepository.writePages(normalizeUploadsDeep(fixMojibakeDeep(pages)));
    }
    invalidatePublicReadCacheTags([publicReadCacheTags.BOOTSTRAP]);
  };

  const loadPages = () => {
    if (!hasMethod("loadPages")) {
      return {};
    }
    let parsed = dataRepository.loadPages();
    if (!parsed || typeof parsed !== "object") {
      parsed = {};
    }
    const normalized = normalizeUploadsDeep(fixMojibakeDeep(parsed));
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writePages(normalized);
    }
    return normalized;
  };

  const writeSiteSettings = (settings) => {
    const normalizeSiteSettings = resolveLazyDependency(
      "getNormalizeSiteSettings",
      getNormalizeSiteSettings,
    );
    const buildSiteSettingsStoragePayload = resolveLazyDependency(
      "getBuildSiteSettingsStoragePayload",
      getBuildSiteSettingsStoragePayload,
    );
    const normalized = normalizeSiteSettings(settings);
    const storagePayload = buildSiteSettingsStoragePayload(normalized);
    if (hasMethod("writeSiteSettings")) {
      dataRepository.writeSiteSettings(storagePayload);
    }
    invalidatePublicReadCacheTags([publicReadCacheTags.BOOTSTRAP]);
    invalidateJsonFileCache("site-settings");
  };

  const loadSiteSettings = () => {
    const cached = readJsonFileFromCache("site-settings");
    if (cached) {
      return cached;
    }
    const normalizeSiteSettings = resolveLazyDependency(
      "getNormalizeSiteSettings",
      getNormalizeSiteSettings,
    );
    const buildSiteSettingsStoragePayload = resolveLazyDependency(
      "getBuildSiteSettingsStoragePayload",
      getBuildSiteSettingsStoragePayload,
    );
    if (!hasMethod("loadSiteSettings")) {
      return normalizeSiteSettings(defaultSiteSettings);
    }
    let parsed = dataRepository.loadSiteSettings();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const seeded = normalizeSiteSettings(defaultSiteSettings);
      writeSiteSettings(seeded);
      writeJsonFileToCache("site-settings", seeded);
      return seeded;
    }
    const normalized = normalizeSiteSettings(parsed);
    const storagePayload = buildSiteSettingsStoragePayload(normalized);
    if (JSON.stringify(parsed) !== JSON.stringify(storagePayload)) {
      writeSiteSettings(normalized);
    }
    writeJsonFileToCache("site-settings", normalized);
    return normalized;
  };

  const loadIntegrationSettingsBundle = () => {
    const cached = readJsonFileFromCache("integration-settings");
    if (
      cached &&
      cached.settings &&
      typeof cached.settings === "object" &&
      cached.sources &&
      typeof cached.sources === "object"
    ) {
      return cached;
    }
    const buildWebhookSettingsBundle = resolveLazyDependency(
      "getBuildWebhookSettingsBundle",
      getBuildWebhookSettingsBundle,
    );
    if (!hasMethod("loadIntegrationSettings")) {
      const defaults = buildWebhookSettingsBundle({});
      writeJsonFileToCache("integration-settings", defaults);
      return defaults;
    }
    const parsed = dataRepository.loadIntegrationSettings();
    const bundle = buildWebhookSettingsBundle(parsed);
    writeJsonFileToCache("integration-settings", bundle);
    return bundle;
  };

  const loadIntegrationSettings = () => loadIntegrationSettingsBundle().settings;

  const loadIntegrationSettingsSources = () => loadIntegrationSettingsBundle().sources;

  const writeIntegrationSettings = (settings) => {
    const buildWebhookSettingsBundle = resolveLazyDependency(
      "getBuildWebhookSettingsBundle",
      getBuildWebhookSettingsBundle,
    );
    const buildEnvOperationalWebhookSettings = resolveLazyDependency(
      "getBuildEnvOperationalWebhookSettings",
      getBuildEnvOperationalWebhookSettings,
    );
    const buildEnvSecurityWebhookSettings = resolveLazyDependency(
      "getBuildEnvSecurityWebhookSettings",
      getBuildEnvSecurityWebhookSettings,
    );
    const bundle = buildWebhookSettingsBundle(settings);
    const persistedBundle = {
      settings: {
        ...bundle.settings,
        operational: normalizeOperationalWebhookSettings(bundle.settings.operational, {
          fallback: buildEnvOperationalWebhookSettings(),
        }),
        security: normalizeSecurityWebhookSettings(bundle.settings.security, {
          fallback: buildEnvSecurityWebhookSettings(),
        }),
      },
      sources: {
        editorial: "stored",
        operational: "stored",
        security: "stored",
      },
    };
    if (hasMethod("writeIntegrationSettings")) {
      dataRepository.writeIntegrationSettings(persistedBundle.settings);
    }
    invalidateJsonFileCache("integration-settings");
    writeJsonFileToCache("integration-settings", persistedBundle);
    return persistedBundle.settings;
  };

  return {
    loadIntegrationSettings,
    loadIntegrationSettingsBundle,
    loadIntegrationSettingsSources,
    loadPages,
    loadSiteSettings,
    loadTagTranslations,
    writeIntegrationSettings,
    writePages,
    writeSiteSettings,
    writeTagTranslations,
  };
};

export default createDataRepositorySiteConfigRuntime;
