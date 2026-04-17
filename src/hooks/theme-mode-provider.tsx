import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  THEME_MODE_PRESERVE_MOTION_ATTRIBUTE,
  THEME_MODE_STORAGE_KEY,
  type ThemeMode,
  ThemeModeContext,
  type ThemeModeContextValue,
  type ThemeModePreference,
} from "@/hooks/theme-mode-context";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { resolveThemeColor } from "@/lib/theme-color";

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

const THEME_MODE_TRANSITION_STYLE_ATTRIBUTE = "data-theme-mode-disable-transitions";
const THEME_MODE_TRANSITION_DISABLE_SELECTOR = [
  `*:not([${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"], [${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"] *)`,
  `*:not([${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"], [${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"] *)::before`,
  `*:not([${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"], [${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"] *)::after`,
].join(",");

const applyThemeToDocument = (mode: ThemeMode, accentHex: unknown) => {
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
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", resolveThemeColor(accentHex));
  }
};

const disableThemeTransitionsTemporarily = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => undefined;
  }

  document.head
    .querySelectorAll(`style[${THEME_MODE_TRANSITION_STYLE_ATTRIBUTE}]`)
    .forEach((node) => node.remove());

  const style = document.createElement("style");
  style.setAttribute(THEME_MODE_TRANSITION_STYLE_ATTRIBUTE, "true");
  style.appendChild(
    document.createTextNode(
      `${THEME_MODE_TRANSITION_DISABLE_SELECTOR}{-webkit-transition:none !important;transition:none !important;}`,
    ),
  );
  document.head.appendChild(style);

  let firstFrame = 0;
  let secondFrame = 0;
  let isRemoved = false;

  const removeStyle = () => {
    if (isRemoved) {
      return;
    }
    isRemoved = true;
    if (firstFrame) {
      window.cancelAnimationFrame(firstFrame);
    }
    if (secondFrame) {
      window.cancelAnimationFrame(secondFrame);
    }
    style.remove();
  };

  firstFrame = window.requestAnimationFrame(() => {
    void window.getComputedStyle(document.body).opacity;
    secondFrame = window.requestAnimationFrame(() => {
      removeStyle();
    });
  });

  return removeStyle;
};

export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const { settings } = useSiteSettings();
  const [preference, setPreferenceState] = useState<ThemeModePreference>(() =>
    readInitialPreference(),
  );
  const previousModeRef = useRef<ThemeMode | null>(null);
  const transitionCleanupRef = useRef<(() => void) | null>(null);

  const globalMode = normalizeMode(settings.theme?.mode);
  const effectiveMode = preference === "global" ? globalMode : preference;
  const isOverridden = preference !== "global";
  const themeAccent = settings.theme?.accent;

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
    const isFirstModeApplication = previousModeRef.current === null;
    const modeChanged = previousModeRef.current !== effectiveMode;
    previousModeRef.current = effectiveMode;

    if (!isFirstModeApplication && modeChanged) {
      transitionCleanupRef.current?.();
      transitionCleanupRef.current = disableThemeTransitionsTemporarily();
    } else if (!modeChanged) {
      transitionCleanupRef.current?.();
      transitionCleanupRef.current = null;
    }

    applyThemeToDocument(effectiveMode, themeAccent);
  }, [effectiveMode, themeAccent]);

  useEffect(
    () => () => {
      transitionCleanupRef.current?.();
      transitionCleanupRef.current = null;
    },
    [],
  );

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
