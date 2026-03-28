import { createContext, useContext } from "react";

import type { DashboardSettingsContextValue } from "./dashboard-settings-types";

const DashboardSettingsContext = createContext<DashboardSettingsContextValue | null>(null);

export const DashboardSettingsProvider = DashboardSettingsContext.Provider;

export const useDashboardSettingsContext = () => {
  const value = useContext(DashboardSettingsContext);
  if (!value) {
    throw new Error("DashboardSettingsContext is not available");
  }
  return value;
};
