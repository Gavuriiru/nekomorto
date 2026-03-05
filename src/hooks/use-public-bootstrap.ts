import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  emptyPublicBootstrapPayload,
  type PublicBootstrapPayload,
} from "@/types/public-bootstrap";
import { normalizePublicPagesConfig } from "@/lib/public-pages";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import {
  asPublicBootstrapPayload,
  readWindowPublicBootstrap,
} from "@/lib/public-bootstrap-global";

const PUBLIC_BOOTSTRAP_STALE_TIME_MS = 60_000;

type PublicBootstrapStatus = "idle" | "loading" | "success" | "error";

type PublicBootstrapSnapshot = {
  data: PublicBootstrapPayload | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetched: boolean;
  status: PublicBootstrapStatus;
};

const initialWindowBootstrap = readWindowPublicBootstrap();

const publicBootstrapCache = {
  data: initialWindowBootstrap,
  error: null as Error | null,
  status: (initialWindowBootstrap ? "success" : "idle") as PublicBootstrapStatus,
  hasFetched: !!initialWindowBootstrap,
  lastFetchedAt: initialWindowBootstrap ? Date.now() : 0,
  inFlightPromise: null as Promise<PublicBootstrapPayload> | null,
};

const listeners = new Set<() => void>();

const toError = (value: unknown) =>
  value instanceof Error ? value : new Error(String(value || "public_bootstrap_error"));

const emitSnapshot = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const buildSnapshot = (): PublicBootstrapSnapshot => ({
  data: publicBootstrapCache.data || undefined,
  error: publicBootstrapCache.error,
  isLoading: publicBootstrapCache.status === "loading" && !publicBootstrapCache.data,
  isFetched: publicBootstrapCache.hasFetched,
  status: publicBootstrapCache.status,
});

const subscribeSnapshot = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const normalizePublicBootstrapPayload = (value: unknown): PublicBootstrapPayload => {
  const normalized = asPublicBootstrapPayload(value);
  if (normalized) {
    return normalized;
  }
  const data = value && typeof value === "object" ? (value as Partial<PublicBootstrapPayload>) : {};
  return {
    ...emptyPublicBootstrapPayload,
    ...data,
    settings: data?.settings || emptyPublicBootstrapPayload.settings,
    pages: normalizePublicPagesConfig(data?.pages),
    projects: Array.isArray(data?.projects) ? data.projects : [],
    posts: Array.isArray(data?.posts) ? data.posts : [],
    updates: Array.isArray(data?.updates) ? data.updates : [],
    mediaVariants:
      data?.mediaVariants && typeof data.mediaVariants === "object"
        ? (data.mediaVariants as UploadMediaVariantsMap)
        : {},
    tagTranslations: {
      tags: data?.tagTranslations?.tags || {},
      genres: data?.tagTranslations?.genres || {},
      staffRoles: data?.tagTranslations?.staffRoles || {},
    },
    generatedAt: String(data?.generatedAt || ""),
  };
};

const fetchPublicBootstrap = async (apiBase: string): Promise<PublicBootstrapPayload> => {
  const response = await apiFetch(apiBase, "/api/public/bootstrap");
  if (!response.ok) {
    throw new Error(`public_bootstrap_${response.status}`);
  }
  return normalizePublicBootstrapPayload(await response.json());
};

const shouldFetchPublicBootstrap = (force = false) => {
  if (force) {
    return true;
  }
  if (publicBootstrapCache.inFlightPromise) {
    return false;
  }
  if (!publicBootstrapCache.data) {
    return true;
  }
  return Date.now() - publicBootstrapCache.lastFetchedAt > PUBLIC_BOOTSTRAP_STALE_TIME_MS;
};

const requestPublicBootstrap = async (
  apiBase: string,
  options: { force?: boolean } = {},
) => {
  const force = options.force === true;
  if (publicBootstrapCache.inFlightPromise) {
    return publicBootstrapCache.inFlightPromise;
  }
  if (!shouldFetchPublicBootstrap(force)) {
    return publicBootstrapCache.data || emptyPublicBootstrapPayload;
  }

  publicBootstrapCache.status = "loading";
  publicBootstrapCache.error = null;
  emitSnapshot();

  const requestPromise = fetchPublicBootstrap(apiBase)
    .then((data) => {
      publicBootstrapCache.data = data;
      publicBootstrapCache.error = null;
      publicBootstrapCache.status = "success";
      publicBootstrapCache.hasFetched = true;
      publicBootstrapCache.lastFetchedAt = Date.now();
      emitSnapshot();
      return data;
    })
    .catch((error) => {
      const normalizedError = toError(error);
      publicBootstrapCache.error = normalizedError;
      publicBootstrapCache.status = "error";
      publicBootstrapCache.hasFetched = true;
      emitSnapshot();
      throw normalizedError;
    })
    .finally(() => {
      publicBootstrapCache.inFlightPromise = null;
    });

  publicBootstrapCache.inFlightPromise = requestPromise;
  return requestPromise;
};

export const primePublicBootstrapCache = (value: unknown) => {
  const payload = asPublicBootstrapPayload(value);
  if (!payload) {
    return false;
  }
  publicBootstrapCache.data = payload;
  publicBootstrapCache.error = null;
  publicBootstrapCache.status = "success";
  publicBootstrapCache.hasFetched = true;
  publicBootstrapCache.lastFetchedAt = Date.now();
  emitSnapshot();
  return true;
};

export const usePublicBootstrap = () => {
  const apiBase = getApiBase();
  const [snapshot, setSnapshot] = useState<PublicBootstrapSnapshot>(() => buildSnapshot());

  useEffect(() => subscribeSnapshot(() => setSnapshot(buildSnapshot())), []);

  useEffect(() => {
    if (!shouldFetchPublicBootstrap()) {
      return;
    }
    void requestPublicBootstrap(apiBase).catch(() => undefined);
  }, [apiBase]);

  const refetch = useCallback(
    () => requestPublicBootstrap(apiBase, { force: true }),
    [apiBase],
  );

  return {
    ...snapshot,
    refetch,
  };
};
