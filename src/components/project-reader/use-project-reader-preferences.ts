import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  getProjectReaderPreferenceByType,
  mergeProjectReaderConfig,
  normalizeProjectReaderConfig,
  normalizeProjectReaderPreferences,
  normalizeProjectReaderTypeKey,
} from "../../../shared/project-reader.js";

const READER_PREFERENCES_STORAGE_KEY = "public.reader.preferences";

export type ProjectReaderPreferencesState = {
  isLoaded: boolean;
  resolvedConfig: Record<string, unknown> & {
    siteHeaderVariant?: "static" | "fixed";
  };
  updateConfig: (
    nextConfig:
      | Record<string, unknown>
      | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => Promise<Record<string, unknown>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readVisitorPreferencesRoot = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(READER_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeVisitorPreferencesRoot = (value: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(READER_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures.
  }
};

const getReaderNamespace = (value: Record<string, unknown>) =>
  normalizeProjectReaderPreferences(isRecord(value.reader) ? value.reader : {});

const toStoredReaderPreference = (value: Record<string, unknown>, projectType: string) => {
  const normalized = normalizeProjectReaderConfig(value, { projectType });
  return {
    direction: normalized.direction,
    layout: normalized.layout,
    imageFit: normalized.imageFit,
    background: normalized.background,
    progressStyle: normalized.progressStyle,
    progressPosition: normalized.progressPosition,
    firstPageSingle: normalized.firstPageSingle,
    siteHeaderVariant: normalized.siteHeaderVariant,
  };
};

const setReaderPreferenceOnRoot = ({
  root,
  projectType,
  config,
}: {
  root: Record<string, unknown>;
  projectType: string;
  config: Record<string, unknown>;
}) => {
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  if (typeKey === "default") {
    return root;
  }

  const reader = getReaderNamespace(root);
  const projectTypes = isRecord(reader.projectTypes)
    ? { ...(reader.projectTypes as Record<string, unknown>) }
    : {};

  projectTypes[typeKey] = toStoredReaderPreference(config, typeKey);

  return {
    ...root,
    reader: {
      projectTypes,
    },
  };
};

export const useProjectReaderPreferences = ({
  projectType,
  baseConfig,
  currentUserId,
}: {
  projectType: string;
  baseConfig: Record<string, unknown>;
  currentUserId?: string | null;
}) => {
  const apiBase = getApiBase();
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  const normalizedBaseConfig = useMemo(
    () => normalizeProjectReaderConfig(baseConfig, { projectType }),
    [baseConfig, projectType],
  );
  const [preferencesRoot, setPreferencesRoot] = useState<Record<string, unknown>>({});
  const [isLoaded, setIsLoaded] = useState(typeKey === "default");
  const rootRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    rootRef.current = preferencesRoot;
  }, [preferencesRoot]);

  useEffect(() => {
    let isActive = true;

    if (typeKey === "default") {
      rootRef.current = {};
      setPreferencesRoot({});
      setIsLoaded(true);
      return () => {
        isActive = false;
      };
    }

    const loadPreferences = async () => {
      setIsLoaded(false);

      if (!currentUserId) {
        const nextRoot = readVisitorPreferencesRoot();
        if (!isActive) {
          return;
        }
        rootRef.current = nextRoot;
        setPreferencesRoot(nextRoot);
        setIsLoaded(true);
        return;
      }

      try {
        const response = await apiFetch(apiBase, "/api/me/preferences", {
          auth: true,
          cache: "no-store",
        });
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          rootRef.current = {};
          setPreferencesRoot({});
          setIsLoaded(true);
          return;
        }
        const payload = (await response.json()) as { preferences?: Record<string, unknown> };
        const nextRoot = isRecord(payload?.preferences) ? payload.preferences : {};
        rootRef.current = nextRoot;
        setPreferencesRoot(nextRoot);
        setIsLoaded(true);
      } catch {
        if (!isActive) {
          return;
        }
        rootRef.current = {};
        setPreferencesRoot({});
        setIsLoaded(true);
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, [apiBase, currentUserId, typeKey]);

  const storedPreference = useMemo(
    () => getProjectReaderPreferenceByType(getReaderNamespace(preferencesRoot), projectType),
    [preferencesRoot, projectType],
  );

  const resolvedConfig = useMemo(
    () =>
      storedPreference
        ? mergeProjectReaderConfig(normalizedBaseConfig, storedPreference, { projectType })
        : normalizedBaseConfig,
    [normalizedBaseConfig, projectType, storedPreference],
  );

  const updateConfig = useCallback(
    async (
      nextConfig:
        | Record<string, unknown>
        | ((current: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      if (typeKey === "default") {
        return normalizedBaseConfig;
      }

      const configInput =
        typeof nextConfig === "function" ? nextConfig(resolvedConfig) : nextConfig;
      const normalizedConfig = mergeProjectReaderConfig(resolvedConfig, configInput, {
        projectType,
      });
      const nextRoot = setReaderPreferenceOnRoot({
        root: rootRef.current,
        projectType,
        config: normalizedConfig,
      });

      rootRef.current = nextRoot;
      setPreferencesRoot(nextRoot);

      if (!currentUserId) {
        writeVisitorPreferencesRoot(nextRoot);
        return normalizedConfig;
      }

      try {
        const response = await apiFetch(apiBase, "/api/me/preferences", {
          method: "PUT",
          auth: true,
          json: { preferences: nextRoot },
        });
        if (!response.ok) {
          return normalizedConfig;
        }
        const payload = (await response.json()) as { preferences?: Record<string, unknown> };
        const savedRoot = isRecord(payload?.preferences) ? payload.preferences : nextRoot;
        rootRef.current = savedRoot;
        setPreferencesRoot(savedRoot);
      } catch {
        // Keep the optimistic state if the request fails.
      }

      return normalizedConfig;
    },
    [apiBase, currentUserId, normalizedBaseConfig, projectType, resolvedConfig, typeKey],
  );

  const value: ProjectReaderPreferencesState = {
    isLoaded,
    resolvedConfig,
    updateConfig,
  };

  return value;
};
