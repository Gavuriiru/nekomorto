import { createContext, useContext } from "react";

const DashboardSettingsContext = createContext<any>(null);

export const DashboardSettingsProvider = DashboardSettingsContext.Provider;

export const useDashboardSettingsContext = () => {
  const value = useContext(DashboardSettingsContext);
  if (!value) {
    throw new Error("DashboardSettingsContext is not available");
  }
  return value;
};
