const cloneValue = (value) => {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const toDateOrNull = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const toDateOnlyOrNull = (value) => {
  const parsed = toDateOrNull(value);
  if (!parsed) {
    return null;
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const toIntegerOrDefault = (value, fallback = 0) => {
  const parsed = toIntegerOrNull(value);
  return parsed === null ? fallback : parsed;
};

const toStringArray = (value) =>
  ensureArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const hasModelMethod = (db, modelName, methodName) =>
  Boolean(db?.[modelName] && typeof db[modelName][methodName] === "function");

const stringifyComparable = (value) => JSON.stringify(value ?? null);

const diffCollectionsById = (previous, next) => {
  const prevItems = ensureArray(previous);
  const nextItems = ensureArray(next);
  const prevById = new Map();
  const prevIndexById = new Map();
  prevItems.forEach((item, index) => {
    const id = String(item?.id || "").trim();
    if (!id) {
      return;
    }
    prevById.set(id, item);
    prevIndexById.set(id, index);
  });

  const nextIds = new Set();
  const changedEntries = [];
  nextItems.forEach((item, index) => {
    const id = String(item?.id || "").trim();
    if (!id) {
      return;
    }
    nextIds.add(id);
    const previousItem = prevById.get(id);
    const previousIndex = prevIndexById.get(id);
    if (
      !previousItem ||
      previousIndex !== index ||
      stringifyComparable(previousItem) !== stringifyComparable(item)
    ) {
      changedEntries.push({ item, index });
    }
  });

  const deletedIds = [];
  prevById.forEach((_item, id) => {
    if (!nextIds.has(id)) {
      deletedIds.push(id);
    }
  });

  return { changedEntries, deletedIds };
};

const buildRuntimeStatePayload = ({
  status = "pending",
  rowCount = null,
  quarantineCount = 0,
  checksum = null,
  data = null,
} = {}) => ({
  status: String(status || "pending"),
  rowCount: rowCount === null ? null : toIntegerOrDefault(rowCount, 0),
  quarantineCount: Math.max(0, toIntegerOrDefault(quarantineCount, 0)),
  checksum: checksum ? String(checksum) : null,
  data: data && typeof data === "object" ? cloneValue(data) : null,
});

export const NORMALIZED_DOMAIN_READY = "ready";

const createNormalizedRuntimeStateMap = ({
  available = false,
  source = "error",
  rows = [],
} = {}) => {
  const state = new Map(
    ensureArray(rows).map((row) => [
      String(row?.domain || ""),
      {
        domain: String(row?.domain || ""),
        status: String(row?.status || "pending"),
        rowCount: row?.rowCount ?? null,
        quarantineCount: row?.quarantineCount ?? 0,
        checksum: row?.checksum ?? null,
        data: cloneValue(row?.data || null),
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      },
    ]),
  );
  state.available = available;
  state.source = String(source || "error");
  return state;
};

const probeNormalizedRuntimeStateTable = async (db) => {
  if (typeof db?.$queryRaw !== "function") {
    return { ok: false, exists: false, source: "unsupported_client" };
  }
  try {
    const rows = await db.$queryRaw`
      SELECT to_regclass('public.normalized_runtime_state')::text AS table_name
    `;
    const tableName = Array.isArray(rows) ? rows[0]?.table_name ?? null : null;
    if (tableName) {
      return { ok: true, exists: true, source: "normalized_runtime_state" };
    }
    return { ok: true, exists: false, source: "missing_schema" };
  } catch {
    return { ok: false, exists: false, source: "error" };
  }
};

export const loadNormalizedRuntimeStateMap = async (db) => {
  if (!hasModelMethod(db, "normalizedRuntimeStateRecord", "findMany")) {
    return createNormalizedRuntimeStateMap({
      available: false,
      source: "unsupported_client",
    });
  }
  const probe = await probeNormalizedRuntimeStateTable(db);
  if (!probe.ok) {
    return createNormalizedRuntimeStateMap({
      available: false,
      source: probe.source,
    });
  }
  if (!probe.exists) {
    return createNormalizedRuntimeStateMap({
      available: false,
      source: probe.source,
    });
  }
  try {
    const rows = await db.normalizedRuntimeStateRecord.findMany({});
    return createNormalizedRuntimeStateMap({
      available: true,
      source: "normalized_runtime_state",
      rows,
    });
  } catch {
    return createNormalizedRuntimeStateMap({
      available: false,
      source: "error",
    });
  }
};

export const isNormalizedDomainReady = (stateMap, domain) =>
  String(stateMap?.get(String(domain || ""))?.status || "").trim().toLowerCase() ===
  NORMALIZED_DOMAIN_READY;

export const upsertNormalizedRuntimeState = async (db, domain, payload = {}) => {
  if (!hasModelMethod(db, "normalizedRuntimeStateRecord", "upsert")) {
    return null;
  }
  const normalizedDomain = String(domain || "").trim();
  if (!normalizedDomain) {
    return null;
  }
  const record = buildRuntimeStatePayload(payload);
  return db.normalizedRuntimeStateRecord.upsert({
    where: { domain: normalizedDomain },
    create: {
      domain: normalizedDomain,
      ...record,
    },
    update: record,
  });
};

const userSocialRowsFromUser = (userId, user) =>
  ensureArray(user?.socials).map((entry, index) => ({
    id: `${userId}:social:${index}`,
    userId,
    position: index,
    label: String(entry?.label || ""),
    href: String(entry?.href || ""),
  }));

const userRoleRowsFromUser = (userId, user) =>
  ensureArray(user?.roles).map((role, index) => ({
    id: `${userId}:role:${index}`,
    userId,
    position: index,
    role: String(role || ""),
  }));

const userPermissionRowsFromUser = (userId, user) =>
  ensureArray(user?.permissions).map((permission, index) => ({
    id: `${userId}:permission:${index}`,
    userId,
    position: index,
    permission: String(permission || ""),
  }));

const userFavoriteRowsFromUser = (userId, user) => {
  const favoriteWorks =
    user?.favoriteWorks && typeof user.favoriteWorks === "object" ? user.favoriteWorks : {};
  const rows = [];
  ["anime", "manga"].forEach((category) => {
    ensureArray(favoriteWorks?.[category]).forEach((title, index) => {
      rows.push({
        id: `${userId}:favorite:${category}:${index}`,
        userId,
        category,
        position: index,
        title: String(title || ""),
      });
    });
  });
  return rows;
};

export const loadUsersFromNormalized = async (db) => {
  if (!hasModelMethod(db, "userV2Record", "findMany")) {
    return [];
  }
  const [users, socials, roles, permissions, favoriteWorks] = await Promise.all([
    db.userV2Record.findMany({ orderBy: { position: "asc" } }),
    hasModelMethod(db, "userSocialLinkRecord", "findMany")
      ? db.userSocialLinkRecord.findMany({ orderBy: [{ userId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "userRoleRecord", "findMany")
      ? db.userRoleRecord.findMany({ orderBy: [{ userId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "userPermissionRecord", "findMany")
      ? db.userPermissionRecord.findMany({ orderBy: [{ userId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "userFavoriteWorkRecord", "findMany")
      ? db.userFavoriteWorkRecord.findMany({
          orderBy: [{ userId: "asc" }, { category: "asc" }, { position: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const socialsByUserId = new Map();
  ensureArray(socials).forEach((row) => {
    const bucket = socialsByUserId.get(String(row.userId)) || [];
    bucket.push({
      label: String(row?.label || ""),
      href: String(row?.href || ""),
    });
    socialsByUserId.set(String(row.userId), bucket);
  });

  const rolesByUserId = new Map();
  ensureArray(roles).forEach((row) => {
    const bucket = rolesByUserId.get(String(row.userId)) || [];
    bucket.push(String(row?.role || ""));
    rolesByUserId.set(String(row.userId), bucket);
  });

  const permissionsByUserId = new Map();
  ensureArray(permissions).forEach((row) => {
    const bucket = permissionsByUserId.get(String(row.userId)) || [];
    bucket.push(String(row?.permission || ""));
    permissionsByUserId.set(String(row.userId), bucket);
  });

  const favoritesByUserId = new Map();
  ensureArray(favoriteWorks).forEach((row) => {
    const userId = String(row.userId);
    const bucket = favoritesByUserId.get(userId) || { anime: [], manga: [] };
    const category = String(row?.category || "").trim().toLowerCase();
    if (category === "anime" || category === "manga") {
      bucket[category].push(String(row?.title || ""));
    }
    favoritesByUserId.set(userId, bucket);
  });

  return ensureArray(users).map((row) => ({
    id: String(row?.id || ""),
    name: String(row?.name || ""),
    phrase: String(row?.phrase || ""),
    bio: String(row?.bio || ""),
    avatarUrl: row?.avatarUrl ? String(row.avatarUrl) : null,
    socials: cloneValue(socialsByUserId.get(String(row?.id || "")) || []),
    favoriteWorks: cloneValue(
      favoritesByUserId.get(String(row?.id || "")) || { anime: [], manga: [] },
    ),
    status: String(row?.status || "active"),
    permissions: cloneValue(permissionsByUserId.get(String(row?.id || "")) || []),
    roles: cloneValue(rolesByUserId.get(String(row?.id || "")) || []),
    avatarDisplay: {
      x: Number(row?.avatarDisplayX ?? 0.5),
      y: Number(row?.avatarDisplayY ?? 0.5),
      zoom: Number(row?.avatarZoom ?? 1),
      rotation: Number(row?.avatarRotation ?? 0),
    },
    accessRole: row?.accessRole ? String(row.accessRole) : null,
    order: Number(row?.position || 0),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
};

export const syncUsersToNormalized = async (db, previousUsers, nextUsers) => {
  if (!hasModelMethod(db, "userV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const { changedEntries, deletedIds } = diffCollectionsById(previousUsers, nextUsers);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.userV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const userId = String(item?.id || "");
    const row = {
      id: userId,
      position: index,
      name: String(item?.name || ""),
      phrase: String(item?.phrase || ""),
      bio: String(item?.bio || ""),
      avatarUrl: String(item?.avatarUrl || "").trim() || null,
      avatarDisplayX: Number(item?.avatarDisplay?.x ?? 0.5),
      avatarDisplayY: Number(item?.avatarDisplay?.y ?? 0.5),
      avatarZoom: Number(item?.avatarDisplay?.zoom ?? 1),
      avatarRotation: Number(item?.avatarDisplay?.rotation ?? 0),
      status: String(item?.status || "active"),
      accessRole: String(item?.accessRole || "").trim() || null,
      createdAt: toDateOrNull(item?.createdAt) || new Date(),
      updatedAt: toDateOrNull(item?.updatedAt) || toDateOrNull(item?.createdAt) || new Date(),
    };
    ops.push(
      db.userV2Record.upsert({
        where: { id: userId },
        create: row,
        update: row,
      }),
    );
    if (hasModelMethod(db, "userSocialLinkRecord", "deleteMany")) {
      ops.push(db.userSocialLinkRecord.deleteMany({ where: { userId } }));
      const socialRows = userSocialRowsFromUser(userId, item);
      if (socialRows.length > 0 && hasModelMethod(db, "userSocialLinkRecord", "createMany")) {
        ops.push(db.userSocialLinkRecord.createMany({ data: socialRows }));
      }
    }
    if (hasModelMethod(db, "userRoleRecord", "deleteMany")) {
      ops.push(db.userRoleRecord.deleteMany({ where: { userId } }));
      const roleRows = userRoleRowsFromUser(userId, item);
      if (roleRows.length > 0 && hasModelMethod(db, "userRoleRecord", "createMany")) {
        ops.push(db.userRoleRecord.createMany({ data: roleRows }));
      }
    }
    if (hasModelMethod(db, "userPermissionRecord", "deleteMany")) {
      ops.push(db.userPermissionRecord.deleteMany({ where: { userId } }));
      const permissionRows = userPermissionRowsFromUser(userId, item);
      if (permissionRows.length > 0 && hasModelMethod(db, "userPermissionRecord", "createMany")) {
        ops.push(db.userPermissionRecord.createMany({ data: permissionRows }));
      }
    }
    if (hasModelMethod(db, "userFavoriteWorkRecord", "deleteMany")) {
      ops.push(db.userFavoriteWorkRecord.deleteMany({ where: { userId } }));
      const favoriteRows = userFavoriteRowsFromUser(userId, item);
      if (favoriteRows.length > 0 && hasModelMethod(db, "userFavoriteWorkRecord", "createMany")) {
        ops.push(db.userFavoriteWorkRecord.createMany({ data: favoriteRows }));
      }
    }
  });
  await db.$transaction(ops);
  return { changed: true, deleteCount: deletedIds.length, upsertCount: changedEntries.length };
};

const uploadRowFromEntry = (entry, index) => ({
  id: String(entry?.id || ""),
  position: index,
  url: String(entry?.url || ""),
  fileName: String(entry?.fileName || ""),
  folder: String(entry?.folder || ""),
  area: String(entry?.area || String(entry?.folder || "").split("/")[0] || "root"),
  storageProvider: String(entry?.storageProvider || "local").trim().toLowerCase() || "local",
  mime: String(entry?.mime || ""),
  size: toIntegerOrNull(entry?.size),
  width: toIntegerOrNull(entry?.width),
  height: toIntegerOrNull(entry?.height),
  hashSha256: String(entry?.hashSha256 || "").trim() || null,
  altText: String(entry?.altText || ""),
  focalCrops: entry?.focalCrops ? cloneValue(entry.focalCrops) : null,
  focalPoints: entry?.focalPoints ? cloneValue(entry.focalPoints) : null,
  focalPoint: entry?.focalPoint ? cloneValue(entry.focalPoint) : null,
  variants: entry?.variants ? cloneValue(entry.variants) : null,
  variantsVersion: Math.max(1, toIntegerOrDefault(entry?.variantsVersion, 1)),
  variantBytes: Math.max(0, toIntegerOrDefault(entry?.variantBytes, 0)),
  createdAt: toDateOrNull(entry?.createdAt) || new Date(),
  updatedAt: toDateOrNull(entry?.updatedAt) || toDateOrNull(entry?.createdAt) || new Date(),
});

const normalizeUploadEntriesForStorage = (entries) => {
  const seenHashes = new Set();
  let deduplicatedHashCount = 0;
  const normalizedEntries = ensureArray(entries).map((entry) => {
    const normalizedEntry = cloneValue(entry || {});
    const normalizedHash = String(normalizedEntry?.hashSha256 || "").trim();
    if (!normalizedHash) {
      normalizedEntry.hashSha256 = "";
      return normalizedEntry;
    }
    if (seenHashes.has(normalizedHash)) {
      normalizedEntry.hashSha256 = "";
      deduplicatedHashCount += 1;
      return normalizedEntry;
    }
    seenHashes.add(normalizedHash);
    normalizedEntry.hashSha256 = normalizedHash;
    return normalizedEntry;
  });
  return { entries: normalizedEntries, deduplicatedHashCount };
};

export const loadUploadsFromNormalized = async (db) => {
  if (!hasModelMethod(db, "uploadV2Record", "findMany")) {
    return [];
  }
  const rows = await db.uploadV2Record.findMany({ orderBy: { position: "asc" } });
  return ensureArray(rows).map((row) => ({
    id: String(row?.id || ""),
    url: String(row?.url || ""),
    fileName: String(row?.fileName || ""),
    folder: String(row?.folder || ""),
    storageProvider: String(row?.storageProvider || "local").trim().toLowerCase() || "local",
    size: row?.size ?? null,
    mime: String(row?.mime || ""),
    width: row?.width ?? null,
    height: row?.height ?? null,
    area: String(row?.area || ""),
    hashSha256: String(row?.hashSha256 || ""),
    altText: String(row?.altText || ""),
    focalCrops: cloneValue(row?.focalCrops || undefined),
    focalPoints: cloneValue(row?.focalPoints || undefined),
    focalPoint: cloneValue(row?.focalPoint || undefined),
    variants: cloneValue(row?.variants || {}),
    variantsVersion: Number(row?.variantsVersion || 1),
    variantBytes: Number(row?.variantBytes || 0),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
};

export const syncUploadsToNormalized = async (db, previousUploads, nextUploads) => {
  if (!hasModelMethod(db, "uploadV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0, deduplicatedHashCount: 0 };
  }
  const { entries: safePreviousUploads } = normalizeUploadEntriesForStorage(previousUploads);
  const { entries: safeNextUploads, deduplicatedHashCount } =
    normalizeUploadEntriesForStorage(nextUploads);
  const { changedEntries, deletedIds } = diffCollectionsById(safePreviousUploads, safeNextUploads);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0, deduplicatedHashCount };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.uploadV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const row = uploadRowFromEntry(item, index);
    ops.push(
      db.uploadV2Record.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      }),
    );
  });
  await db.$transaction(ops);
  return {
    changed: true,
    deleteCount: deletedIds.length,
    upsertCount: changedEntries.length,
    deduplicatedHashCount,
  };
};

const projectRowFromEntry = (entry, index) => ({
  id: String(entry?.id || ""),
  position: index,
  anilistId: toIntegerOrNull(entry?.anilistId),
  title: String(entry?.title || ""),
  titleOriginal: String(entry?.titleOriginal || ""),
  titleEnglish: String(entry?.titleEnglish || ""),
  synopsis: String(entry?.synopsis || ""),
  description: String(entry?.description || ""),
  type: String(entry?.type || ""),
  status: String(entry?.status || ""),
  year: String(entry?.year || ""),
  studio: String(entry?.studio || ""),
  animationStudios: toStringArray(entry?.animationStudios),
  episodes: String(entry?.episodes || ""),
  tags: toStringArray(entry?.tags),
  genres: toStringArray(entry?.genres),
  cover: String(entry?.cover || ""),
  coverAlt: String(entry?.coverAlt || ""),
  banner: String(entry?.banner || ""),
  bannerAlt: String(entry?.bannerAlt || ""),
  season: String(entry?.season || ""),
  schedule: String(entry?.schedule || ""),
  rating: String(entry?.rating || ""),
  country: String(entry?.country || ""),
  source: String(entry?.source || ""),
  discordRoleId: String(entry?.discordRoleId || ""),
  producers: toStringArray(entry?.producers),
  score: toNumberOrNull(entry?.score),
  startDate: String(entry?.startDate || ""),
  endDate: String(entry?.endDate || ""),
  trailerUrl: String(entry?.trailerUrl || ""),
  forceHero: Boolean(entry?.forceHero),
  heroImageUrl: String(entry?.heroImageUrl || ""),
  heroImageAlt: String(entry?.heroImageAlt || ""),
  staff:
    Array.isArray(entry?.staff) || (entry?.staff && typeof entry.staff === "object")
      ? cloneValue(entry.staff)
      : null,
  animeStaff:
    Array.isArray(entry?.animeStaff) || (entry?.animeStaff && typeof entry.animeStaff === "object")
      ? cloneValue(entry.animeStaff)
      : null,
  views: Math.max(0, toIntegerOrDefault(entry?.views, 0)),
  viewsDaily:
    entry?.viewsDaily && typeof entry.viewsDaily === "object" ? cloneValue(entry.viewsDaily) : null,
  commentsCount: Math.max(0, toIntegerOrDefault(entry?.commentsCount, 0)),
  order: toIntegerOrDefault(entry?.order, index),
  deletedAt: toDateOrNull(entry?.deletedAt),
  deletedBy: String(entry?.deletedBy || "").trim() || null,
  createdAt: toDateOrNull(entry?.createdAt) || new Date(),
  updatedAt: toDateOrNull(entry?.updatedAt) || toDateOrNull(entry?.createdAt) || new Date(),
  searchText: String(entry?.searchText || ""),
});

export const buildProjectEpisodeStableId = (projectId, episode) => {
  const normalizedProjectId = String(projectId || "").trim();
  const number = toIntegerOrDefault(episode?.number, 0);
  const volume = toIntegerOrNull(episode?.volume);
  return `${normalizedProjectId}:episode:${volume ?? 0}:${number}`;
};

const projectRelationRowsFromProject = (projectId, project) =>
  ensureArray(project?.relations).map((entry, index) => ({
    id: `${projectId}:relation:${index}`,
    projectId,
    position: index,
    relation: String(entry?.relation || ""),
    title: String(entry?.title || ""),
    format: String(entry?.format || ""),
    status: String(entry?.status || ""),
    image: String(entry?.image || ""),
    relatedId: String(entry?.projectId || "").trim() || null,
    anilistId: String(entry?.anilistId || "").trim() || null,
  }));

const projectVolumeRowsFromProject = (projectId, project) =>
  ensureArray(project?.volumeEntries).map((entry, index) => ({
    id: `${projectId}:volume:${toIntegerOrDefault(entry?.volume, index + 1)}`,
    projectId,
    volume: toIntegerOrDefault(entry?.volume, index + 1),
    position: index,
    synopsis: String(entry?.synopsis || ""),
    coverImageUrl: String(entry?.coverImageUrl || ""),
    coverImageAlt: String(entry?.coverImageAlt || ""),
  }));

const projectEpisodeRowsFromProject = (projectId, project) =>
  ensureArray(project?.episodeDownloads).map((episode, index) => ({
    id: buildProjectEpisodeStableId(projectId, episode),
    projectId,
    position: index,
    number: toIntegerOrDefault(episode?.number, 0),
    volume: toIntegerOrNull(episode?.volume),
    title: String(episode?.title || ""),
    entryKind: String(episode?.entryKind || "main").trim().toLowerCase() === "extra" ? "extra" : "main",
    entrySubtype: String(episode?.entrySubtype || "").trim() || null,
    readingOrder: toIntegerOrNull(episode?.readingOrder),
    displayLabel: String(episode?.displayLabel || "").trim() || null,
    releaseDate: String(episode?.releaseDate || ""),
    duration: String(episode?.duration || ""),
    coverImageUrl: String(episode?.coverImageUrl || "").trim() || null,
    coverImageAlt: String(episode?.coverImageAlt || ""),
    content: typeof episode?.content === "string" ? episode.content : "",
    contentFormat: String(episode?.contentFormat || "lexical") || "lexical",
    publicationStatus:
      String(episode?.publicationStatus || "").trim().toLowerCase() === "draft"
        ? "draft"
        : "published",
    hash: String(episode?.hash || "").trim() || null,
    sizeBytes: toIntegerOrNull(episode?.sizeBytes),
    chapterUpdatedAt: String(episode?.chapterUpdatedAt || ""),
  }));

const projectEpisodeSourceRowsFromProject = (projectId, project) => {
  const rows = [];
  ensureArray(project?.episodeDownloads).forEach((episode) => {
    const episodeId = buildProjectEpisodeStableId(projectId, episode);
    ensureArray(episode?.sources).forEach((source, index) => {
      rows.push({
        id: `${episodeId}:source:${index}`,
        episodeId,
        position: index,
        label: String(source?.label || ""),
        url: String(source?.url || ""),
      });
    });
  });
  return rows;
};

export const loadProjectsFromNormalized = async (db) => {
  if (!hasModelMethod(db, "projectV2Record", "findMany")) {
    return [];
  }
  const [projects, relations, volumeEntries, episodes, sources] = await Promise.all([
    db.projectV2Record.findMany({ orderBy: { position: "asc" } }),
    hasModelMethod(db, "projectRelationRecord", "findMany")
      ? db.projectRelationRecord.findMany({ orderBy: [{ projectId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "projectVolumeEntryRecord", "findMany")
      ? db.projectVolumeEntryRecord.findMany({ orderBy: [{ projectId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "projectEpisodeRecord", "findMany")
      ? db.projectEpisodeRecord.findMany({ orderBy: [{ projectId: "asc" }, { position: "asc" }] })
      : Promise.resolve([]),
    hasModelMethod(db, "projectEpisodeSourceRecord", "findMany")
      ? db.projectEpisodeSourceRecord.findMany({
          orderBy: [{ episodeId: "asc" }, { position: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const relationsByProjectId = new Map();
  ensureArray(relations).forEach((row) => {
    const bucket = relationsByProjectId.get(String(row.projectId)) || [];
    bucket.push({
      relation: String(row?.relation || ""),
      title: String(row?.title || ""),
      format: String(row?.format || ""),
      status: String(row?.status || ""),
      image: String(row?.image || ""),
      projectId: row?.relatedId ? String(row.relatedId) : undefined,
      anilistId: row?.anilistId ? String(row.anilistId) : undefined,
    });
    relationsByProjectId.set(String(row.projectId), bucket);
  });

  const volumesByProjectId = new Map();
  ensureArray(volumeEntries).forEach((row) => {
    const bucket = volumesByProjectId.get(String(row.projectId)) || [];
    bucket.push({
      volume: Number(row?.volume || 0),
      synopsis: String(row?.synopsis || ""),
      coverImageUrl: String(row?.coverImageUrl || ""),
      coverImageAlt: String(row?.coverImageAlt || ""),
    });
    volumesByProjectId.set(String(row.projectId), bucket);
  });

  const sourcesByEpisodeId = new Map();
  ensureArray(sources).forEach((row) => {
    const bucket = sourcesByEpisodeId.get(String(row.episodeId)) || [];
    bucket.push({
      label: String(row?.label || ""),
      url: String(row?.url || ""),
    });
    sourcesByEpisodeId.set(String(row.episodeId), bucket);
  });

  const episodesByProjectId = new Map();
  ensureArray(episodes).forEach((row) => {
    const bucket = episodesByProjectId.get(String(row.projectId)) || [];
    bucket.push({
      number: Number(row?.number || 0),
      volume: row?.volume ?? undefined,
      title: String(row?.title || ""),
      entryKind: String(row?.entryKind || "main"),
      entrySubtype: row?.entrySubtype ? String(row.entrySubtype) : undefined,
      readingOrder: row?.readingOrder ?? undefined,
      displayLabel: row?.displayLabel ? String(row.displayLabel) : undefined,
      releaseDate: String(row?.releaseDate || ""),
      duration: String(row?.duration || ""),
      coverImageUrl: row?.coverImageUrl ? String(row.coverImageUrl) : undefined,
      content: typeof row?.content === "string" ? row.content : "",
      contentFormat: String(row?.contentFormat || "lexical"),
      publicationStatus: String(row?.publicationStatus || "published"),
      sources: cloneValue(sourcesByEpisodeId.get(String(row.id)) || []),
      coverImageAlt: String(row?.coverImageAlt || ""),
      hash: row?.hash ? String(row.hash) : undefined,
      sizeBytes: row?.sizeBytes ?? undefined,
      chapterUpdatedAt: String(row?.chapterUpdatedAt || ""),
    });
    episodesByProjectId.set(String(row.projectId), bucket);
  });

  return ensureArray(projects).map((row) => {
    const volumeEntriesForProject = cloneValue(volumesByProjectId.get(String(row.id)) || []);
    const volumeCovers = ensureArray(volumeEntriesForProject)
      .filter((entry) => String(entry?.coverImageUrl || "").trim())
      .map((entry) => ({
        volume: Number(entry?.volume || 0),
        coverImageUrl: String(entry?.coverImageUrl || ""),
        coverImageAlt: String(entry?.coverImageAlt || ""),
      }));
    return {
      id: String(row?.id || ""),
      anilistId: row?.anilistId ?? null,
      title: String(row?.title || ""),
      titleOriginal: String(row?.titleOriginal || ""),
      titleEnglish: String(row?.titleEnglish || ""),
      synopsis: String(row?.synopsis || ""),
      description: String(row?.description || ""),
      type: String(row?.type || ""),
      status: String(row?.status || ""),
      year: String(row?.year || ""),
      studio: String(row?.studio || ""),
      animationStudios: cloneValue(row?.animationStudios || []),
      episodes: String(row?.episodes || ""),
      tags: cloneValue(row?.tags || []),
      genres: cloneValue(row?.genres || []),
      cover: String(row?.cover || ""),
      coverAlt: String(row?.coverAlt || ""),
      banner: String(row?.banner || ""),
      bannerAlt: String(row?.bannerAlt || ""),
      season: String(row?.season || ""),
      schedule: String(row?.schedule || ""),
      rating: String(row?.rating || ""),
      country: String(row?.country || ""),
      source: String(row?.source || ""),
      discordRoleId: String(row?.discordRoleId || ""),
      producers: cloneValue(row?.producers || []),
      score: row?.score ?? null,
      startDate: String(row?.startDate || ""),
      endDate: String(row?.endDate || ""),
      relations: cloneValue(relationsByProjectId.get(String(row.id)) || []),
      staff: cloneValue(row?.staff || []),
      animeStaff: cloneValue(row?.animeStaff || []),
      trailerUrl: String(row?.trailerUrl || ""),
      forceHero: Boolean(row?.forceHero),
      heroImageUrl: String(row?.heroImageUrl || ""),
      heroImageAlt: String(row?.heroImageAlt || ""),
      volumeEntries: volumeEntriesForProject,
      volumeCovers,
      episodeDownloads: cloneValue(episodesByProjectId.get(String(row.id)) || []),
      views: Number(row?.views || 0),
      viewsDaily: cloneValue(row?.viewsDaily || {}),
      commentsCount: Number(row?.commentsCount || 0),
      order: Number(row?.order || 0),
      deletedAt: row?.deletedAt ? new Date(row.deletedAt).toISOString() : null,
      deletedBy: row?.deletedBy ? String(row.deletedBy) : null,
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      searchText: String(row?.searchText || ""),
    };
  });
};

export const syncProjectsToNormalized = async (db, previousProjects, nextProjects) => {
  if (!hasModelMethod(db, "projectV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const { changedEntries, deletedIds } = diffCollectionsById(previousProjects, nextProjects);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.projectV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const projectId = String(item?.id || "");
    const row = projectRowFromEntry(item, index);
    ops.push(
      db.projectV2Record.upsert({
        where: { id: projectId },
        create: row,
        update: row,
      }),
    );
    if (hasModelMethod(db, "projectRelationRecord", "deleteMany")) {
      ops.push(db.projectRelationRecord.deleteMany({ where: { projectId } }));
      const rows = projectRelationRowsFromProject(projectId, item);
      if (rows.length > 0 && hasModelMethod(db, "projectRelationRecord", "createMany")) {
        ops.push(db.projectRelationRecord.createMany({ data: rows }));
      }
    }
    if (hasModelMethod(db, "projectVolumeEntryRecord", "deleteMany")) {
      ops.push(db.projectVolumeEntryRecord.deleteMany({ where: { projectId } }));
      const rows = projectVolumeRowsFromProject(projectId, item);
      if (rows.length > 0 && hasModelMethod(db, "projectVolumeEntryRecord", "createMany")) {
        ops.push(db.projectVolumeEntryRecord.createMany({ data: rows }));
      }
    }
    if (hasModelMethod(db, "projectEpisodeRecord", "deleteMany")) {
      ops.push(db.projectEpisodeRecord.deleteMany({ where: { projectId } }));
      const episodeRows = projectEpisodeRowsFromProject(projectId, item);
      if (episodeRows.length > 0 && hasModelMethod(db, "projectEpisodeRecord", "createMany")) {
        ops.push(db.projectEpisodeRecord.createMany({ data: episodeRows }));
      }
      const sourceRows = projectEpisodeSourceRowsFromProject(projectId, item);
      if (
        sourceRows.length > 0 &&
        hasModelMethod(db, "projectEpisodeSourceRecord", "createMany")
      ) {
        ops.push(db.projectEpisodeSourceRecord.createMany({ data: sourceRows }));
      }
    }
  });
  await db.$transaction(ops);
  return { changed: true, deleteCount: deletedIds.length, upsertCount: changedEntries.length };
};

const postRowFromEntry = (entry, index) => ({
  id: String(entry?.id || ""),
  position: index,
  title: String(entry?.title || ""),
  slug: String(entry?.slug || ""),
  coverImageUrl: String(entry?.coverImageUrl || "").trim() || null,
  coverAlt: String(entry?.coverAlt || ""),
  excerpt: String(entry?.excerpt || ""),
  content: typeof entry?.content === "string" ? entry.content : "",
  contentFormat: String(entry?.contentFormat || "markdown") || "markdown",
  author: String(entry?.author || ""),
  publishedAt: toDateOrNull(entry?.publishedAt),
  scheduledAt: toDateOrNull(entry?.scheduledAt),
  status: String(entry?.status || "draft"),
  seoTitle: String(entry?.seoTitle || ""),
  seoDescription: String(entry?.seoDescription || ""),
  projectId: String(entry?.projectId || "").trim() || null,
  tags: toStringArray(entry?.tags),
  views: Math.max(0, toIntegerOrDefault(entry?.views, 0)),
  viewsDaily:
    entry?.viewsDaily && typeof entry.viewsDaily === "object" ? cloneValue(entry.viewsDaily) : null,
  commentsCount: Math.max(0, toIntegerOrDefault(entry?.commentsCount, 0)),
  deletedAt: toDateOrNull(entry?.deletedAt),
  deletedBy: String(entry?.deletedBy || "").trim() || null,
  createdAt: toDateOrNull(entry?.createdAt) || new Date(),
  updatedAt: toDateOrNull(entry?.updatedAt) || toDateOrNull(entry?.createdAt) || new Date(),
  searchText: String(entry?.searchText || ""),
});

export const loadPostsFromNormalized = async (db) => {
  if (!hasModelMethod(db, "postV2Record", "findMany")) {
    return [];
  }
  const rows = await db.postV2Record.findMany({ orderBy: { position: "asc" } });
  return ensureArray(rows).map((row) => ({
    id: String(row?.id || ""),
    title: String(row?.title || ""),
    slug: String(row?.slug || ""),
    coverImageUrl: row?.coverImageUrl ? String(row.coverImageUrl) : null,
    coverAlt: String(row?.coverAlt || ""),
    excerpt: String(row?.excerpt || ""),
    content: typeof row?.content === "string" ? row.content : "",
    contentFormat: String(row?.contentFormat || "markdown"),
    author: String(row?.author || ""),
    publishedAt: row?.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    scheduledAt: row?.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    status: String(row?.status || "draft"),
    seoTitle: String(row?.seoTitle || ""),
    seoDescription: String(row?.seoDescription || ""),
    projectId: row?.projectId ? String(row.projectId) : "",
    tags: cloneValue(row?.tags || []),
    views: Number(row?.views || 0),
    viewsDaily: cloneValue(row?.viewsDaily || {}),
    commentsCount: Number(row?.commentsCount || 0),
    deletedAt: row?.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    deletedBy: row?.deletedBy ? String(row.deletedBy) : null,
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    searchText: String(row?.searchText || ""),
  }));
};

export const syncPostsToNormalized = async (db, previousPosts, nextPosts) => {
  if (!hasModelMethod(db, "postV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const { changedEntries, deletedIds } = diffCollectionsById(previousPosts, nextPosts);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.postV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const row = postRowFromEntry(item, index);
    ops.push(
      db.postV2Record.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      }),
    );
  });
  await db.$transaction(ops);
  return { changed: true, deleteCount: deletedIds.length, upsertCount: changedEntries.length };
};

const postVersionRowFromEntry = (entry, index) => ({
  id: String(entry?.id || ""),
  postId: String(entry?.postId || ""),
  position: index,
  versionNumber: Math.max(1, toIntegerOrDefault(entry?.versionNumber, index + 1)),
  reason: String(entry?.reason || "update"),
  label: typeof entry?.label === "string" && entry.label.trim() ? String(entry.label) : null,
  actorId: typeof entry?.actorId === "string" && entry.actorId.trim() ? String(entry.actorId) : null,
  actorName:
    typeof entry?.actorName === "string" && entry.actorName.trim() ? String(entry.actorName) : null,
  slug: String(entry?.slug || entry?.snapshot?.slug || ""),
  createdAt: toDateOrNull(entry?.createdAt) || new Date(),
  snapshot: cloneValue(entry?.snapshot || {}),
});

export const loadPostVersionsFromNormalized = async (db) => {
  if (!hasModelMethod(db, "postVersionV2Record", "findMany")) {
    return [];
  }
  const rows = await db.postVersionV2Record.findMany({ orderBy: { position: "asc" } });
  return ensureArray(rows).map((row) => ({
    id: String(row?.id || ""),
    postId: String(row?.postId || ""),
    versionNumber: Number(row?.versionNumber || 0),
    reason: String(row?.reason || "update"),
    label: row?.label ? String(row.label) : null,
    actorId: row?.actorId ? String(row.actorId) : null,
    actorName: row?.actorName ? String(row.actorName) : null,
    slug: String(row?.slug || ""),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    snapshot: cloneValue(row?.snapshot || {}),
  }));
};

export const syncPostVersionsToNormalized = async (db, previousEntries, nextEntries) => {
  if (
    !hasModelMethod(db, "postVersionV2Record", "upsert") ||
    typeof db?.$transaction !== "function"
  ) {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const { changedEntries, deletedIds } = diffCollectionsById(previousEntries, nextEntries);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0 };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.postVersionV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const row = postVersionRowFromEntry(item, index);
    ops.push(
      db.postVersionV2Record.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      }),
    );
  });
  await db.$transaction(ops);
  return { changed: true, deleteCount: deletedIds.length, upsertCount: changedEntries.length };
};

const updateRowFromEntry = (entry, index) => ({
  id: String(entry?.id || ""),
  position: index,
  projectId: String(entry?.projectId || ""),
  projectTitle: String(entry?.projectTitle || ""),
  episodeNumber: String(entry?.episodeNumber ?? ""),
  kind: String(entry?.kind || ""),
  reason: String(entry?.reason || ""),
  unit: String(entry?.unit || ""),
  image: String(entry?.image || ""),
  updatedAt: toDateOrNull(entry?.updatedAt),
});

const normalizeUpdatesForStorage = (entries, { projects = [] } = {}) => {
  const knownProjectIds = new Set(
    ensureArray(projects)
      .map((entry) => String(entry?.id || "").trim())
      .filter(Boolean),
  );
  const quarantined = [];
  const normalizedEntries = [];
  ensureArray(entries).forEach((entry) => {
    const normalizedEntry = cloneValue(entry || {});
    const projectId = String(normalizedEntry?.projectId || "").trim();
    normalizedEntry.projectId = projectId;
    if (!projectId) {
      quarantined.push({ reason: "missing_project_id", entry: normalizedEntry });
      return;
    }
    if (!knownProjectIds.has(projectId)) {
      quarantined.push({ reason: "missing_project", entry: normalizedEntry });
      return;
    }
    normalizedEntries.push(normalizedEntry);
  });
  return { entries: normalizedEntries, quarantined };
};

export const loadUpdatesFromNormalized = async (db) => {
  if (!hasModelMethod(db, "updateV2Record", "findMany")) {
    return [];
  }
  const rows = await db.updateV2Record.findMany({ orderBy: { position: "asc" } });
  return ensureArray(rows).map((row) => ({
    id: String(row?.id || ""),
    projectId: String(row?.projectId || ""),
    projectTitle: String(row?.projectTitle || ""),
    episodeNumber: String(row?.episodeNumber || ""),
    kind: String(row?.kind || ""),
    reason: String(row?.reason || ""),
    unit: String(row?.unit || ""),
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    image: String(row?.image || ""),
  }));
};

export const syncUpdatesToNormalized = async (db, previousUpdates, nextUpdates, references = {}) => {
  if (!hasModelMethod(db, "updateV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0, quarantined: [] };
  }
  const { entries: safePreviousUpdates } = normalizeUpdatesForStorage(previousUpdates, references);
  const { entries: safeNextUpdates, quarantined } = normalizeUpdatesForStorage(
    nextUpdates,
    references,
  );
  const { changedEntries, deletedIds } = diffCollectionsById(safePreviousUpdates, safeNextUpdates);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0, quarantined };
  }
  const ops = [];
  deletedIds.forEach((id) => {
    ops.push(db.updateV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const row = updateRowFromEntry(item, index);
    ops.push(
      db.updateV2Record.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      }),
    );
  });
  await db.$transaction(ops);
  return {
    changed: true,
    deleteCount: deletedIds.length,
    upsertCount: changedEntries.length,
    quarantined,
  };
};

const resolveCommentTargetRefs = (comment, { posts = [], projects = [] } = {}) => {
  const targetType = String(comment?.targetType || "").trim().toLowerCase();
  const targetId = String(comment?.targetId || "").trim();
  if (!targetType || !targetId) {
    return null;
  }
  if (targetType === "post") {
    const post = ensureArray(posts).find((entry) => String(entry?.slug || "").trim() === targetId);
    if (!post?.id) {
      return null;
    }
    return { targetType, postId: String(post.id), projectId: null, episodeId: null, targetMeta: null };
  }
  if (targetType === "project") {
    const project = ensureArray(projects).find((entry) => String(entry?.id || "").trim() === targetId);
    if (!project?.id) {
      return null;
    }
    return { targetType, postId: null, projectId: String(project.id), episodeId: null, targetMeta: null };
  }
  if (targetType !== "chapter") {
    return null;
  }
  const project = ensureArray(projects).find((entry) => String(entry?.id || "").trim() === targetId);
  if (!project?.id) {
    return null;
  }
  const chapterNumber = toIntegerOrNull(comment?.targetMeta?.chapterNumber);
  if (chapterNumber === null) {
    return null;
  }
  const volume = toIntegerOrNull(comment?.targetMeta?.volume);
  const episodeId = buildProjectEpisodeStableId(project.id, { number: chapterNumber, volume });
  const episodeExists = ensureArray(project?.episodeDownloads).some(
    (episode) => buildProjectEpisodeStableId(project.id, episode) === episodeId,
  );
  if (!episodeExists) {
    return null;
  }
  return {
    targetType,
    postId: null,
    projectId: null,
    episodeId,
    targetMeta: cloneValue(comment?.targetMeta || { chapterNumber, volume }),
  };
};

const commentRowFromEntry = (entry, index, references) => {
  const refs = resolveCommentTargetRefs(entry, references);
  if (!refs) {
    return null;
  }
  return {
    id: String(entry?.id || ""),
    position: index,
    status: String(entry?.status || "pending"),
    targetType: refs.targetType,
    postId: refs.postId,
    projectId: refs.projectId,
    episodeId: refs.episodeId,
    parentId: String(entry?.parentId || "").trim() || null,
    name: String(entry?.name || ""),
    emailHash: String(entry?.emailHash || ""),
    content: String(entry?.content || ""),
    avatarUrl: String(entry?.avatarUrl || ""),
    approvedAt: toDateOrNull(entry?.approvedAt),
    createdAt: toDateOrNull(entry?.createdAt),
    targetMeta: refs.targetMeta,
    updatedAt: toDateOrNull(entry?.updatedAt) || toDateOrNull(entry?.createdAt) || new Date(),
  };
};

export const loadCommentsFromNormalized = async (db, references = {}) => {
  if (!hasModelMethod(db, "commentV2Record", "findMany")) {
    return [];
  }
  const rows = await db.commentV2Record.findMany({ orderBy: { position: "asc" } });
  const postsById = new Map(ensureArray(references?.posts).map((post) => [String(post?.id || ""), post]));
  const episodesById = new Map();
  ensureArray(references?.projects).forEach((project) => {
    const projectId = String(project?.id || "").trim();
    ensureArray(project?.episodeDownloads).forEach((episode) => {
      episodesById.set(buildProjectEpisodeStableId(projectId, episode), { projectId, episode });
    });
  });

  return ensureArray(rows)
    .map((row) => {
      const targetType = String(row?.targetType || "").trim().toLowerCase();
      let targetId = "";
      let targetMeta = cloneValue(row?.targetMeta || null);
      if (targetType === "post") {
        targetId = String(postsById.get(String(row?.postId || ""))?.slug || "");
      } else if (targetType === "project") {
        targetId = String(row?.projectId || "");
      } else if (targetType === "chapter") {
        const episodeRef = episodesById.get(String(row?.episodeId || ""));
        targetId = String(episodeRef?.projectId || "");
        targetMeta =
          targetMeta ||
          (episodeRef
            ? {
                chapterNumber: episodeRef.episode?.number,
                volume: episodeRef.episode?.volume,
              }
            : null);
      }
      if (!targetId) {
        return null;
      }
      return {
        id: String(row?.id || ""),
        targetType,
        targetId,
        targetMeta: targetMeta || undefined,
        parentId: row?.parentId ? String(row.parentId) : null,
        name: String(row?.name || ""),
        emailHash: String(row?.emailHash || ""),
        content: String(row?.content || ""),
        status: String(row?.status || "pending"),
        createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
        approvedAt: row?.approvedAt ? new Date(row.approvedAt).toISOString() : null,
        avatarUrl: String(row?.avatarUrl || ""),
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
    })
    .filter(Boolean);
};

export const syncCommentsToNormalized = async (
  db,
  previousComments,
  nextComments,
  references = {},
) => {
  if (!hasModelMethod(db, "commentV2Record", "upsert") || typeof db?.$transaction !== "function") {
    return { changed: false, deleteCount: 0, upsertCount: 0, quarantined: [] };
  }
  const { changedEntries, deletedIds } = diffCollectionsById(previousComments, nextComments);
  if (changedEntries.length === 0 && deletedIds.length === 0) {
    return { changed: false, deleteCount: 0, upsertCount: 0, quarantined: [] };
  }
  const ops = [];
  const quarantined = [];
  deletedIds.forEach((id) => {
    ops.push(db.commentV2Record.deleteMany({ where: { id } }));
  });
  changedEntries.forEach(({ item, index }) => {
    const row = commentRowFromEntry(item, index, references);
    if (!row) {
      quarantined.push({
        id: String(item?.id || ""),
        reason: "invalid_comment_target",
        comment: cloneValue(item),
      });
      return;
    }
    ops.push(
      db.commentV2Record.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      }),
    );
  });
  if (ops.length > 0) {
    await db.$transaction(ops);
  }
  return {
    changed: true,
    deleteCount: deletedIds.length,
    upsertCount: changedEntries.length - quarantined.length,
    quarantined,
  };
};

export { cloneValue, ensureArray, toDateOnlyOrNull, toDateOrNull, toIntegerOrDefault };
