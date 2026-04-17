import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PostRecord,
  UserRecord,
} from "@/components/dashboard/post-editor/dashboard-posts-types";
import type { Project } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

const POSTS_CACHE_TTL_MS = 60_000;
export const DASHBOARD_POST_SORT_MODES = [
  "recent",
  "alpha",
  "tags",
  "projects",
  "status",
  "views",
  "comments",
] as const;

export type DashboardPostsSortMode = (typeof DASHBOARD_POST_SORT_MODES)[number];

type PostsPageCacheEntry = {
  posts: PostRecord[];
  mediaVariants: UploadMediaVariantsMap;
  users: UserRecord[];
  ownerIds: string[];
  projects: Project[];
  tagTranslations: Record<string, string>;
  expiresAt: number;
};

let postsPageCache: PostsPageCacheEntry | null = null;

const clonePostsCacheEntry = (value: Omit<PostsPageCacheEntry, "expiresAt">) => ({
  posts: value.posts.map((post) => ({
    ...post,
    tags: Array.isArray(post.tags) ? [...post.tags] : [],
  })),
  mediaVariants: { ...value.mediaVariants },
  users: value.users.map((user) => ({
    ...user,
    permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
  })),
  ownerIds: [...value.ownerIds],
  projects: value.projects.map((project) => ({
    ...project,
  })),
  tagTranslations: { ...value.tagTranslations },
});

export const readPostsPageCache = () => {
  if (!postsPageCache) {
    return null;
  }
  if (postsPageCache.expiresAt <= Date.now()) {
    postsPageCache = null;
    return null;
  }
  return clonePostsCacheEntry(postsPageCache);
};

export const writePostsPageCache = (value: Omit<PostsPageCacheEntry, "expiresAt">) => {
  postsPageCache = {
    ...clonePostsCacheEntry(value),
    expiresAt: Date.now() + POSTS_CACHE_TTL_MS,
  };
};

export const clearPostsPageCache = () => {
  postsPageCache = null;
};

type UseDashboardPostsResourceResult = {
  hasLoadError: boolean;
  hasLoadedOnce: boolean;
  hasResolvedPosts: boolean;
  hasResolvedProjects: boolean;
  hasResolvedTagTranslations: boolean;
  hasResolvedUsers: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadPosts: () => Promise<void>;
  mediaVariants: UploadMediaVariantsMap;
  ownerIds: string[];
  posts: PostRecord[];
  projects: Project[];
  refreshPosts: () => void;
  setMediaVariants: Dispatch<SetStateAction<UploadMediaVariantsMap>>;
  setPosts: Dispatch<SetStateAction<PostRecord[]>>;
  setProjects: Dispatch<SetStateAction<Project[]>>;
  setTagTranslations: Dispatch<SetStateAction<Record<string, string>>>;
  tagTranslations: Record<string, string>;
  users: UserRecord[];
};

export function useDashboardPostsResource(apiBase: string): UseDashboardPostsResourceResult {
  const initialCacheRef = useRef(readPostsPageCache());
  const [posts, setPosts] = useState<PostRecord[]>(initialCacheRef.current?.posts ?? []);
  const [mediaVariants, setMediaVariants] = useState<UploadMediaVariantsMap>(
    initialCacheRef.current?.mediaVariants ?? {},
  );
  const [projects, setProjects] = useState<Project[]>(initialCacheRef.current?.projects ?? []);
  const [users, setUsers] = useState<UserRecord[]>(initialCacheRef.current?.users ?? []);
  const [ownerIds, setOwnerIds] = useState<string[]>(initialCacheRef.current?.ownerIds ?? []);
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedPosts, setHasResolvedPosts] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedProjects, setHasResolvedProjects] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedUsers, setHasResolvedUsers] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedTagTranslations, setHasResolvedTagTranslations] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.tagTranslations ?? {},
  );

  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const usersRef = useRef(users);
  const ownerIdsRef = useRef(ownerIds);
  const projectsRef = useRef(projects);
  const tagTranslationsRef = useRef(tagTranslations);
  const requestIdRef = useRef(0);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    ownerIdsRef.current = ownerIds;
  }, [ownerIds]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    tagTranslationsRef.current = tagTranslations;
  }, [tagTranslations]);

  const loadPosts = useCallback(async () => {
    const response = await apiFetch(apiBase, "/api/posts", { auth: true });
    if (!response.ok) {
      throw new Error("posts_load_failed");
    }
    const data = await response.json();
    const nextPosts = Array.isArray(data.posts) ? data.posts : [];
    const nextMediaVariants =
      data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {};
    setMediaVariants(nextMediaVariants);
    setPosts(nextPosts);
    setHasResolvedPosts(true);
    setHasLoadedOnce(true);
    setHasLoadError(false);
    writePostsPageCache({
      posts: nextPosts,
      mediaVariants: nextMediaVariants,
      users: usersRef.current,
      ownerIds: ownerIdsRef.current,
      projects: projectsRef.current,
      tagTranslations: tagTranslationsRef.current,
    });
  }, [apiBase]);

  const refreshPosts = useCallback(() => {
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
        setHasResolvedPosts(false);
      }
      if (!cached) {
        setHasResolvedUsers(false);
        setHasResolvedProjects(false);
        setHasResolvedTagTranslations(false);
      }

      const postsPromise = apiFetch(apiBase, "/api/posts", { auth: true });
      const usersPromise = apiFetch(apiBase, "/api/users", { auth: true });
      const projectsPromise = apiFetch(apiBase, "/api/projects", { auth: true });
      const tagsPromise = apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" });

      try {
        const postsRes = await postsPromise;
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }
        if (!postsRes.ok) {
          throw new Error("posts_load_failed");
        }
        const postsData = await postsRes.json();
        const nextPosts = Array.isArray(postsData.posts) ? postsData.posts : [];
        const nextMediaVariants =
          postsData?.mediaVariants && typeof postsData.mediaVariants === "object"
            ? postsData.mediaVariants
            : {};
        setPosts(nextPosts);
        setMediaVariants(nextMediaVariants);
        setHasResolvedPosts(true);
        setHasLoadedOnce(true);
        setIsInitialLoading(false);

        let nextUsers: UserRecord[];
        let nextOwnerIds: string[];
        let nextProjects: Project[];
        let nextTagTranslations: Record<string, string>;

        const [usersResult, projectsResult, tagsResult] = await Promise.allSettled([
          usersPromise,
          projectsPromise,
          tagsPromise,
        ]);
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        if (usersResult.status === "fulfilled" && usersResult.value.ok) {
          const usersData = await usersResult.value.json();
          nextUsers = Array.isArray(usersData.users) ? usersData.users : [];
          nextOwnerIds = Array.isArray(usersData.ownerIds) ? usersData.ownerIds : [];
        } else {
          nextUsers = [];
          nextOwnerIds = [];
        }
        setUsers(nextUsers);
        setOwnerIds(nextOwnerIds);
        setHasResolvedUsers(true);

        if (projectsResult.status === "fulfilled" && projectsResult.value.ok) {
          const projectsData = await projectsResult.value.json();
          nextProjects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
        } else {
          nextProjects = [];
        }
        setProjects(nextProjects);
        setHasResolvedProjects(true);

        if (tagsResult.status === "fulfilled" && tagsResult.value.ok) {
          const tagsData = await tagsResult.value.json();
          nextTagTranslations = tagsData.tags || {};
        } else {
          nextTagTranslations = {};
        }
        setTagTranslations(nextTagTranslations);
        setHasResolvedTagTranslations(true);

        writePostsPageCache({
          posts: nextPosts,
          mediaVariants: nextMediaVariants,
          users: nextUsers,
          ownerIds: nextOwnerIds,
          projects: nextProjects,
          tagTranslations: nextTagTranslations,
        });
      } catch {
        if (isActive && requestIdRef.current === requestId) {
          if (!hasLoadedOnceRef.current) {
            setMediaVariants({});
            setPosts([]);
            setUsers([]);
            setOwnerIds([]);
            setProjects([]);
            setTagTranslations({});
            setHasResolvedUsers(false);
            setHasResolvedProjects(false);
            setHasResolvedTagTranslations(false);
          }
          setHasLoadError(true);
        }
      } finally {
        if (isActive && requestIdRef.current === requestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
          if (cached) {
            setHasResolvedUsers(true);
            setHasResolvedProjects(true);
            setHasResolvedTagTranslations(true);
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
    hasLoadError,
    hasLoadedOnce,
    hasResolvedPosts,
    hasResolvedProjects,
    hasResolvedTagTranslations,
    hasResolvedUsers,
    isInitialLoading,
    isRefreshing,
    loadPosts,
    mediaVariants,
    ownerIds,
    posts,
    projects,
    refreshPosts,
    setMediaVariants,
    setPosts,
    setProjects,
    setTagTranslations,
    tagTranslations,
    users,
  };
}
