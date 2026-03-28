import { useCallback, useEffect, useRef, useState } from "react";
import {
  DASHBOARD_SETTINGS_DEFAULT_TAB,
  isDashboardSettingsTab,
  parseDashboardSettingsTabParam,
  type SettingsTabKey,
} from "./shared";

type UseDashboardSettingsQuerySyncOptions = {
  location: { pathname: string; hash: string };
  navigate: (to: string, options?: { replace?: boolean }) => void;
  searchParams: URLSearchParams;
  hasResolvedSettings: boolean;
};

const buildDashboardSettingsTabSearchParams = (
  currentParams: URLSearchParams,
  tab: SettingsTabKey,
) => {
  const nextParams = new URLSearchParams(currentParams);
  if (tab === DASHBOARD_SETTINGS_DEFAULT_TAB) {
    nextParams.delete("tab");
  } else {
    nextParams.set("tab", tab);
  }
  return nextParams;
};

export const useDashboardSettingsQuerySync = ({
  location,
  navigate,
  searchParams,
  hasResolvedSettings,
}: UseDashboardSettingsQuerySyncOptions) => {
  const [activeTab, setActiveTabState] = useState<SettingsTabKey>(() =>
    parseDashboardSettingsTabParam(searchParams.get("tab")),
  );
  const tabUrlSyncTimeoutRef = useRef<number | null>(null);

  const clearPendingTabUrlSync = useCallback(() => {
    if (tabUrlSyncTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(tabUrlSyncTimeoutRef.current);
    tabUrlSyncTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes")) {
      return;
    }
    const rawTab = String(searchParams.get("tab") || "").trim();
    if (rawTab !== "preview-paginas") {
      return;
    }
    navigate("/dashboard/paginas?tab=preview", { replace: true });
  }, [location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes") || !hasResolvedSettings) {
      return;
    }
    clearPendingTabUrlSync();
    const requestedTab = parseDashboardSettingsTabParam(searchParams.get("tab"));
    setActiveTabState((previous) => (previous === requestedTab ? previous : requestedTab));
    const nextParams = buildDashboardSettingsTabSearchParams(searchParams, requestedTab);
    const nextSearch = nextParams.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [clearPendingTabUrlSync, hasResolvedSettings, location.hash, location.pathname, searchParams]);

  const setActiveTab = useCallback(
    (value: string) => {
      if (!isDashboardSettingsTab(value)) {
        return;
      }
      setActiveTabState((previous) => (previous === value ? previous : value));
      clearPendingTabUrlSync();
      const nextParams = buildDashboardSettingsTabSearchParams(
        new URLSearchParams(window.location.search),
        value,
      );
      const nextSearch = nextParams.toString();
      const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl === currentUrl) {
        return;
      }
      tabUrlSyncTimeoutRef.current = window.setTimeout(() => {
        window.history.replaceState(window.history.state, "", nextUrl);
        tabUrlSyncTimeoutRef.current = null;
      }, 0);
    },
    [clearPendingTabUrlSync, location.hash, location.pathname],
  );

  useEffect(() => clearPendingTabUrlSync, [clearPendingTabUrlSync]);

  return {
    activeTab,
    setActiveTab,
  };
};
