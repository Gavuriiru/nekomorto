import {
  DashboardSessionContext,
  type DashboardSessionUser,
} from "@/hooks/dashboard-session-context";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrapCurrentUser } from "@/lib/public-bootstrap-global";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

export const DashboardSessionProvider = ({ children }: { children: ReactNode }) => {
  const apiBase = getApiBase();
  const [bootstrapUser] = useState<DashboardSessionUser | null>(
    () => readWindowPublicBootstrapCurrentUser() as DashboardSessionUser | null,
  );
  const [currentUser, setCurrentUser] = useState<DashboardSessionUser | null>(bootstrapUser);
  const [isLoading, setIsLoading] = useState(!bootstrapUser);
  const [hasResolved, setHasResolved] = useState(Boolean(bootstrapUser));

  const refresh = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true, cache: "no-store" });
        if (!response.ok) {
          setCurrentUser(null);
          setHasResolved(true);
          return null;
        }
        const nextUser = (await response.json()) as DashboardSessionUser;
        setCurrentUser(nextUser);
        setHasResolved(true);
        return nextUser;
      } catch {
        setCurrentUser(null);
        setHasResolved(true);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    void refresh({ background: Boolean(bootstrapUser) });
  }, [bootstrapUser, refresh]);

  const value = useMemo(
    () => ({
      hasProvider: true,
      currentUser,
      isLoading,
      hasResolved,
      refresh,
      setCurrentUser,
    }),
    [currentUser, hasResolved, isLoading, refresh],
  );

  return (
    <DashboardSessionContext.Provider value={value}>{children}</DashboardSessionContext.Provider>
  );
};
