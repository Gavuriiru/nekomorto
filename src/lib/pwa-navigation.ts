const DASHBOARD_NAVIGATION_PATTERN = /^\/dashboard(?:[/?]|$)/;
const AUTH_NAVIGATION_PATTERN = /^\/auth(?:[/?]|$)/;
const API_NAVIGATION_PATTERN = /^\/api(?:[/?]|$)/;
const LOGIN_NAVIGATION_PATTERN = /^\/login(?:[/?]|$)/;

export const PWA_NAVIGATE_FALLBACK_ALLOWLIST = [DASHBOARD_NAVIGATION_PATTERN];
export const PWA_NAVIGATE_FALLBACK_DENYLIST = [
  AUTH_NAVIGATION_PATTERN,
  API_NAVIGATION_PATTERN,
  LOGIN_NAVIGATION_PATTERN,
];

const matchesAnyPattern = (patterns: RegExp[], pathnameAndSearch: string) =>
  patterns.some((pattern) => pattern.test(pathnameAndSearch));

export const shouldUsePwaAppShell = (pathnameAndSearch: string) => {
  const normalizedPathnameAndSearch = String(pathnameAndSearch || "").trim() || "/";

  if (matchesAnyPattern(PWA_NAVIGATE_FALLBACK_DENYLIST, normalizedPathnameAndSearch)) {
    return false;
  }

  return matchesAnyPattern(PWA_NAVIGATE_FALLBACK_ALLOWLIST, normalizedPathnameAndSearch);
};
