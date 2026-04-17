import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardSessionUser } from "@/hooks/dashboard-session-context";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrapCurrentUser } from "@/lib/public-bootstrap-global";

type UseDashboardCurrentUserOptions = {
  revalidateBootstrap?: boolean;
};

const resolveDashboardCurrentUser = <TUser extends DashboardSessionUser>(
  value: unknown,
): TUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate =
    "user" in (value as Record<string, unknown>) ? (value as { user?: unknown }).user : value;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const id = String((candidate as { id?: unknown }).id || "").trim();
  if (!id) {
    return null;
  }
  return candidate as TUser;
};

export const useDashboardCurrentUser = <TUser extends DashboardSessionUser = DashboardSessionUser>(
  options?: UseDashboardCurrentUserOptions,
) => {
  const { revalidateBootstrap = true } = options || {};
  const apiBase = getApiBase();
  const dashboardSession = useDashboardSession();
  const [bootstrapUser] = useState<TUser | null>(() =>
    dashboardSession.hasProvider
      ? (dashboardSession.currentUser as TUser | null)
      : (readWindowPublicBootstrapCurrentUser() as TUser | null),
  );
  const [fallbackCurrentUser, setFallbackCurrentUser] = useState<TUser | null>(() => bootstrapUser);
  const [isLoadingFallbackUser, setIsLoadingFallbackUser] = useState(
    () => !bootstrapUser || revalidateBootstrap,
  );
  const hasAutoRefreshRunRef = useRef(false);

  const setCurrentUser = useCallback(
    (nextUser: TUser | null | ((previous: TUser | null) => TUser | null)) => {
      if (dashboardSession.hasProvider) {
        const resolvedUser =
          typeof nextUser === "function"
            ? nextUser(dashboardSession.currentUser as TUser | null)
            : nextUser;
        dashboardSession.setCurrentUser(resolvedUser);
        return;
      }
      setFallbackCurrentUser((previous) =>
        typeof nextUser === "function" ? nextUser(previous) : nextUser,
      );
    },
    [dashboardSession],
  );

  const refreshCurrentUser = useCallback(async () => {
    if (dashboardSession.hasProvider) {
      return (await dashboardSession.refresh()) as TUser | null;
    }
    setIsLoadingFallbackUser(true);
    try {
      const response = await apiFetch(apiBase, "/api/me", { auth: true, cache: "no-store" });
      if (!response.ok) {
        setFallbackCurrentUser(null);
        return null;
      }
      const payload = await response.json();
      const nextUser = resolveDashboardCurrentUser<TUser>(payload);
      setFallbackCurrentUser(nextUser);
      return nextUser;
    } catch {
      setFallbackCurrentUser(null);
      return null;
    } finally {
      setIsLoadingFallbackUser(false);
    }
  }, [apiBase, dashboardSession]);

  useEffect(() => {
    if (dashboardSession.hasProvider) {
      return;
    }
    if (bootstrapUser && !revalidateBootstrap) {
      setFallbackCurrentUser(bootstrapUser);
      setIsLoadingFallbackUser(false);
      return;
    }
    if (hasAutoRefreshRunRef.current) {
      return;
    }
    hasAutoRefreshRunRef.current = true;
    void refreshCurrentUser();
  }, [bootstrapUser, dashboardSession.hasProvider, refreshCurrentUser, revalidateBootstrap]);

  return {
    currentUser: dashboardSession.hasProvider
      ? (dashboardSession.currentUser as TUser | null)
      : fallbackCurrentUser,
    isLoadingUser: dashboardSession.hasProvider
      ? dashboardSession.isLoading
      : isLoadingFallbackUser,
    refreshCurrentUser,
    setCurrentUser,
  };
};
