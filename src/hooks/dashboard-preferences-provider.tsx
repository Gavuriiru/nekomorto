import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  DashboardPreferencesContext,
  type DashboardPreferencesShape,
} from "@/hooks/dashboard-preferences-context";
import { useDashboardSession } from "@/hooks/use-dashboard-session";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toDashboardPreferences = (
  preferences: Record<string, unknown>,
): DashboardPreferencesShape => {
  const dashboard = isRecord(preferences.dashboard) ? preferences.dashboard : {};
  return {
    homeByRole: isRecord(dashboard.homeByRole) ? dashboard.homeByRole : {},
    notifications: isRecord(dashboard.notifications) ? dashboard.notifications : {},
  };
};

export const DashboardPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const apiBase = getApiBase();
  const { currentUser, hasResolved: hasResolvedSession } = useDashboardSession();
  const currentUserId = String(currentUser?.id || "").trim() || null;
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const preferencesRef = useRef<Record<string, unknown>>({});
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const latestUserIdRef = useRef<string | null>(currentUserId);
  const refreshRequestIdRef = useRef(0);

  useEffect(() => {
    latestUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      refreshRequestIdRef.current += 1;
      lastLoadedUserIdRef.current = null;
      preferencesRef.current = {};
      setPreferences({});
      setHasResolved(true);
      setIsLoading(false);
      return {};
    }
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    const requestedUserId = currentUserId;
    setIsLoading(true);
    try {
      const response = await apiFetch(apiBase, "/api/me/preferences", {
        auth: true,
        cache: "no-store",
      });
      if (
        refreshRequestIdRef.current !== requestId ||
        latestUserIdRef.current !== requestedUserId
      ) {
        return preferencesRef.current;
      }
      if (!response.ok) {
        lastLoadedUserIdRef.current = requestedUserId;
        preferencesRef.current = {};
        setPreferences({});
        setHasResolved(true);
        return {};
      }
      const payload = (await response.json()) as { preferences?: Record<string, unknown> };
      const nextPreferences = isRecord(payload?.preferences) ? payload.preferences : {};
      lastLoadedUserIdRef.current = requestedUserId;
      preferencesRef.current = nextPreferences;
      setPreferences(nextPreferences);
      setHasResolved(true);
      return nextPreferences;
    } catch {
      if (
        refreshRequestIdRef.current !== requestId ||
        latestUserIdRef.current !== requestedUserId
      ) {
        return preferencesRef.current;
      }
      lastLoadedUserIdRef.current = requestedUserId;
      preferencesRef.current = {};
      setPreferences({});
      setHasResolved(true);
      return {};
    } finally {
      if (
        refreshRequestIdRef.current === requestId &&
        latestUserIdRef.current === requestedUserId
      ) {
        setIsLoading(false);
      }
    }
  }, [apiBase, currentUserId]);

  useEffect(() => {
    if (!hasResolvedSession) {
      return;
    }
    if (!currentUserId) {
      refreshRequestIdRef.current += 1;
      lastLoadedUserIdRef.current = null;
      preferencesRef.current = {};
      setPreferences({});
      setHasResolved(true);
      setIsLoading(false);
      return;
    }
    if (lastLoadedUserIdRef.current && lastLoadedUserIdRef.current !== currentUserId) {
      preferencesRef.current = {};
      setPreferences({});
      setHasResolved(false);
    }
    if (hasResolved && lastLoadedUserIdRef.current === currentUserId) {
      setIsLoading(false);
      return;
    }
    if (isLoading && lastLoadedUserIdRef.current === currentUserId) {
      return;
    }
    lastLoadedUserIdRef.current = currentUserId;
    void refresh();
  }, [currentUserId, hasResolved, hasResolvedSession, isLoading, refresh]);

  const persistPreferences = useCallback(
    async (
      nextPreferences:
        | Record<string, unknown>
        | ((previous: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      const resolvedPreferences =
        typeof nextPreferences === "function"
          ? nextPreferences(preferencesRef.current)
          : nextPreferences;
      const normalizedPreferences = isRecord(resolvedPreferences) ? resolvedPreferences : {};
      preferencesRef.current = normalizedPreferences;
      setPreferences(normalizedPreferences);
      setHasResolved(true);

      if (!currentUserId) {
        return normalizedPreferences;
      }

      const response = await apiFetch(apiBase, "/api/me/preferences", {
        method: "PUT",
        auth: true,
        json: { preferences: normalizedPreferences },
      });
      if (!response.ok) {
        throw new Error("dashboard_preferences_save_failed");
      }
      const payload = (await response.json()) as { preferences?: Record<string, unknown> };
      const savedPreferences = isRecord(payload?.preferences)
        ? payload.preferences
        : normalizedPreferences;
      preferencesRef.current = savedPreferences;
      setPreferences(savedPreferences);
      return savedPreferences;
    },
    [apiBase, currentUserId],
  );

  const patchDashboardPreferences = useCallback(
    async (
      patch:
        | Record<string, unknown>
        | ((previous: DashboardPreferencesShape) => Record<string, unknown>),
    ) =>
      persistPreferences((previousPreferences) => {
        const previousDashboard = toDashboardPreferences(previousPreferences);
        const nextPatch = typeof patch === "function" ? patch(previousDashboard) : patch;
        return {
          ...previousPreferences,
          dashboard: {
            ...(isRecord(previousPreferences.dashboard) ? previousPreferences.dashboard : {}),
            ...(isRecord(nextPatch) ? nextPatch : {}),
          },
        };
      }),
    [persistPreferences],
  );

  const dashboardPreferences = useMemo(() => toDashboardPreferences(preferences), [preferences]);

  const value = useMemo(
    () => ({
      hasProvider: true,
      preferences,
      dashboardPreferences,
      isLoading,
      hasResolved,
      refresh,
      updatePreferences: persistPreferences,
      patchDashboardPreferences,
    }),
    [
      dashboardPreferences,
      hasResolved,
      isLoading,
      patchDashboardPreferences,
      persistPreferences,
      preferences,
      refresh,
    ],
  );

  return (
    <DashboardPreferencesContext.Provider value={value}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
};
