import { createContext } from "react";

export type DashboardPreferencesShape = {
  homeByRole?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
};

export type DashboardPreferencesContextValue = {
  hasProvider: boolean;
  preferences: Record<string, unknown>;
  dashboardPreferences: DashboardPreferencesShape;
  isLoading: boolean;
  hasResolved: boolean;
  refresh: () => Promise<Record<string, unknown>>;
  updatePreferences: (
    nextPreferences:
      | Record<string, unknown>
      | ((previous: Record<string, unknown>) => Record<string, unknown>),
  ) => Promise<Record<string, unknown>>;
  patchDashboardPreferences: (
    patch:
      | Record<string, unknown>
      | ((previous: DashboardPreferencesShape) => Record<string, unknown>),
  ) => Promise<Record<string, unknown>>;
};

export const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue>({
  hasProvider: false,
  preferences: {},
  dashboardPreferences: {},
  isLoading: false,
  hasResolved: false,
  refresh: async () => ({}),
  updatePreferences: async (nextPreferences) =>
    typeof nextPreferences === "function" ? nextPreferences({}) : nextPreferences,
  patchDashboardPreferences: async () => ({}),
});
