import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { scheduleOnBrowserLoadIdle } from "@/lib/browser-idle";
import {
  asPublicBootstrapCurrentUser,
  readWindowPublicBootstrapCurrentUser,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";

type PublicCurrentUserStatus = "idle" | "loading" | "success" | "error";

type PublicCurrentUserSnapshot = {
  currentUser: PublicBootstrapCurrentUser | null;
  error: Error | null;
  hasResolved: boolean;
  isRefreshing: boolean;
  status: PublicCurrentUserStatus;
};

type PublicCurrentUserCache = {
  currentUser: PublicBootstrapCurrentUser | null;
  error: Error | null;
  hasFetched: boolean;
  inFlightPromise: Promise<PublicBootstrapCurrentUser | null> | null;
  status: PublicCurrentUserStatus;
};

const listeners = new Set<() => void>();

const createPublicCurrentUserCache = (): PublicCurrentUserCache => {
  const bootstrapUser = readWindowPublicBootstrapCurrentUser();
  return {
    currentUser: bootstrapUser,
    error: null,
    hasFetched: false,
    inFlightPromise: null,
    status: bootstrapUser ? "success" : "idle",
  };
};

let publicCurrentUserCache = createPublicCurrentUserCache();

const toError = (value: unknown) =>
  value instanceof Error ? value : new Error(String(value || "public_current_user_error"));

const emitSnapshot = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const syncCacheFromBootstrapWhenIdle = () => {
  if (listeners.size > 0 || publicCurrentUserCache.inFlightPromise) {
    return;
  }
  publicCurrentUserCache = createPublicCurrentUserCache();
};

const buildSnapshot = (): PublicCurrentUserSnapshot => {
  syncCacheFromBootstrapWhenIdle();
  return {
    currentUser: publicCurrentUserCache.currentUser,
    error: publicCurrentUserCache.error,
    hasResolved: Boolean(publicCurrentUserCache.currentUser) || publicCurrentUserCache.hasFetched,
    isRefreshing: publicCurrentUserCache.status === "loading",
    status: publicCurrentUserCache.status,
  };
};

const subscribeSnapshot = (listener: () => void) => {
  syncCacheFromBootstrapWhenIdle();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const fetchPublicCurrentUser = async (apiBase: string) => {
  const response = await apiFetch(apiBase, "/api/public/me", {
    auth: true,
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  return asPublicBootstrapCurrentUser(payload?.user ?? payload);
};

const shouldFetchPublicCurrentUser = (force = false) => {
  if (force) {
    return true;
  }
  if (publicCurrentUserCache.inFlightPromise) {
    return false;
  }
  return !publicCurrentUserCache.hasFetched;
};

const requestPublicCurrentUser = async (apiBase: string, options: { force?: boolean } = {}) => {
  const force = options.force === true;
  if (publicCurrentUserCache.inFlightPromise) {
    return publicCurrentUserCache.inFlightPromise;
  }
  if (!shouldFetchPublicCurrentUser(force)) {
    return publicCurrentUserCache.currentUser;
  }

  publicCurrentUserCache.status = "loading";
  publicCurrentUserCache.error = null;
  emitSnapshot();

  const requestPromise = fetchPublicCurrentUser(apiBase)
    .then((currentUser) => {
      publicCurrentUserCache.currentUser = currentUser;
      publicCurrentUserCache.error = null;
      publicCurrentUserCache.status = "success";
      publicCurrentUserCache.hasFetched = true;
      emitSnapshot();
      return currentUser;
    })
    .catch((error) => {
      publicCurrentUserCache.error = toError(error);
      publicCurrentUserCache.status = "error";
      publicCurrentUserCache.hasFetched = true;
      emitSnapshot();
      return publicCurrentUserCache.currentUser;
    })
    .finally(() => {
      publicCurrentUserCache.inFlightPromise = null;
    });

  publicCurrentUserCache.inFlightPromise = requestPromise;
  return requestPromise;
};

export const usePublicCurrentUser = () => {
  const apiBase = getApiBase();
  const [snapshot, setSnapshot] = useState<PublicCurrentUserSnapshot>(() => buildSnapshot());

  useEffect(() => subscribeSnapshot(() => setSnapshot(buildSnapshot())), []);

  useEffect(() => {
    if (!shouldFetchPublicCurrentUser()) {
      return;
    }
    if (!publicCurrentUserCache.currentUser) {
      void requestPublicCurrentUser(apiBase);
      return;
    }
    const cancelIdle = scheduleOnBrowserLoadIdle(
      () => {
        void requestPublicCurrentUser(apiBase);
      },
      { delayMs: 2500 },
    );
    return cancelIdle;
  }, [apiBase]);

  const refresh = useCallback(
    async (options?: { force?: boolean }) =>
      await requestPublicCurrentUser(apiBase, { force: options?.force === true }),
    [apiBase],
  );

  return {
    ...snapshot,
    refresh,
  };
};
