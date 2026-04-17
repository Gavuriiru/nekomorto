import {
  getPublicBootstrapLastFetchedAt,
  refetchPublicBootstrapCache,
} from "@/hooks/use-public-bootstrap";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  getBuildFingerprint,
  getFrontendBuildMetadata,
  normalizeBuildMetadata,
} from "@/lib/frontend-build";
import type { ApiContractBuildMetadata } from "@/types/api-contract";

const PUBLIC_BUILD_RELOAD_SENTINEL_KEY = "nekomata:public-build-reloaded";
const DASHBOARD_PATH_PATTERN = /^\/dashboard(?:[/?]|$)/;

export const PUBLIC_FRESHNESS_CHECK_INTERVAL_MS = 30_000;
export const PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS = 15_000;

const normalizePathname = (value: unknown) =>
  String(value || "/")
    .trim()
    .split(/[?#]/, 1)[0] || "/";

const isDashboardPath = (pathname: unknown) =>
  DASHBOARD_PATH_PATTERN.test(normalizePathname(pathname));

const readReloadFingerprint = (storage?: Pick<Storage, "getItem"> | null) => {
  try {
    return String(storage?.getItem(PUBLIC_BUILD_RELOAD_SENTINEL_KEY) || "").trim();
  } catch {
    return "";
  }
};

const writeReloadFingerprint = (fingerprint: string, storage?: Pick<Storage, "setItem"> | null) => {
  try {
    storage?.setItem(PUBLIC_BUILD_RELOAD_SENTINEL_KEY, fingerprint);
  } catch {
    // Ignore session storage failures and continue without the sentinel.
  }
};

const shouldSkipBootstrapRefresh = (globalWindow?: Window & typeof globalThis) =>
  (globalWindow as (Window & { __BOOTSTRAP_SKIP_PUBLIC_FETCH__?: unknown }) | undefined)
    ?.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ === true;

export const fetchBackendBuildMetadata = async (apiBase = getApiBase()) => {
  const response = await apiFetch(apiBase, "/api/version", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`api_version_${response.status}`);
  }

  const payload = (await response.json()) as {
    build?: Partial<ApiContractBuildMetadata> | null;
  };
  return normalizeBuildMetadata(payload?.build);
};

export const shouldReloadForBuildMismatch = ({
  backendBuild,
  frontendBuild,
  sessionStorage,
}: {
  backendBuild: Partial<ApiContractBuildMetadata> | null | undefined;
  frontendBuild: Partial<ApiContractBuildMetadata> | null | undefined;
  sessionStorage?: Pick<Storage, "getItem" | "setItem"> | null;
}) => {
  const backendFingerprint = getBuildFingerprint(backendBuild);
  const frontendFingerprint = getBuildFingerprint(frontendBuild);

  if (!backendFingerprint || !frontendFingerprint || backendFingerprint === frontendFingerprint) {
    return false;
  }

  if (readReloadFingerprint(sessionStorage) === backendFingerprint) {
    return false;
  }

  writeReloadFingerprint(backendFingerprint, sessionStorage);
  return true;
};

export const startPublicFreshnessCoordinator = ({
  globalWindow = window,
  apiBase = getApiBase(),
  intervalMs = PUBLIC_FRESHNESS_CHECK_INTERVAL_MS,
  revalidateAfterMs = PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS,
  sessionStorage = globalWindow.sessionStorage,
  fetchBuildMetadata = () => fetchBackendBuildMetadata(apiBase),
  getFrontendBuild = () => getFrontendBuildMetadata(),
  getBootstrapLastFetchedAt = () => getPublicBootstrapLastFetchedAt(),
  refetchBootstrap = () => refetchPublicBootstrapCache(apiBase),
  reloadPage = () => {
    globalWindow.location.reload();
  },
}: {
  globalWindow?: Window & typeof globalThis;
  apiBase?: string;
  intervalMs?: number;
  revalidateAfterMs?: number;
  sessionStorage?: Pick<Storage, "getItem" | "setItem"> | null;
  fetchBuildMetadata?: () => Promise<ApiContractBuildMetadata>;
  getFrontendBuild?: () => ApiContractBuildMetadata;
  getBootstrapLastFetchedAt?: () => number;
  refetchBootstrap?: () => Promise<unknown>;
  reloadPage?: () => void;
} = {}) => {
  const pathname = globalWindow.location?.pathname || "/";
  if (isDashboardPath(pathname)) {
    return () => undefined;
  }

  const documentRef = globalWindow.document;
  let intervalId: number | null = null;
  let inFlightCheck: Promise<void> | null = null;

  const stopInterval = () => {
    if (intervalId !== null) {
      globalWindow.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const isVisible = () => documentRef.visibilityState !== "hidden";

  const runCheck = () => {
    if (inFlightCheck) {
      return inFlightCheck;
    }

    inFlightCheck = (async () => {
      let backendBuild: ApiContractBuildMetadata | null = null;
      try {
        backendBuild = await fetchBuildMetadata();
      } catch {
        backendBuild = null;
      }

      if (
        backendBuild &&
        shouldReloadForBuildMismatch({
          backendBuild,
          frontendBuild: getFrontendBuild(),
          sessionStorage,
        })
      ) {
        reloadPage();
        return;
      }

      if (shouldSkipBootstrapRefresh(globalWindow)) {
        return;
      }

      const lastFetchedAt = Number(getBootstrapLastFetchedAt() || 0);
      if (lastFetchedAt > 0 && Date.now() - lastFetchedAt < revalidateAfterMs) {
        return;
      }

      try {
        await refetchBootstrap();
      } catch {
        // Keep the current public payload when background revalidation fails.
      }
    })().finally(() => {
      inFlightCheck = null;
    });

    return inFlightCheck;
  };

  const ensureInterval = () => {
    if (intervalId !== null || !isVisible()) {
      return;
    }

    intervalId = globalWindow.setInterval(() => {
      if (!isVisible()) {
        stopInterval();
        return;
      }

      void runCheck();
    }, intervalMs);
  };

  const handleVisibilityChange = () => {
    if (!isVisible()) {
      stopInterval();
      return;
    }

    ensureInterval();
    void runCheck();
  };

  const handleWindowWake = () => {
    if (!isVisible()) {
      return;
    }

    void runCheck();
  };

  documentRef.addEventListener("visibilitychange", handleVisibilityChange);
  globalWindow.addEventListener("focus", handleWindowWake);
  globalWindow.addEventListener("online", handleWindowWake);

  if (isVisible()) {
    ensureInterval();
    void runCheck();
  }

  return () => {
    stopInterval();
    documentRef.removeEventListener("visibilitychange", handleVisibilityChange);
    globalWindow.removeEventListener("focus", handleWindowWake);
    globalWindow.removeEventListener("online", handleWindowWake);
  };
};
