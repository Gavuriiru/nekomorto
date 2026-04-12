import { describe, expect, it, vi } from "vitest";

import { createStartupSecuritySanitizationRuntime } from "../../server/lib/startup-security-sanitization-runtime.js";

const createRuntime = (overrides: Record<string, unknown> = {}) => {
  const appendAuditLog = vi.fn();
  const createSystemAuditReq = vi.fn(() => ({ id: "system-audit" }));
  const loadIntegrationSettings = vi.fn(() => ({}));
  const loadLinkTypes = vi.fn(() => []);
  const loadSiteSettings = vi.fn(() => ({}));
  const loadUsers = vi.fn(() => []);

  const runtime = createStartupSecuritySanitizationRuntime({
    appendAuditLog,
    createSystemAuditReq,
    dataRepository: {
      loadLinkTypes: () => [],
      loadSiteSettings: () => ({}),
      loadUsers: () => [],
    },
    loadIntegrationSettings,
    loadLinkTypes,
    loadSiteSettings,
    loadUsers,
    sanitizeIconSource: vi.fn((value) => String(value || "").startsWith("https://safe.example/")),
    sanitizePublicHref: vi.fn((value) => String(value || "").startsWith("https://safe.example/")),
    sanitizeSocials: vi.fn((items) =>
      Array.isArray(items)
        ? items.filter((item) => String(item?.href || "").startsWith("https://safe.example/"))
        : [],
    ),
    ...overrides,
  });

  return {
    appendAuditLog,
    createSystemAuditReq,
    loadIntegrationSettings,
    loadLinkTypes,
    loadSiteSettings,
    loadUsers,
    runtime,
  };
};

describe("startup-security-sanitization-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createStartupSecuritySanitizationRuntime()).toThrow(
      /missing required dependencies/i,
    );
  });

  it("counts dropped legacy entries and emits an audit log on startup", () => {
    const {
      appendAuditLog,
      createSystemAuditReq,
      loadIntegrationSettings,
      loadLinkTypes,
      loadSiteSettings,
      loadUsers,
      runtime,
    } = createRuntime({
      dataRepository: {
        loadLinkTypes: () => [{ icon: "unsafe-icon" }, { icon: "https://safe.example/icon.svg" }],
        loadSiteSettings: () => ({
          navbar: {
            links: [{ href: "https://unsafe.example/nav" }, { href: "https://safe.example/nav" }],
          },
          footer: {
            socialLinks: [{ href: "https://unsafe.example/footer" }],
          },
          community: {
            discordUrl: "https://unsafe.example/discord",
            inviteCard: {
              ctaUrl: "https://safe.example/invite",
            },
          },
        }),
        loadUsers: () => [
          {
            socials: [{ href: "https://safe.example/a" }, { href: "https://unsafe.example/b" }],
          },
        ],
      },
    });

    runtime.runStartupSecuritySanitization();

    expect(loadUsers).toHaveBeenCalledTimes(1);
    expect(loadLinkTypes).toHaveBeenCalledTimes(1);
    expect(loadSiteSettings).toHaveBeenCalledTimes(1);
    expect(loadIntegrationSettings).toHaveBeenCalledTimes(1);
    expect(createSystemAuditReq).toHaveBeenCalledTimes(1);
    expect(appendAuditLog).toHaveBeenCalledWith(
      { id: "system-audit" },
      "security.update.sanitization_startup",
      "security",
      {
        usersSocialsDropped: 1,
        linkTypeIconsDropped: 1,
        siteLinksDropped: 3,
      },
    );
  });

  it("always triggers normalization loads and skips audit logging when nothing is dropped", () => {
    const {
      appendAuditLog,
      createSystemAuditReq,
      loadIntegrationSettings,
      loadLinkTypes,
      loadSiteSettings,
      loadUsers,
      runtime,
    } = createRuntime({
      dataRepository: null,
    });

    runtime.runStartupSecuritySanitization();

    expect(loadUsers).toHaveBeenCalledTimes(1);
    expect(loadLinkTypes).toHaveBeenCalledTimes(1);
    expect(loadSiteSettings).toHaveBeenCalledTimes(1);
    expect(loadIntegrationSettings).toHaveBeenCalledTimes(1);
    expect(createSystemAuditReq).not.toHaveBeenCalled();
    expect(appendAuditLog).not.toHaveBeenCalled();
  });
});
