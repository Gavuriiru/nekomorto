const REQUIRED_DEPENDENCY_KEYS = [
  "appendAuditLog",
  "createSystemAuditReq",
  "loadIntegrationSettings",
  "loadLinkTypes",
  "loadSiteSettings",
  "loadUsers",
  "sanitizeIconSource",
  "sanitizePublicHref",
  "sanitizeSocials",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[startup-security-sanitization-runtime] missing required dependencies: ${missing
      .sort()
      .join(", ")}`,
  );
};

export const createStartupSecuritySanitizationRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    appendAuditLog,
    createSystemAuditReq,
    dataRepository = null,
    loadIntegrationSettings,
    loadLinkTypes,
    loadSiteSettings,
    loadUsers,
    sanitizeIconSource,
    sanitizePublicHref,
    sanitizeSocials,
  } = dependencies;

  const countDroppedUserSocials = (usersInput) => {
    const users = Array.isArray(usersInput) ? usersInput : [];
    return users.reduce((total, user) => {
      const socials = Array.isArray(user?.socials) ? user.socials.filter(Boolean) : [];
      const sanitized = sanitizeSocials(socials);
      return total + Math.max(0, socials.length - sanitized.length);
    }, 0);
  };

  const countDroppedLinkTypeIcons = (itemsInput) => {
    const items = Array.isArray(itemsInput) ? itemsInput : [];
    return items.reduce((total, item) => {
      const iconRaw = String(item?.icon || "").trim();
      if (!iconRaw) {
        return total;
      }
      return sanitizeIconSource(iconRaw) ? total : total + 1;
    }, 0);
  };

  const countDroppedSiteLinks = (settingsInput) => {
    const settings = settingsInput && typeof settingsInput === "object" ? settingsInput : {};
    let total = 0;
    const navbarLinks = Array.isArray(settings?.navbar?.links) ? settings.navbar.links : [];
    navbarLinks.forEach((link) => {
      const href = String(link?.href || "").trim();
      if (href && !sanitizePublicHref(href)) {
        total += 1;
      }
    });
    const footerLinks = Array.isArray(settings?.footer?.socialLinks)
      ? settings.footer.socialLinks
      : [];
    footerLinks.forEach((link) => {
      const href = String(link?.href || "").trim();
      if (href && !sanitizePublicHref(href)) {
        total += 1;
      }
    });
    const communityDiscordUrl = String(settings?.community?.discordUrl || "").trim();
    if (communityDiscordUrl && !sanitizePublicHref(communityDiscordUrl)) {
      total += 1;
    }
    const inviteCardCtaUrl = String(settings?.community?.inviteCard?.ctaUrl || "").trim();
    if (inviteCardCtaUrl && !sanitizePublicHref(inviteCardCtaUrl)) {
      total += 1;
    }
    return total;
  };

  const runStartupSecuritySanitization = () => {
    const rawUsers = dataRepository ? dataRepository.loadUsers() : [];
    const rawLinkTypes = dataRepository ? dataRepository.loadLinkTypes() : [];
    const rawSiteSettings = dataRepository ? dataRepository.loadSiteSettings() : {};
    const usersSocialsDropped = countDroppedUserSocials(rawUsers);
    const linkTypeIconsDropped = countDroppedLinkTypeIcons(rawLinkTypes);
    const siteLinksDropped = countDroppedSiteLinks(rawSiteSettings);

    // Trigger normalization and persistence for legacy data.
    loadUsers();
    loadLinkTypes();
    loadSiteSettings();
    loadIntegrationSettings();

    const totalDropped = usersSocialsDropped + linkTypeIconsDropped + siteLinksDropped;
    if (totalDropped > 0) {
      appendAuditLog(createSystemAuditReq(), "security.update.sanitization_startup", "security", {
        usersSocialsDropped,
        linkTypeIconsDropped,
        siteLinksDropped,
      });
    }
  };

  return {
    countDroppedLinkTypeIcons,
    countDroppedSiteLinks,
    countDroppedUserSocials,
    runStartupSecuritySanitization,
  };
};

export default createStartupSecuritySanitizationRuntime;
