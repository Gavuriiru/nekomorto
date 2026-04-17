import { DashboardPreferencesContext } from "@/hooks/dashboard-preferences-context";
import { useContext } from "react";

export const useDashboardPreferences = () => useContext(DashboardPreferencesContext);
