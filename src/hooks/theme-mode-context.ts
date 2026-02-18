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

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  globalMode: "dark",
  effectiveMode: "dark",
  preference: "global",
  isOverridden: false,
  setPreference: () => undefined,
});
