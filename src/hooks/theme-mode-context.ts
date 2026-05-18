import { createContext } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeModePreference = "global" | ThemeMode;

export type ThemeModeContextValue = {
  globalMode: ThemeMode;
  effectiveMode: ThemeMode;
  preference: ThemeModePreference;
  isOverridden: boolean;
  setPreference: (next: ThemeModePreference) => void;
};

export const THEME_MODE_STORAGE_KEY = "nekomata:theme-mode-preference";
export const THEME_MODE_PRESERVE_MOTION_ATTRIBUTE = "data-theme-mode-preserve-motion";
export const THEME_MODE_SYNC_EVENT = "nekomata:theme-mode-sync";
export const THEME_MODE_GLOBAL_STATE_KEY = "__NEKOMATA_THEME_MODE_STATE__";

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  globalMode: "dark",
  effectiveMode: "dark",
  preference: "global",
  isOverridden: false,
  setPreference: () => undefined,
});
