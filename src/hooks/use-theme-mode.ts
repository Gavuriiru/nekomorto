import { useContext } from "react";
import { ThemeModeContext } from "@/hooks/theme-mode-context";

export const useThemeMode = () => useContext(ThemeModeContext);
