const REQUIRED_DEPENDENCY_KEYS = [
  "createSlug",
  "createUniqueSlug",
  "crypto",
  "dedupePostVersionRecordsNewestFirst",
  "getNormalizePosts",
  "invalidateJsonFileCache",
  "readJsonFileFromCache",
  "writeJsonFileToCache",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[post-version-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(`[post-version-runtime] ${dependencyName} getter must be a function`);
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(`[post-version-runtime] ${dependencyName} getter must resolve to a function`);
};

const comparePostVersionNewestFirst = (left, right) => {
  const leftTs = new Date(left?.createdAt || 0).getTime();
  const rightTs = new Date(right?.createdAt || 0).getTime();
  const safeLeftTs = Number.isFinite(leftTs) ? leftTs : 0;
  const safeRightTs = Number.isFinite(rightTs) ? rightTs : 0;
  if (safeRightTs !== safeLeftTs) {
    return safeRightTs - safeLeftTs;
  }
  const leftVersion = Number(left?.versionNumber) || 0;
  const rightVersion = Number(right?.versionNumber) || 0;
  if (rightVersion !== leftVersion) {
    return rightVersion - leftVersion;
  }
  return String(right?.id || "").localeCompare(String(left?.id || ""), "pt-BR");
};

export const createPostVersionRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    createSlug,
    createUniqueSlug,
    crypto,
    dataRepository = null,
    dedupePostVersionRecordsNewestFirst,
    getNormalizePosts,
    invalidateJsonFileCache,
    readJsonFileFromCache,
    writeJsonFileToCache,
    deleteRetentionMs = 3 * 24 * 60 * 60 * 1000,
    postVersionRetentionDays = 15,
    postVersionRetentionMax = 50,
  } = dependencies;

  const postVersionRetentionMs = postVersionRetentionDays * 24 * 60 * 60 * 1000;

  const isWithinRestoreWindow = (deletedAt) => {
    if (!deletedAt) {
      return false;
    }
    const ts = new Date(deletedAt).getTime();
    if (!Number.isFinite(ts)) {
      return false;
    }
    return Date.now() - ts <= deleteRetentionMs;
  };

  const pruneExpiredDeleted = (items) =>
    (Array.isArray(items) ? items : []).filter(
      (item) => !item?.deletedAt || isWithinRestoreWindow(item.deletedAt),
    );

  const isPostVersionWithinRetention = (createdAt, nowMs = Date.now()) => {
    const createdAtMs = new Date(createdAt || 0).getTime();
    if (!Number.isFinite(createdAtMs)) {
      return false;
    }
    return nowMs - createdAtMs <= postVersionRetentionMs;
  };

  const normalizePostVersionReason = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (
      normalized === "create" ||
      normalized === "update" ||
      normalized === "manual" ||
      normalized === "rollback"
    ) {
      return normalized;
    }
    return "update";
  };

  const buildPostVersionSnapshot = (postInput) => {
    const normalizePosts = resolveLazyDependency("getNormalizePosts", getNormalizePosts);
    const normalizedPost = normalizePosts([postInput || {}])[0] || normalizePosts([{}])[0];
    return {
      id: normalizedPost.id,
      slug: normalizedPost.slug,
      title: normalizedPost.title,
      status: normalizedPost.status,
      publishedAt: normalizedPost.publishedAt,
      scheduledAt: normalizedPost.scheduledAt || null,
      projectId: normalizedPost.projectId || "",
      excerpt: normalizedPost.excerpt || "",
      content: normalizedPost.content || "",
      contentFormat: normalizedPost.contentFormat || "markdown",
      author: normalizedPost.author || "",
      coverImageUrl: normalizedPost.coverImageUrl || null,
      coverAlt: normalizedPost.coverAlt || "",
      seoTitle: normalizedPost.seoTitle || "",
      seoDescription: normalizedPost.seoDescription || "",
      tags: Array.isArray(normalizedPost.tags) ? normalizedPost.tags.filter(Boolean) : [],
      updatedAt: normalizedPost.updatedAt || new Date().toISOString(),
    };
  };

  const normalizePostVersionSnapshot = (snapshotInput, fallback = {}) => {
    const source =
      snapshotInput && typeof snapshotInput === "object" && !Array.isArray(snapshotInput)
        ? snapshotInput
        : {};
    const seed = {
      id: String(source.id || fallback.postId || crypto.randomUUID()),
      slug: String(source.slug || fallback.slug || source.title || fallback.postId || "post"),
      title: String(source.title || fallback.title || "Sem título"),
      status: source.status,
      publishedAt: source.publishedAt || source.scheduledAt || new Date().toISOString(),
      scheduledAt: source.scheduledAt || null,
      projectId: source.projectId || "",
      excerpt: source.excerpt || "",
      content: source.content || "",
      contentFormat: source.contentFormat || "markdown",
      author: source.author || "",
      coverImageUrl: source.coverImageUrl || null,
      coverAlt: source.coverAlt || "",
      seoTitle: source.seoTitle || "",
      seoDescription: source.seoDescription || "",
      tags: Array.isArray(source.tags) ? source.tags : [],
      createdAt: source.createdAt || source.updatedAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
    };
    return buildPostVersionSnapshot(seed);
  };

  const normalizePostVersionRecords = (entries) => {
    const source = Array.isArray(entries) ? entries : [];
    const normalized = [];
    const seenIds = new Set();
    source.forEach((entry, index) => {
      const candidate = entry && typeof entry === "object" ? entry : {};
      const id = String(candidate.id || "").trim() || crypto.randomUUID();
      if (seenIds.has(id)) {
        return;
      }
      seenIds.add(id);
      const postId = String(candidate.postId || candidate?.snapshot?.id || "").trim();
      if (!postId) {
        return;
      }
      const createdAtRaw =
        candidate.createdAt || candidate?.snapshot?.updatedAt || new Date().toISOString();
      const createdAtParsed = new Date(createdAtRaw);
      const createdAt = Number.isFinite(createdAtParsed.getTime())
        ? createdAtParsed.toISOString()
        : new Date().toISOString();
      const fallbackSlug = String(candidate.slug || candidate?.snapshot?.slug || "").trim();
      const fallbackTitle = String(candidate?.snapshot?.title || "").trim();
      const snapshot = normalizePostVersionSnapshot(candidate.snapshot, {
        postId,
        slug: fallbackSlug,
        title: fallbackTitle,
      });
      const versionNumber = Number(candidate.versionNumber);
      normalized.push({
        id,
        postId,
        versionNumber:
          Number.isFinite(versionNumber) && versionNumber > 0
            ? Math.floor(versionNumber)
            : index + 1,
        reason: normalizePostVersionReason(candidate.reason),
        label:
          typeof candidate.label === "string" && candidate.label.trim()
            ? String(candidate.label)
            : null,
        actorId:
          typeof candidate.actorId === "string" && candidate.actorId.trim()
            ? String(candidate.actorId)
            : null,
        actorName:
          typeof candidate.actorName === "string" && candidate.actorName.trim()
            ? String(candidate.actorName)
            : null,
        slug: snapshot.slug,
        createdAt,
        snapshot,
      });
    });
    normalized.sort((a, b) => {
      if (a.postId !== b.postId) {
        return a.postId.localeCompare(b.postId, "pt-BR");
      }
      const versionDiff = (Number(a.versionNumber) || 0) - (Number(b.versionNumber) || 0);
      if (versionDiff !== 0) {
        return versionDiff;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return normalized;
  };

  const prunePostVersions = (entries, postId, maxVersionsPerPost = postVersionRetentionMax) => {
    const normalized = normalizePostVersionRecords(entries).filter((item) =>
      isPostVersionWithinRetention(item.createdAt),
    );
    const safePostId = String(postId || "").trim();
    const safeMax = Math.max(1, Number(maxVersionsPerPost) || postVersionRetentionMax);
    const grouped = new Map();
    normalized.forEach((item) => {
      if (safePostId && item.postId !== safePostId) {
        return;
      }
      const bucket = grouped.get(item.postId) || [];
      bucket.push(item);
      grouped.set(item.postId, bucket);
    });
    if (grouped.size === 0) {
      return normalized;
    }
    const keepIds = new Set();
    grouped.forEach((itemsByPost) => {
      dedupePostVersionRecordsNewestFirst(itemsByPost.sort(comparePostVersionNewestFirst))
        .slice(0, safeMax)
        .forEach((item) => keepIds.add(item.id));
    });
    return normalized.filter((item) => {
      if (safePostId) {
        return item.postId !== safePostId || keepIds.has(item.id);
      }
      return keepIds.has(item.id);
    });
  };

  const loadPostVersions = () => {
    const cached = readJsonFileFromCache("post_versions");
    if (cached) {
      return cached;
    }
    if (!dataRepository || typeof dataRepository.loadPostVersions !== "function") {
      return [];
    }
    const parsed = dataRepository.loadPostVersions();
    const items = Array.isArray(parsed) ? parsed : [];
    const normalized = prunePostVersions(items);
    if (JSON.stringify(items) !== JSON.stringify(normalized)) {
      writePostVersions(normalized);
    }
    writeJsonFileToCache("post_versions", normalized);
    return normalized;
  };

  const writePostVersions = (entries) => {
    if (dataRepository && typeof dataRepository.writePostVersions === "function") {
      dataRepository.writePostVersions(entries);
    }
    invalidateJsonFileCache("post_versions");
  };

  const appendPostVersion = ({ post, reason, actor = null, label = null }) => {
    const normalizePosts = resolveLazyDependency("getNormalizePosts", getNormalizePosts);
    const normalizedPost = normalizePosts([post || {}])[0];
    if (!normalizedPost?.id) {
      return null;
    }
    const versions = loadPostVersions();
    const versionsForPost = versions.filter((item) => item.postId === normalizedPost.id);
    const nextVersionNumber =
      versionsForPost.reduce((max, item) => Math.max(max, Number(item.versionNumber) || 0), 0) + 1;
    const record = {
      id: crypto.randomUUID(),
      postId: normalizedPost.id,
      versionNumber: nextVersionNumber,
      reason: normalizePostVersionReason(reason),
      label: typeof label === "string" && label.trim() ? String(label).trim() : null,
      actorId: actor?.id ? String(actor.id) : null,
      actorName: actor?.name ? String(actor.name) : null,
      slug: normalizedPost.slug,
      createdAt: new Date().toISOString(),
      snapshot: buildPostVersionSnapshot(normalizedPost),
    };
    const nextEntries = prunePostVersions(
      [...versions, record],
      normalizedPost.id,
      postVersionRetentionMax,
    );
    writePostVersions(nextEntries);
    return record;
  };

  const encodePostVersionCursor = (item) => {
    const createdAt = encodeURIComponent(String(item?.createdAt || ""));
    const id = encodeURIComponent(String(item?.id || ""));
    return `${createdAt}|${id}`;
  };

  const decodePostVersionCursor = (cursor) => {
    const raw = String(cursor || "").trim();
    if (!raw.includes("|")) {
      return null;
    }
    const [createdAtRaw, idRaw] = raw.split("|");
    const createdAt = decodeURIComponent(createdAtRaw || "");
    const id = decodeURIComponent(idRaw || "");
    if (!createdAt || !id) {
      return null;
    }
    return { createdAt, id };
  };

  const listPostVersions = (postId, options = {}) => {
    const safePostId = String(postId || "").trim();
    if (!safePostId) {
      return { versions: [], nextCursor: null };
    }
    const limitRaw = Number(options.limit);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20, 1), 100);
    const cursor = decodePostVersionCursor(options.cursor);
    let versions = loadPostVersions()
      .filter((item) => item.postId === safePostId)
      .sort(comparePostVersionNewestFirst);
    if (cursor) {
      const cursorTs = new Date(cursor.createdAt).getTime();
      versions = versions.filter((item) => {
        const itemTs = new Date(item.createdAt).getTime();
        if (itemTs < cursorTs) {
          return true;
        }
        if (itemTs > cursorTs) {
          return false;
        }
        return String(item.id) < String(cursor.id);
      });
    }
    const slice = versions.slice(0, limit);
    const nextCursor =
      versions.length > limit ? encodePostVersionCursor(slice[slice.length - 1]) : null;
    return { versions: slice, nextCursor };
  };

  const applyPostSnapshotForRollback = ({ existingPost, snapshot, allPosts }) => {
    const normalizePosts = resolveLazyDependency("getNormalizePosts", getNormalizePosts);
    const current = normalizePosts([existingPost || {}])[0];
    if (!current?.id) {
      return null;
    }
    const safeSnapshot = normalizePostVersionSnapshot(snapshot, {
      postId: current.id,
      slug: current.slug,
      title: current.title,
    });
    const otherSlugs = normalizePosts(Array.isArray(allPosts) ? allPosts : [])
      .filter((item) => item.id !== current.id)
      .map((item) => item.slug);
    const requestedSlug =
      createSlug(safeSnapshot.slug || safeSnapshot.title || current.slug) || current.slug;
    const resolvedSlug = createUniqueSlug(requestedSlug, otherSlugs);
    const updated = normalizePosts([
      {
        ...current,
        ...safeSnapshot,
        id: current.id,
        slug: resolvedSlug,
        views: current.views,
        viewsDaily: current.viewsDaily,
        commentsCount: current.commentsCount,
        deletedAt: current.deletedAt,
        deletedBy: current.deletedBy,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      },
    ])[0];
    return updated;
  };

  const postVersionReasonLabel = (reason) => {
    if (reason === "create") return "Criação";
    if (reason === "manual") return "Manual";
    if (reason === "rollback") return "Rollback";
    return "Atualização";
  };

  return {
    appendPostVersion,
    applyPostSnapshotForRollback,
    buildPostVersionSnapshot,
    isWithinRestoreWindow,
    listPostVersions,
    loadPostVersions,
    normalizePostVersionReason,
    normalizePostVersionRecords,
    normalizePostVersionSnapshot,
    postVersionReasonLabel,
    pruneExpiredDeleted,
    prunePostVersions,
    writePostVersions,
  };
};

export default createPostVersionRuntime;
