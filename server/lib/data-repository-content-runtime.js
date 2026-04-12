const REQUIRED_DEPENDENCY_KEYS = [
  "getNormalizePosts",
  "getNormalizeProjects",
  "getPruneExpiredDeleted",
  "invalidateJsonFileCache",
  "invalidatePublicReadCacheTags",
  "normalizeLegacyUpdateRecord",
  "normalizeUploadsDeep",
  "publicReadCacheTags",
  "readJsonFileFromCache",
  "readUploadStorageProvider",
  "resolveEpisodeLookup",
  "writeJsonFileToCache",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[data-repository-content-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(
      `[data-repository-content-runtime] ${dependencyName} getter must be a function`,
    );
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(
    `[data-repository-content-runtime] ${dependencyName} getter must resolve to a function`,
  );
};

export const createDataRepositoryContentRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    dataRepository = null,
    getNormalizePosts,
    getNormalizeProjects,
    getPruneExpiredDeleted,
    invalidateJsonFileCache,
    invalidatePublicReadCacheTags,
    normalizeLegacyUpdateRecord,
    normalizeUploadsDeep,
    publicReadCacheTags,
    readJsonFileFromCache,
    readUploadStorageProvider,
    resolveEpisodeLookup,
    writeJsonFileToCache,
  } = dependencies;

  const hasMethod = (methodName) =>
    Boolean(dataRepository) && typeof dataRepository[methodName] === "function";

  const loadPosts = () => {
    const cached = readJsonFileFromCache("posts");
    if (cached) {
      return cached;
    }
    if (!hasMethod("loadPosts")) {
      return [];
    }
    const parsed = dataRepository.loadPosts();
    const items = Array.isArray(parsed) ? parsed : [];
    const pruneExpiredDeleted = resolveLazyDependency(
      "getPruneExpiredDeleted",
      getPruneExpiredDeleted,
    );
    const normalizePosts = resolveLazyDependency("getNormalizePosts", getNormalizePosts);
    const pruned = pruneExpiredDeleted(items);
    if (pruned.length !== items.length) {
      writePosts(pruned);
    }
    const normalized = normalizePosts(pruned);
    if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
      writePosts(normalized);
    }
    writeJsonFileToCache("posts", normalized);
    return normalized;
  };

  const loadProjects = () => {
    const cached = readJsonFileFromCache("projects");
    if (cached) {
      return cached;
    }
    if (!hasMethod("loadProjects")) {
      return [];
    }
    const parsed = dataRepository.loadProjects();
    const items = Array.isArray(parsed) ? parsed : [];
    const pruneExpiredDeleted = resolveLazyDependency(
      "getPruneExpiredDeleted",
      getPruneExpiredDeleted,
    );
    const normalizeProjects = resolveLazyDependency("getNormalizeProjects", getNormalizeProjects);
    const pruned = pruneExpiredDeleted(items);
    if (pruned.length !== items.length) {
      writeProjects(pruned);
    }
    const normalized = normalizeProjects(pruned);
    if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
      writeProjects(normalized);
    }
    writeJsonFileToCache("projects", normalized);
    return normalized;
  };

  const writePosts = (posts) => {
    const normalizeProjects = resolveLazyDependency("getNormalizeProjects", getNormalizeProjects);
    const validProjectIds = new Set(
      normalizeProjects(loadProjects())
        .filter((project) => !project.deletedAt)
        .map((project) => String(project.id)),
    );
    const sanitizedPosts = (Array.isArray(posts) ? posts : []).map((post) => {
      const normalizedProjectId = String(post?.projectId || "").trim();
      if (!normalizedProjectId || validProjectIds.has(normalizedProjectId)) {
        return post;
      }
      return {
        ...post,
        projectId: "",
      };
    });
    if (hasMethod("writePosts")) {
      dataRepository.writePosts(normalizeUploadsDeep(sanitizedPosts));
    }
    invalidatePublicReadCacheTags([
      publicReadCacheTags.BOOTSTRAP,
      publicReadCacheTags.SEARCH,
      publicReadCacheTags.POSTS,
    ]);
    invalidateJsonFileCache("posts");
  };

  const writeProjects = (projects) => {
    if (hasMethod("writeProjects")) {
      dataRepository.writeProjects(normalizeUploadsDeep(projects));
    }
    invalidatePublicReadCacheTags([
      publicReadCacheTags.BOOTSTRAP,
      publicReadCacheTags.SEARCH,
      publicReadCacheTags.PROJECTS,
    ]);
    invalidateJsonFileCache("projects");
  };

  const loadUpdates = () => {
    const cached = readJsonFileFromCache("updates");
    if (cached) {
      return cached;
    }
    if (!hasMethod("loadUpdates")) {
      return [];
    }
    const parsed = dataRepository.loadUpdates();
    const updates = Array.isArray(parsed) ? parsed : [];
    const normalized = updates.map((update) => normalizeLegacyUpdateRecord(update));
    if (JSON.stringify(updates) !== JSON.stringify(normalized)) {
      writeUpdates(normalized);
    }
    writeJsonFileToCache("updates", normalized);
    return normalized;
  };

  const writeUpdates = (updates) => {
    const normalizeProjects = resolveLazyDependency("getNormalizeProjects", getNormalizeProjects);
    const validProjectIds = new Set(
      normalizeProjects(loadProjects())
        .filter((project) => !project.deletedAt)
        .map((project) => String(project.id)),
    );
    const sanitizedUpdates = (Array.isArray(updates) ? updates : []).filter((update) => {
      const projectId = String(update?.projectId || "").trim();
      if (!projectId) {
        return true;
      }
      return validProjectIds.has(projectId);
    });
    if (hasMethod("writeUpdates")) {
      dataRepository.writeUpdates(sanitizedUpdates);
    }
    invalidatePublicReadCacheTags([publicReadCacheTags.BOOTSTRAP]);
    invalidateJsonFileCache("updates");
  };

  const loadComments = () => {
    if (!hasMethod("loadComments")) {
      return [];
    }
    const parsed = dataRepository.loadComments();
    return Array.isArray(parsed) ? parsed : [];
  };

  const hasProjectChapter = (project, chapterNumber, volume) =>
    resolveEpisodeLookup(project, chapterNumber, volume, { requirePublished: true }).ok;

  const enforceCommentTargetIntegrity = (comments) => {
    const safeComments = Array.isArray(comments) ? comments : [];
    if (safeComments.length === 0) {
      return safeComments;
    }
    const normalizePosts = resolveLazyDependency("getNormalizePosts", getNormalizePosts);
    const normalizeProjects = resolveLazyDependency("getNormalizeProjects", getNormalizeProjects);
    const posts = normalizePosts(loadPosts());
    const projects = normalizeProjects(loadProjects());
    const postSlugs = new Set(
      posts.filter((post) => !post.deletedAt).map((post) => String(post.slug || "")),
    );
    const projectMap = new Map(
      projects
        .filter((project) => !project.deletedAt)
        .map((project) => [String(project.id || ""), project]),
    );
    return safeComments.filter((comment) => {
      const targetType = String(comment?.targetType || "")
        .trim()
        .toLowerCase();
      const targetId = String(comment?.targetId || "").trim();
      if (!targetType || !targetId) {
        return false;
      }
      if (targetType === "post") {
        return postSlugs.has(targetId);
      }
      if (targetType === "project") {
        return projectMap.has(targetId);
      }
      if (targetType === "chapter") {
        const project = projectMap.get(targetId);
        if (!project) {
          return false;
        }
        return hasProjectChapter(
          project,
          comment?.targetMeta?.chapterNumber,
          comment?.targetMeta?.volume,
        );
      }
      return false;
    });
  };

  const writeComments = (comments) => {
    const sanitizedComments = enforceCommentTargetIntegrity(comments);
    if (hasMethod("writeComments")) {
      dataRepository.writeComments(sanitizedComments);
    }
  };

  const loadUploads = () => {
    if (!hasMethod("loadUploads")) {
      return [];
    }
    const parsed = dataRepository.loadUploads();
    return (Array.isArray(parsed) ? parsed : []).map((entry) => ({
      ...(entry && typeof entry === "object" ? entry : {}),
      storageProvider: readUploadStorageProvider(entry, "local"),
    }));
  };

  const writeUploads = (uploads, options = {}) => {
    if (hasMethod("writeUploads")) {
      return dataRepository.writeUploads(uploads, options);
    }
    if (options?.awaitPersist === true) {
      return Promise.resolve();
    }
    return undefined;
  };

  return {
    loadComments,
    loadPosts,
    loadProjects,
    loadUpdates,
    loadUploads,
    writeComments,
    writePosts,
    writeProjects,
    writeUpdates,
    writeUploads,
  };
};

export default createDataRepositoryContentRuntime;
