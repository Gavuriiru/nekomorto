import type { SiteSettings } from "@/types/site-settings";

const DASHBOARD_SETTINGS_CACHE_TTL_MS = 60_000;

export type DashboardSettingsLinkTypeItem = {
  id: string;
  label: string;
  icon: string;
};

export type DashboardSettingsCacheEntry = {
  settings: SiteSettings;
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  staffRoleTranslations: Record<string, string>;
  knownTags: string[];
  knownGenres: string[];
  knownStaffRoles: string[];
  linkTypes: DashboardSettingsLinkTypeItem[];
  expiresAt: number;
};

let dashboardSettingsCache: DashboardSettingsCacheEntry | null = null;

const cloneDashboardSettingsCache = (value: Omit<DashboardSettingsCacheEntry, "expiresAt">) => ({
  settings: JSON.parse(JSON.stringify(value.settings)) as SiteSettings,
  tagTranslations: { ...value.tagTranslations },
  genreTranslations: { ...value.genreTranslations },
  staffRoleTranslations: { ...value.staffRoleTranslations },
  knownTags: [...value.knownTags],
  knownGenres: [...value.knownGenres],
  knownStaffRoles: [...value.knownStaffRoles],
  linkTypes: JSON.parse(JSON.stringify(value.linkTypes)) as DashboardSettingsLinkTypeItem[],
});

export const readDashboardSettingsCache = () => {
  if (!dashboardSettingsCache) {
    return null;
  }
  if (dashboardSettingsCache.expiresAt <= Date.now()) {
    dashboardSettingsCache = null;
    return null;
  }
  return cloneDashboardSettingsCache(dashboardSettingsCache);
};

export const writeDashboardSettingsCache = (
  value: Omit<DashboardSettingsCacheEntry, "expiresAt">,
) => {
  dashboardSettingsCache = {
    ...cloneDashboardSettingsCache(value),
    expiresAt: Date.now() + DASHBOARD_SETTINGS_CACHE_TTL_MS,
  };
};

export const clearDashboardSettingsCache = () => {
  dashboardSettingsCache = null;
};
