import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  THEME_MODE_STORAGE_KEY,
  ThemeModeContext,
  type ThemeMode,
  type ThemeModeContextValue,
  type ThemeModePreference,
} from "@/hooks/theme-mode-context";

const normalizeMode = (value: unknown): ThemeMode => (value === "light" ? "light" : "dark");
const normalizePreference = (value: unknown): ThemeModePreference => {
  if (value === "light" || value === "dark" || value === "global") {
    return value;
  }
  return "global";
};

const readInitialPreference = (): ThemeModePreference => {
  if (typeof window === "undefined") {
    return "global";
  }
  try {
    const raw = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return normalizePreference(raw);
  } catch {
    return "global";
  }
};

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.style.colorScheme = mode;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const { settings } = useSiteSettings();
  const [preference, setPreferenceState] = useState<ThemeModePreference>(() => readInitialPreference());

  const globalMode = normalizeMode(settings.theme?.mode);
  const effectiveMode = preference === "global" ? globalMode : preference;
  const isOverridden = preference !== "global";

  const setPreference = useCallback((next: ThemeModePreference) => {
    setPreferenceState(normalizePreference(next));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (preference === "global") {
        window.localStorage.removeItem(THEME_MODE_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, preference);
    } catch {
      // ignore localStorage failures
    }
  }, [preference]);

  useEffect(() => {
    applyThemeToDocument(effectiveMode);
  }, [effectiveMode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      globalMode,
      effectiveMode,
      preference,
      isOverridden,
      setPreference,
    }),
    [effectiveMode, globalMode, isOverridden, preference, setPreference],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
};
