const DASHBOARD_NAVIGATION_PATTERN = /^\/dashboard(?:[/?]|$)/;
const AUTH_NAVIGATION_PATTERN = /^\/auth(?:[/?]|$)/;
const API_NAVIGATION_PATTERN = /^\/api(?:[/?]|$)/;
const LOGIN_NAVIGATION_PATTERN = /^\/login(?:[/?]|$)/;
const HOME_NAVIGATION_PATTERN = /^\/$/;

export const PWA_NAVIGATE_FALLBACK_ALLOWLIST = [DASHBOARD_NAVIGATION_PATTERN];
export const PWA_NAVIGATE_FALLBACK_DENYLIST = [
  AUTH_NAVIGATION_PATTERN,
  API_NAVIGATION_PATTERN,
  LOGIN_NAVIGATION_PATTERN,
];

const matchesAnyPattern = (patterns, pathnameAndSearch) =>
  patterns.some((pattern) => pattern.test(pathnameAndSearch));

const normalizePathnameAndSearch = (value) => String(value || "").trim() || "/";

export const shouldUsePwaAppShell = (pathnameAndSearch) => {
  const normalizedPathnameAndSearch = normalizePathnameAndSearch(pathnameAndSearch);

  if (matchesAnyPattern(PWA_NAVIGATE_FALLBACK_DENYLIST, normalizedPathnameAndSearch)) {
    return false;
  }

  return matchesAnyPattern(PWA_NAVIGATE_FALLBACK_ALLOWLIST, normalizedPathnameAndSearch);
};

export const shouldRegisterPwaImmediately = ({ pathname, hasServiceWorkerController }) => {
  if (!hasServiceWorkerController) {
    return false;
  }

  return HOME_NAVIGATION_PATTERN.test(normalizePathnameAndSearch(pathname).split(/[?#]/, 1)[0]);
};
