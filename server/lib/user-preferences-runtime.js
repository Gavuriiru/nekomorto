const REQUIRED_DEPENDENCY_KEYS = [
  "dashboardHomeRoleIds",
  "dashboardWidgetIds",
  "isPlainObject",
  "loadStoredUserPreferences",
  "normalizeProjectReaderPreferences",
  "userPreferencesDensitySet",
  "userPreferencesThemeModeSet",
  "writeStoredUserPreferences",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[user-preferences-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createUserPreferencesRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    dashboardHomeRoleIds,
    dashboardWidgetIds,
    isPlainObject,
    loadStoredUserPreferences,
    normalizeProjectReaderPreferences,
    userPreferencesDensitySet,
    userPreferencesThemeModeSet,
    writeStoredUserPreferences,
  } = dependencies;

  const normalizeDashboardWidgetsPreference = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    const dedupe = new Set();
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => dashboardWidgetIds.has(item))
      .filter((item) => {
        if (dedupe.has(item)) {
          return false;
        }
        dedupe.add(item);
        return true;
      })
      .slice(0, 20);
  };

  const normalizeDashboardHomeByRolePreference = (value) => {
    if (!isPlainObject(value)) {
      return {};
    }
    const normalized = {};
    Array.from(dashboardHomeRoleIds).forEach((roleId) => {
      const roleInput = value[roleId];
      const widgets = normalizeDashboardWidgetsPreference(roleInput?.widgets);
      if (widgets.length > 0) {
        normalized[roleId] = { widgets };
      }
    });
    return normalized;
  };

  const normalizeDashboardNotificationsPreference = (value) => {
    if (!isPlainObject(value)) {
      return {};
    }
    const normalized = {};
    const lastSeenAtRaw = String(value.lastSeenAt || "").trim();
    if (lastSeenAtRaw) {
      const parsedTs = new Date(lastSeenAtRaw).getTime();
      if (Number.isFinite(parsedTs)) {
        normalized.lastSeenAt = new Date(parsedTs).toISOString();
      }
    }
    return normalized;
  };

  const normalizeUserPreferences = (value) => {
    if (!isPlainObject(value)) {
      return {};
    }
    const normalized = {};
    const themeMode = String(value.themeMode || "")
      .trim()
      .toLowerCase();
    if (userPreferencesThemeModeSet.has(themeMode)) {
      normalized.themeMode = themeMode;
    }
    const density = String(value.density || "")
      .trim()
      .toLowerCase();
    if (userPreferencesDensitySet.has(density)) {
      normalized.density = density;
    }
    const dashboardInput = isPlainObject(value.dashboard) ? value.dashboard : null;
    if (dashboardInput) {
      const dashboard = {};
      const homeByRole = normalizeDashboardHomeByRolePreference(dashboardInput.homeByRole);
      if (Object.keys(homeByRole).length > 0) {
        dashboard.homeByRole = homeByRole;
      }
      const notifications = normalizeDashboardNotificationsPreference(dashboardInput.notifications);
      if (Object.keys(notifications).length > 0) {
        dashboard.notifications = notifications;
      }
      if (Object.keys(dashboard).length > 0) {
        normalized.dashboard = dashboard;
      }
    }
    const readerInput = isPlainObject(value.reader) ? value.reader : null;
    if (readerInput) {
      const reader = normalizeProjectReaderPreferences(readerInput);
      if (Object.keys(reader).length > 0) {
        normalized.reader = reader;
      }
    }
    return normalized;
  };

  const loadUserPreferences = (userId) => {
    const normalizedId = String(userId || "").trim();
    if (!normalizedId) {
      return {};
    }
    const parsed = loadStoredUserPreferences(normalizedId);
    const normalized = normalizeUserPreferences(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeStoredUserPreferences(normalizedId, normalized);
    }
    return normalized;
  };

  const writeUserPreferences = (userId, preferences) => {
    const normalizedId = String(userId || "").trim();
    if (!normalizedId) {
      return {};
    }
    const normalized = normalizeUserPreferences(preferences);
    writeStoredUserPreferences(normalizedId, normalized);
    return normalized;
  };

  return {
    loadUserPreferences,
    normalizeUserPreferences,
    writeUserPreferences,
  };
};

export default createUserPreferencesRuntime;
