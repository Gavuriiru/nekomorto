import { describe, expect, it, vi } from "vitest";

import { createDataRepositorySiteConfigRuntime } from "../../server/lib/data-repository-site-config-runtime.js";

const createRepository = () => ({
  loadIntegrationSettings: vi.fn(() => ({
    editorial: { enabled: true },
    operational: { enabled: true },
    security: { enabled: false },
  })),
  loadPages: vi.fn(() => ({
    home: {
      title: "OlÃ¡",
    },
  })),
  loadSiteSettings: vi.fn(() => ({
    site: {
      name: "Example",
    },
  })),
  loadTagTranslations: vi.fn(() => ({
    tags: { a: "A" },
    genres: null,
    staffRoles: { editor: "Editor" },
  })),
  writeIntegrationSettings: vi.fn(),
  writePages: vi.fn(),
  writeSiteSettings: vi.fn(),
  writeTagTranslations: vi.fn(),
});

describe("data-repository-site-config-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createDataRepositorySiteConfigRuntime()).toThrow(/missing required dependencies/i);
  });

  it("loads and writes repository-backed site configuration collections", () => {
    const dataRepository = createRepository();
    const invalidateJsonFileCache = vi.fn();
    const invalidatePublicReadCacheTags = vi.fn();
    const readJsonFileFromCache = vi.fn(() => null);
    const writeJsonFileToCache = vi.fn();
    const normalizeSiteSettings = vi.fn((value) => ({
      ...value,
      normalized: true,
    }));
    const buildSiteSettingsStoragePayload = vi.fn((value) => ({
      persisted: value,
    }));
    const buildWebhookSettingsBundle = vi.fn((value) => ({
      settings: {
        editorial: value?.editorial || { enabled: false },
        operational: value?.operational || { enabled: false },
        security: value?.security || { enabled: false },
      },
      sources: {
        editorial: "env",
        operational: "env",
        security: "env",
      },
    }));

    const runtime = createDataRepositorySiteConfigRuntime({
      dataRepository,
      defaultSiteSettings: {
        site: { name: "Default" },
      },
      fixMojibakeDeep: (value) => value,
      getBuildEnvOperationalWebhookSettings: () => () => ({
        enabled: false,
        source: "ops-fallback",
      }),
      getBuildEnvSecurityWebhookSettings: () => () => ({ enabled: false, source: "sec-fallback" }),
      getBuildSiteSettingsStoragePayload: () => buildSiteSettingsStoragePayload,
      getBuildWebhookSettingsBundle: () => buildWebhookSettingsBundle,
      getNormalizeSiteSettings: () => normalizeSiteSettings,
      invalidateJsonFileCache,
      invalidatePublicReadCacheTags,
      normalizeOperationalWebhookSettings: (value, options) => ({
        ...value,
        normalizedOperational: true,
        fallback: options.fallback,
      }),
      normalizeSecurityWebhookSettings: (value, options) => ({
        ...value,
        normalizedSecurity: true,
        fallback: options.fallback,
      }),
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
      },
      readJsonFileFromCache,
      writeJsonFileToCache,
    });

    expect(runtime.loadTagTranslations()).toEqual({
      tags: { a: "A" },
      genres: {},
      staffRoles: { editor: "Editor" },
    });
    runtime.writeTagTranslations({ tags: { b: "B" } });
    expect(dataRepository.writeTagTranslations).toHaveBeenCalledWith({ tags: { b: "B" } });

    expect(runtime.loadPages()).toEqual({
      home: {
        title: "OlÃ¡",
      },
    });
    runtime.writePages({ about: { title: "Sobre" } });
    expect(dataRepository.writePages).toHaveBeenCalledWith({ about: { title: "Sobre" } });

    expect(runtime.loadSiteSettings()).toEqual({
      site: { name: "Example" },
      normalized: true,
    });
    expect(dataRepository.writeSiteSettings).toHaveBeenCalledWith({
      persisted: {
        site: { name: "Example" },
        normalized: true,
      },
    });
    runtime.writeSiteSettings({ site: { name: "New" } });
    expect(dataRepository.writeSiteSettings).toHaveBeenLastCalledWith({
      persisted: {
        site: { name: "New" },
        normalized: true,
      },
    });

    expect(runtime.loadIntegrationSettings()).toEqual({
      editorial: { enabled: true },
      operational: { enabled: true },
      security: { enabled: false },
    });
    expect(runtime.loadIntegrationSettingsSources()).toEqual({
      editorial: "env",
      operational: "env",
      security: "env",
    });
    expect(
      runtime.writeIntegrationSettings({
        editorial: { enabled: false },
        operational: { enabled: true },
        security: { enabled: true },
      }),
    ).toEqual({
      editorial: { enabled: false },
      operational: {
        enabled: true,
        normalizedOperational: true,
        fallback: { enabled: false, source: "ops-fallback" },
      },
      security: {
        enabled: true,
        normalizedSecurity: true,
        fallback: { enabled: false, source: "sec-fallback" },
      },
    });
    expect(dataRepository.writeIntegrationSettings).toHaveBeenCalled();
    expect(invalidateJsonFileCache).toHaveBeenCalledWith("integration-settings");
    expect(writeJsonFileToCache).toHaveBeenCalled();
    expect(invalidatePublicReadCacheTags).toHaveBeenCalledWith(["bootstrap"]);
  });

  it("returns defaults when repository methods are unavailable", () => {
    const runtime = createDataRepositorySiteConfigRuntime({
      dataRepository: {},
      defaultSiteSettings: {
        site: { name: "Default" },
      },
      fixMojibakeDeep: (value) => value,
      getBuildEnvOperationalWebhookSettings: () => () => ({ enabled: false }),
      getBuildEnvSecurityWebhookSettings: () => () => ({ enabled: false }),
      getBuildSiteSettingsStoragePayload: () => (value) => value,
      getBuildWebhookSettingsBundle: () => (value) => ({
        settings: value?.settings || {},
        sources: { editorial: "env", operational: "env", security: "env" },
      }),
      getNormalizeSiteSettings: () => (value) => value,
      invalidateJsonFileCache: vi.fn(),
      invalidatePublicReadCacheTags: vi.fn(),
      normalizeOperationalWebhookSettings: (value) => value,
      normalizeSecurityWebhookSettings: (value) => value,
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
      },
      readJsonFileFromCache: () => null,
      writeJsonFileToCache: vi.fn(),
    });

    expect(runtime.loadTagTranslations()).toEqual({ tags: {}, genres: {}, staffRoles: {} });
    expect(runtime.loadPages()).toEqual({});
    expect(runtime.loadSiteSettings()).toEqual({ site: { name: "Default" } });
    expect(runtime.loadIntegrationSettings()).toEqual({});
  });

  it("fails fast when a lazy site-setting dependency is unresolved", () => {
    const runtime = createDataRepositorySiteConfigRuntime({
      dataRepository: {
        loadSiteSettings: () => ({ site: { name: "Example" } }),
      },
      defaultSiteSettings: {
        site: { name: "Default" },
      },
      fixMojibakeDeep: (value) => value,
      getBuildEnvOperationalWebhookSettings: () => () => ({ enabled: false }),
      getBuildEnvSecurityWebhookSettings: () => () => ({ enabled: false }),
      getBuildSiteSettingsStoragePayload: () => (value) => value,
      getBuildWebhookSettingsBundle: () => (value) => value,
      getNormalizeSiteSettings: () => undefined,
      invalidateJsonFileCache: vi.fn(),
      invalidatePublicReadCacheTags: vi.fn(),
      normalizeOperationalWebhookSettings: (value) => value,
      normalizeSecurityWebhookSettings: (value) => value,
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
      },
      readJsonFileFromCache: () => null,
      writeJsonFileToCache: vi.fn(),
    });

    expect(() => runtime.loadSiteSettings()).toThrow(/getNormalizeSiteSettings/);
  });
});
