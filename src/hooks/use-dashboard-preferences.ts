import { useContext } from "react";
import { DashboardPreferencesContext } from "@/hooks/dashboard-preferences-context";

export const useDashboardPreferences = () => useContext(DashboardPreferencesContext);
