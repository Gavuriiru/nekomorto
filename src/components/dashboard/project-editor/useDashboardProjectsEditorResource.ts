import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiFetch } from "@/lib/api-client";
import {
  areDashboardSearchParamsEqual,
  buildDashboardSearchParams,
  parseDashboardEnumParam,
  parseDashboardPageParam,
} from "@/lib/dashboard-query-state";

import type {
  ProjectRecord,
} from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import { DEFAULT_PROJECT_FORMAT_OPTIONS } from "@/components/dashboard/project-editor/project-editor-constants";
import type { Dispatch, SetStateAction } from "react";

export const defaultFormatOptions = DEFAULT_PROJECT_FORMAT_OPTIONS;

type DashboardProjectsPageCacheEntry = {
  projects: ProjectRecord[];
  projectTypeOptions: string[];
  memberDirectory: string[];
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  staffRoleTranslations: Record<string, string>;
  expiresAt: number;
};

const PROJECTS_PAGE_CACHE_TTL_MS = 60_000;

let projectsPageCache: DashboardProjectsPageCacheEntry | null = null;

const cloneProjectsPageCache = (value: Omit<DashboardProjectsPageCacheEntry, "expiresAt">) => ({
  projects: JSON.parse(JSON.stringify(value.projects)) as ProjectRecord[],
  projectTypeOptions: [...value.projectTypeOptions],
  memberDirectory: [...value.memberDirectory],
  tagTranslations: { ...value.tagTranslations },
  genreTranslations: { ...value.genreTranslations },
  staffRoleTranslations: { ...value.staffRoleTranslations },
});

export const readProjectsPageCache = () => {
  if (!projectsPageCache) {
    return null;
  }
  if (projectsPageCache.expiresAt <= Date.now()) {
    projectsPageCache = null;
    return null;
  }
  return cloneProjectsPageCache(projectsPageCache);
};

export const writeProjectsPageCache = (value: Omit<DashboardProjectsPageCacheEntry, "expiresAt">) => {
  projectsPageCache = {
    ...cloneProjectsPageCache(value),
    expiresAt: Date.now() + PROJECTS_PAGE_CACHE_TTL_MS,
  };
};

export const clearProjectsPageCache = () => {
  projectsPageCache = null;
};

const parseTypeParam = (value: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Todos";
  }
  return normalized;
};

type SortMode = "alpha" | "status" | "views" | "comments" | "recent";
const SORT_MODES = ["alpha", "status", "views", "comments", "recent"] as const;

export type UseDashboardProjectsEditorResourceResult = {
  currentPage: number;
  genreTranslations: Record<string, string>;
  hasLoadError: boolean;
  hasLoadedOnce: boolean;
  hasResolvedMemberDirectory: boolean;
  hasResolvedProjectTypes: boolean;
  hasResolvedProjects: boolean;
  hasResolvedTranslations: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  memberDirectory: string[];
  projectTypeOptions: string[];
  projects: ProjectRecord[];
  refreshProjects: () => void;
  searchParams: ReturnType<typeof useSearchParams>[0];
  selectedType: string;
  setCurrentPage: (page: number) => void;
  setGenreTranslations: Dispatch<SetStateAction<Record<string, string>>>;
  setMemberDirectory: Dispatch<SetStateAction<string[]>>;
  setProjectTypeOptions: Dispatch<SetStateAction<string[]>>;
  setProjects: Dispatch<SetStateAction<ProjectRecord[]>>;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  setSelectedType: Dispatch<SetStateAction<string>>;
  setSortMode: Dispatch<SetStateAction<SortMode>>;
  setStaffRoleTranslations: Dispatch<SetStateAction<Record<string, string>>>;
  setTagTranslations: Dispatch<SetStateAction<Record<string, string>>>;
  sortMode: SortMode;
  staffRoleTranslations: Record<string, string>;
  tagTranslations: Record<string, string>;
};

export function useDashboardProjectsEditorResource(apiBase: string): UseDashboardProjectsEditorResourceResult {
  const initialCacheRef = useRef(readProjectsPageCache());
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectRecord[]>(
    initialCacheRef.current?.projects ?? [],
  );
  const [projectTypeOptions, setProjectTypeOptions] = useState<string[]>(
    initialCacheRef.current?.projectTypeOptions ?? defaultFormatOptions,
  );
  const [memberDirectory, setMemberDirectory] = useState<string[]>(
    initialCacheRef.current?.memberDirectory ?? [],
  );
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.tagTranslations ?? {},
  );
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.genreTranslations ?? {},
  );
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.staffRoleTranslations ?? {},
  );
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedProjects, setHasResolvedProjects] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedProjectTypes, setHasResolvedProjectTypes] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedMemberDirectory, setHasResolvedMemberDirectory] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedTranslations, setHasResolvedTranslations] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    return parseDashboardEnumParam(searchParams.get("sort"), SORT_MODES, "alpha");
  });
  const [currentPage, setCurrentPage] = useState(() =>
    parseDashboardPageParam(searchParams.get("page")),
  );
  const [selectedType, setSelectedType] = useState(() => parseTypeParam(searchParams.get("type")));
  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const isApplyingSearchParamsRef = useRef(false);
  const queryStateRef = useRef({
    sortMode,
    currentPage,
    selectedType,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    queryStateRef.current = {
      sortMode,
      currentPage,
      selectedType,
    };
  }, [currentPage, selectedType, sortMode]);

  useEffect(() => {
    const nextSort = parseDashboardEnumParam(searchParams.get("sort"), SORT_MODES, "alpha");
    const nextPage = parseDashboardPageParam(searchParams.get("page"));
    const nextType = parseTypeParam(searchParams.get("type"));
    const {
      sortMode: currentSortMode,
      currentPage: currentCurrentPage,
      selectedType: currentSelectedType,
    } = queryStateRef.current;
    const shouldApply =
      currentSortMode !== nextSort ||
      currentCurrentPage !== nextPage ||
      currentSelectedType !== nextType;
    if (!shouldApply) {
      return;
    }
    isApplyingSearchParamsRef.current = true;
    setSortMode((prev) => (prev === nextSort ? prev : nextSort));
    setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
    setSelectedType((prev) => (prev === nextType ? prev : nextType));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = buildDashboardSearchParams(searchParams, [
      { key: "sort", value: sortMode, fallbackValue: "alpha" },
      { key: "page", value: currentPage, fallbackValue: 1 },
      { key: "type", value: selectedType, fallbackValue: "Todos" },
    ]);
    if (isApplyingSearchParamsRef.current) {
      if (areDashboardSearchParamsEqual(nextParams, searchParams)) {
        isApplyingSearchParamsRef.current = false;
      }
      return;
    }
    if (!areDashboardSearchParamsEqual(nextParams, searchParams)) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [currentPage, searchParams, selectedType, setSearchParams, sortMode]);

  const refreshProjects = useCallback(() => {
    setLoadVersion((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const background = hasLoadedOnceRef.current;
      const cached = initialCacheRef.current;

      setHasLoadError(false);
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
        setHasResolvedProjects(false);
      }
      if (!cached) {
        setHasResolvedProjectTypes(false);
        setHasResolvedMemberDirectory(false);
        setHasResolvedTranslations(false);
      }

      try {
        const projectsResponse = await apiFetch(apiBase, "/api/projects", { auth: true });
        if (!projectsResponse.ok) {
          throw new Error("projects_load_failed");
        }
        const projectsData = await projectsResponse.json();
        const nextProjects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        setProjects(nextProjects);
        setHasResolvedProjects(true);
        setHasLoadedOnce(true);
        setHasLoadError(false);

        const projectTypesPromise = apiFetch(apiBase, "/api/project-types", {
          auth: true,
          cache: "no-store",
        });
        const usersPromise = apiFetch(apiBase, "/api/users", { auth: true });
        const translationsPromise = apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });

        const [projectTypesResult, usersResult, translationsResult] = await Promise.allSettled([
          projectTypesPromise,
          usersPromise,
          translationsPromise,
        ]);

        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        let nextProjectTypeOptions = defaultFormatOptions;
        if (projectTypesResult.status === "fulfilled" && projectTypesResult.value.ok) {
          const data = await projectTypesResult.value.json();
          const remoteTypes = Array.isArray(data?.types)
            ? data.types.map((item: unknown) => String(item || "").trim()).filter(Boolean)
            : [];
          const uniqueTypes = Array.from(new Set([...remoteTypes, ...defaultFormatOptions]));
          nextProjectTypeOptions = uniqueTypes.length > 0 ? uniqueTypes : defaultFormatOptions;
        }
        setProjectTypeOptions(nextProjectTypeOptions);
        setHasResolvedProjectTypes(true);

        let nextMemberDirectory: string[] = [];
        if (usersResult.status === "fulfilled" && usersResult.value.ok) {
          const data = (await usersResult.value.json()) as {
            users?: Array<{ name?: string; status?: string }>;
          };
          const names = Array.isArray(data.users)
            ? data.users
                .filter((user) => user.status === "active")
                .map((user) => user.name)
                .filter((name): name is string => Boolean(name))
            : [];
          nextMemberDirectory = Array.from(new Set(names)).sort((a, b) =>
            a.localeCompare(b, "pt-BR"),
          );
        }
        setMemberDirectory(nextMemberDirectory);
        setHasResolvedMemberDirectory(true);

        let nextTagTranslations: Record<string, string> = {};
        let nextGenreTranslations: Record<string, string> = {};
        let nextStaffRoleTranslations: Record<string, string> = {};
        if (translationsResult.status === "fulfilled" && translationsResult.value.ok) {
          const data = await translationsResult.value.json();
          nextTagTranslations = data?.tags || {};
          nextGenreTranslations = data?.genres || {};
          nextStaffRoleTranslations = data?.staffRoles || {};
        }
        setTagTranslations(nextTagTranslations);
        setGenreTranslations(nextGenreTranslations);
        setStaffRoleTranslations(nextStaffRoleTranslations);
        setHasResolvedTranslations(true);

        writeProjectsPageCache({
          projects: nextProjects,
          projectTypeOptions: nextProjectTypeOptions,
          memberDirectory: nextMemberDirectory,
          tagTranslations: nextTagTranslations,
          genreTranslations: nextGenreTranslations,
          staffRoleTranslations: nextStaffRoleTranslations,
        });
      } catch {
        if (isActive && requestIdRef.current === requestId) {
          if (!hasLoadedOnceRef.current) {
            setProjects([]);
            setProjectTypeOptions(defaultFormatOptions);
            setMemberDirectory([]);
            setTagTranslations({});
            setGenreTranslations({});
            setStaffRoleTranslations({});
            setHasResolvedProjectTypes(false);
            setHasResolvedMemberDirectory(false);
            setHasResolvedTranslations(false);
          }
          setHasLoadError(true);
        }
      } finally {
        if (isActive && requestIdRef.current === requestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
          if (cached) {
            setHasResolvedProjectTypes(true);
            setHasResolvedMemberDirectory(true);
            setHasResolvedTranslations(true);
          }
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, loadVersion]);

  return {
    currentPage,
    genreTranslations,
    hasLoadError,
    hasLoadedOnce,
    hasResolvedMemberDirectory,
    hasResolvedProjectTypes,
    hasResolvedProjects,
    hasResolvedTranslations,
    isInitialLoading,
    isRefreshing,
    memberDirectory,
    projectTypeOptions,
    projects,
    refreshProjects,
    searchParams,
    selectedType,
    setCurrentPage,
    setGenreTranslations,
    setMemberDirectory,
    setProjectTypeOptions,
    setProjects,
    setSearchParams,
    setSelectedType,
    setSortMode,
    setStaffRoleTranslations,
    setTagTranslations,
    sortMode,
    staffRoleTranslations,
    tagTranslations,
  };
}
