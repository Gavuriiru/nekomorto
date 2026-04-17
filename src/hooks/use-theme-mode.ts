import { ThemeModeContext } from "@/hooks/theme-mode-context";
import { useContext } from "react";

export const useThemeMode = () => useContext(ThemeModeContext);
