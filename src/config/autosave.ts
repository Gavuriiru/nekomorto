export type AutosaveRuntimeConfig = {
  enabledByDefault: boolean;
  debounceMs: number;
  retryMax: number;
  retryBaseMs: number;
};

const DEFAULT_AUTOSAVE_CONFIG: AutosaveRuntimeConfig = {
  enabledByDefault: true,
  debounceMs: 1200,
  retryMax: 2,
  retryBaseMs: 1500,
};

const AUTOSAVE_LIMITS = {
  debounceMs: { min: 300, max: 10000 },
  retryMax: { min: 0, max: 5 },
  retryBaseMs: { min: 300, max: 10000 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(Math.round(parsed), min, max);
};

export const autosaveRuntimeConfig: AutosaveRuntimeConfig = {
  enabledByDefault: parseBoolean(
    import.meta.env.VITE_DASHBOARD_AUTOSAVE_ENABLED,
    DEFAULT_AUTOSAVE_CONFIG.enabledByDefault,
  ),
  debounceMs: parseInteger(
    import.meta.env.VITE_DASHBOARD_AUTOSAVE_DEBOUNCE_MS,
    DEFAULT_AUTOSAVE_CONFIG.debounceMs,
    AUTOSAVE_LIMITS.debounceMs.min,
    AUTOSAVE_LIMITS.debounceMs.max,
  ),
  retryMax: parseInteger(
    import.meta.env.VITE_DASHBOARD_AUTOSAVE_RETRY_MAX,
    DEFAULT_AUTOSAVE_CONFIG.retryMax,
    AUTOSAVE_LIMITS.retryMax.min,
    AUTOSAVE_LIMITS.retryMax.max,
  ),
  retryBaseMs: parseInteger(
    import.meta.env.VITE_DASHBOARD_AUTOSAVE_RETRY_BASE_MS,
    DEFAULT_AUTOSAVE_CONFIG.retryBaseMs,
    AUTOSAVE_LIMITS.retryBaseMs.min,
    AUTOSAVE_LIMITS.retryBaseMs.max,
  ),
};

export const autosaveStorageKeys = {
  pages: "dashboard.autosave.pages.enabled",
  settings: "dashboard.autosave.settings.enabled",
} as const;

export const readAutosavePreference = (storageKey: string, fallback: boolean) => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (rawValue === null) {
      return fallback;
    }
    return parseBoolean(rawValue, fallback);
  } catch {
    return fallback;
  }
};

export const writeAutosavePreference = (storageKey: string, nextEnabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, String(Boolean(nextEnabled)));
  } catch {
    // ignore localStorage failures
  }
};
