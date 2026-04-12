const REQUIRED_DEPENDENCY_KEYS = [
  "STATIC_DEFAULT_CACHE_CONTROL",
  "attachUploadMediaMetadata",
  "buildDiskStorageAreaSummary",
  "buildStorageAreaSummary",
  "cleanupUploadStagingWorkspace",
  "createUploadStagingWorkspace",
  "crypto",
  "deriveFocalPointsFromCrops",
  "fs",
  "getLoadUploads",
  "getPrimaryFocalPoint",
  "getUploadVariantUrlPrefix",
  "getWriteUploads",
  "materializeUploadEntrySourceToStaging",
  "mergeUploadVariantPresetKeys",
  "normalizeFocalCrops",
  "normalizeFocalPoints",
  "normalizeUploadStorageProvider",
  "normalizeUploadVariantPresetKeys",
  "normalizeVariants",
  "path",
  "persistUploadEntryFromStaging",
  "primaryAppOrigin",
  "publicUploadsDir",
  "readUploadStorageProvider",
  "resolveUploadAbsolutePath",
  "sanitizeUploadSlot",
  "uploadStorageService",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[upload-entries-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(`[upload-entries-runtime] ${dependencyName} getter must be a function`);
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(`[upload-entries-runtime] ${dependencyName} getter must resolve to a function`);
};

export const createUploadEntriesRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    STATIC_DEFAULT_CACHE_CONTROL,
    attachUploadMediaMetadata,
    buildDiskStorageAreaSummary,
    buildStorageAreaSummary,
    cleanupUploadStagingWorkspace,
    createUploadStagingWorkspace,
    crypto,
    deriveFocalPointsFromCrops,
    fs,
    getLoadUploads,
    getPrimaryFocalPoint,
    getUploadVariantUrlPrefix,
    getWriteUploads,
    materializeUploadEntrySourceToStaging,
    mergeUploadVariantPresetKeys,
    normalizeFocalCrops,
    normalizeFocalPoints,
    normalizeUploadStorageProvider,
    normalizeUploadVariantPresetKeys,
    normalizeVariants,
    path,
    persistUploadEntryFromStaging,
    primaryAppOrigin,
    publicUploadsDir,
    readUploadStorageProvider,
    resolveUploadAbsolutePath,
    sanitizeUploadSlot,
    uploadStorageService,
  } = dependencies;

  const hasOwnField = (value, key) =>
    Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

  const readUploadFocalState = (value) => {
    const focalCrops = normalizeFocalCrops(value?.focalCrops, undefined, {
      sourceWidth: value?.width,
      sourceHeight: value?.height,
      fallbackPoints: value?.focalPoints,
      fallbackPoint: value?.focalPoint,
    });
    const focalPoints = deriveFocalPointsFromCrops(focalCrops);
    return {
      focalCrops,
      focalPoints,
      focalPoint: getPrimaryFocalPoint(focalPoints),
    };
  };

  const readUploadAltText = (value) => String(value?.altText || "").trim();
  const readUploadSlot = (value) => sanitizeUploadSlot(value?.slot);
  const readUploadSlotManaged = (value) =>
    hasOwnField(value, "slotManaged") ? value?.slotManaged === true : undefined;

  const resolveIncomingUploadFocalState = (incoming, current) => {
    if (hasOwnField(incoming, "focalCrops")) {
      const focalCrops = normalizeFocalCrops(incoming.focalCrops, current?.focalCrops, {
        sourceWidth: current?.width,
        sourceHeight: current?.height,
        fallbackPoints: current?.focalPoints,
        fallbackPoint: current?.focalPoint,
      });
      const focalPoints = deriveFocalPointsFromCrops(focalCrops);
      return {
        focalCrops,
        focalPoints,
        focalPoint: getPrimaryFocalPoint(focalPoints),
      };
    }
    if (hasOwnField(incoming, "focalPoints")) {
      const focalPoints = normalizeFocalPoints(
        incoming.focalPoints,
        current?.focalPoints ?? current?.focalPoint,
      );
      const focalCrops = normalizeFocalCrops(undefined, undefined, {
        sourceWidth: current?.width,
        sourceHeight: current?.height,
        fallbackPoints: focalPoints,
      });
      return {
        focalCrops,
        focalPoints,
        focalPoint: getPrimaryFocalPoint(focalPoints),
      };
    }
    if (hasOwnField(incoming, "focalPoint")) {
      const focalPoints = normalizeFocalPoints(incoming.focalPoint);
      const focalCrops = normalizeFocalCrops(undefined, undefined, {
        sourceWidth: current?.width,
        sourceHeight: current?.height,
        fallbackPoints: focalPoints,
      });
      return {
        focalCrops,
        focalPoints,
        focalPoint: getPrimaryFocalPoint(focalPoints),
      };
    }
    return readUploadFocalState(current);
  };

  const extractRequestedUploadFocalPayload = (value) => {
    const body = value && typeof value === "object" ? value : {};
    if (hasOwnField(body, "focalCrops")) {
      return { focalCrops: body.focalCrops };
    }
    if (hasOwnField(body, "focalPoints")) {
      return { focalPoints: body.focalPoints };
    }
    if (hasOwnField(body, "focalPoint")) {
      return { focalPoint: body.focalPoint };
    }
    if (hasOwnField(body, "x") || hasOwnField(body, "y")) {
      return { focalPoint: body };
    }
    return {};
  };

  const PRIVATE_UPLOAD_FOLDERS = new Set(["downloads", "socials", "users"]);

  const getUploadRootSegment = (value) => {
    if (!value) {
      return "";
    }
    const normalized = String(value).replace(/^\/+/, "");
    const [root] = normalized.split(/[\\/]/);
    return String(root || "").toLowerCase();
  };

  const isPrivateUploadFolder = (value) => PRIVATE_UPLOAD_FOLDERS.has(getUploadRootSegment(value));

  const normalizeUploadUrlValue = (value) => {
    if (!value || typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("/uploads/")) {
      return trimmed.split("?")[0].split("#")[0];
    }
    try {
      const parsed = new URL(trimmed, primaryAppOrigin);
      if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
        return parsed.pathname;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const getUploadFolderFromUrlValue = (value) => {
    const normalized = normalizeUploadUrlValue(value);
    if (!normalized) {
      return "";
    }
    const relative = normalized.replace(/^\/uploads\//, "");
    const lastSlash = relative.lastIndexOf("/");
    if (lastSlash < 0) {
      return "";
    }
    return relative.slice(0, lastSlash);
  };

  const deleteManagedUploadEntryAssets = async (entry, providerOverride) => {
    const currentEntry = entry && typeof entry === "object" ? entry : null;
    if (!currentEntry) {
      return;
    }
    const provider = normalizeUploadStorageProvider(
      providerOverride || readUploadStorageProvider(currentEntry, "local"),
      uploadStorageService.activeProvider,
    );
    try {
      await uploadStorageService.deleteUpload({
        provider,
        uploadUrl: currentEntry.url,
      });
    } catch {
      // best-effort delete
    }
    const variantPrefix = getUploadVariantUrlPrefix(currentEntry);
    if (!variantPrefix) {
      return;
    }
    try {
      await uploadStorageService.deleteUploadPrefix({
        provider,
        uploadUrlPrefix: variantPrefix,
      });
    } catch {
      // best-effort delete
    }
  };

  const buildManagedStorageAreaSummary = (uploads) => {
    const allUploads = Array.isArray(uploads) ? uploads : [];
    const localUploads = allUploads.filter(
      (entry) => readUploadStorageProvider(entry, "local") === "local",
    );
    const remoteUploads = allUploads.filter(
      (entry) => readUploadStorageProvider(entry, "local") === "s3",
    );
    const localSummary = buildDiskStorageAreaSummary({
      uploads: localUploads,
      uploadsDir: publicUploadsDir,
    });
    const remoteSummary = buildStorageAreaSummary(remoteUploads);
    const areasMap = new Map();

    const mergeRows = (rows) => {
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const area = String(row?.area || "root");
        const current = areasMap.get(area) || {
          area,
          originalBytes: 0,
          variantBytes: 0,
          totalBytes: 0,
          originalFiles: 0,
          variantFiles: 0,
          totalFiles: 0,
        };
        areasMap.set(area, {
          area,
          originalBytes: current.originalBytes + Number(row?.originalBytes || 0),
          variantBytes: current.variantBytes + Number(row?.variantBytes || 0),
          totalBytes: current.totalBytes + Number(row?.totalBytes || 0),
          originalFiles: current.originalFiles + Number(row?.originalFiles || 0),
          variantFiles: current.variantFiles + Number(row?.variantFiles || 0),
          totalFiles: current.totalFiles + Number(row?.totalFiles || 0),
        });
      });
    };

    mergeRows(localSummary?.areas);
    mergeRows(remoteSummary?.areas);

    const areas = Array.from(areasMap.values()).sort((left, right) => {
      if (left.totalBytes !== right.totalBytes) {
        return right.totalBytes - left.totalBytes;
      }
      return String(left.area || "").localeCompare(String(right.area || ""), "en");
    });
    const totals = areas.reduce(
      (acc, item) => ({
        area: "total",
        originalBytes: acc.originalBytes + Number(item?.originalBytes || 0),
        variantBytes: acc.variantBytes + Number(item?.variantBytes || 0),
        totalBytes: acc.totalBytes + Number(item?.totalBytes || 0),
        originalFiles: acc.originalFiles + Number(item?.originalFiles || 0),
        variantFiles: acc.variantFiles + Number(item?.variantFiles || 0),
        totalFiles: acc.totalFiles + Number(item?.totalFiles || 0),
      }),
      {
        area: "total",
        originalBytes: 0,
        variantBytes: 0,
        totalBytes: 0,
        originalFiles: 0,
        variantFiles: 0,
        totalFiles: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      totals,
      areas,
    };
  };

  const upsertUploadEntries = (incomingEntries) => {
    const loadUploads = resolveLazyDependency("getLoadUploads", getLoadUploads);
    const writeUploads = resolveLazyDependency("getWriteUploads", getWriteUploads);
    if (!Array.isArray(incomingEntries) || incomingEntries.length === 0) {
      return { changed: false, uploads: loadUploads() };
    }
    const existingUploads = loadUploads();
    const byUrl = new Map(
      existingUploads.filter((item) => item?.url).map((item) => [String(item.url), item]),
    );
    let changed = false;
    incomingEntries.forEach((entry) => {
      const nextUrl = String(entry?.url || "").trim();
      if (!nextUrl || !nextUrl.startsWith("/uploads/")) {
        return;
      }
      const current = byUrl.get(nextUrl);
      const focalState = resolveIncomingUploadFocalState(entry, current);
      const next = {
        ...(current || {}),
        ...entry,
        id: current?.id || entry?.id || crypto.randomUUID(),
        url: nextUrl,
        fileName: String(entry?.fileName || current?.fileName || ""),
        folder: String(entry?.folder || current?.folder || ""),
        storageProvider: readUploadStorageProvider(
          entry,
          readUploadStorageProvider(current, "local"),
        ),
        size: Number.isFinite(entry?.size) ? Number(entry.size) : (current?.size ?? null),
        mime: String(entry?.mime || current?.mime || ""),
        width: Number.isFinite(entry?.width) ? Number(entry.width) : (current?.width ?? null),
        height: Number.isFinite(entry?.height) ? Number(entry.height) : (current?.height ?? null),
        area: String(entry?.area || current?.area || ""),
        hashSha256: String(entry?.hashSha256 || current?.hashSha256 || ""),
        altText: readUploadAltText(entry) || readUploadAltText(current),
        focalCrops: focalState.focalCrops,
        focalPoints: focalState.focalPoints,
        focalPoint: focalState.focalPoint,
        variantsVersion: Number.isFinite(Number(entry?.variantsVersion))
          ? Number(entry.variantsVersion)
          : Number.isFinite(Number(current?.variantsVersion))
            ? Number(current.variantsVersion)
            : 1,
        variants: normalizeVariants(
          entry?.variants && typeof entry.variants === "object"
            ? entry.variants
            : current?.variants && typeof current.variants === "object"
              ? current.variants
              : {},
        ),
        variantBytes: Number.isFinite(Number(entry?.variantBytes))
          ? Number(entry.variantBytes)
          : Number.isFinite(Number(current?.variantBytes))
            ? Number(current.variantBytes)
            : 0,
        createdAt: String(entry?.createdAt || current?.createdAt || new Date().toISOString()),
      };
      if (JSON.stringify(current || null) !== JSON.stringify(next)) {
        changed = true;
      }
      byUrl.set(nextUrl, next);
    });
    if (!changed) {
      return { changed: false, uploads: existingUploads };
    }
    const nextUploads = Array.from(byUrl.values()).sort((a, b) =>
      String(a.url || "").localeCompare(String(b.url || ""), "en"),
    );
    writeUploads(nextUploads);
    return { changed: true, uploads: nextUploads };
  };

  const ensureUploadEntryHasRequiredVariants = async ({
    uploads,
    uploadsDir,
    entry,
    sourceMime,
    hashSha256,
    requiredVariantPresetKeys,
  } = {}) => {
    const writeUploads = resolveLazyDependency("getWriteUploads", getWriteUploads);
    const currentEntry = entry && typeof entry === "object" ? entry : null;
    if (!currentEntry) {
      return { entry, uploads: Array.isArray(uploads) ? uploads : [], changed: false };
    }
    const currentVariantPresetKeys = normalizeUploadVariantPresetKeys(
      Object.keys(normalizeVariants(currentEntry?.variants)),
    );
    const requestedVariantPresetKeys = normalizeUploadVariantPresetKeys(requiredVariantPresetKeys);
    if (
      requestedVariantPresetKeys.length === 0 ||
      requestedVariantPresetKeys.every((presetKey) => currentVariantPresetKeys.includes(presetKey))
    ) {
      return {
        entry: currentEntry,
        uploads: Array.isArray(uploads) ? uploads : [],
        changed: false,
      };
    }
    const mergedVariantPresetKeys = mergeUploadVariantPresetKeys(
      currentVariantPresetKeys,
      requestedVariantPresetKeys,
    );

    try {
      const currentProvider = readUploadStorageProvider(currentEntry, "local");
      let stagingWorkspace = null;
      let stagingUploadsDir = uploadsDir;
      let sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: currentEntry?.url });
      try {
        if (currentProvider !== "local" || !sourcePath || !fs.existsSync(sourcePath)) {
          stagingWorkspace = createUploadStagingWorkspace();
          stagingUploadsDir = stagingWorkspace.uploadsDir;
          const materialized = await materializeUploadEntrySourceToStaging({
            storageService: uploadStorageService,
            entry: currentEntry,
            uploadsDir: stagingUploadsDir,
          });
          sourcePath = materialized.sourcePath;
        }

        const updatedEntry = await attachUploadMediaMetadata({
          uploadsDir: stagingUploadsDir,
          entry: {
            ...currentEntry,
            storageProvider: currentProvider,
          },
          sourcePath,
          sourceMime: sourceMime || currentEntry?.mime,
          hashSha256,
          variantsVersion: Math.max(1, Number(currentEntry?.variantsVersion || 1)),
          regenerateVariants: true,
          variantPresetKeys: mergedVariantPresetKeys,
        });
        if (currentProvider !== "local") {
          await persistUploadEntryFromStaging({
            storageService: uploadStorageService,
            entry: updatedEntry,
            uploadsDir: stagingUploadsDir,
            provider: currentProvider,
            cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
          });
        }
        if (JSON.stringify(updatedEntry) === JSON.stringify(currentEntry)) {
          return {
            entry: updatedEntry,
            uploads: Array.isArray(uploads) ? uploads : [],
            changed: false,
          };
        }
        const nextUploads = (Array.isArray(uploads) ? uploads : []).map((item) =>
          String(item?.id || "") === String(currentEntry?.id || "") ? updatedEntry : item,
        );
        writeUploads(nextUploads);
        return { entry: updatedEntry, uploads: nextUploads, changed: true };
      } finally {
        cleanupUploadStagingWorkspace(stagingWorkspace);
      }
    } catch {
      return {
        entry: currentEntry,
        uploads: Array.isArray(uploads) ? uploads : [],
        changed: false,
      };
    }
  };

  const deletePrivateUploadByUrl = (value) => {
    const loadUploads = resolveLazyDependency("getLoadUploads", getLoadUploads);
    const writeUploads = resolveLazyDependency("getWriteUploads", getWriteUploads);
    try {
      const normalized = normalizeUploadUrlValue(value);
      if (!normalized) {
        return;
      }
      const relativePath = normalized.replace(/^\/uploads\//, "");
      if (!isPrivateUploadFolder(relativePath)) {
        return;
      }
      const targetPath = path.join(publicUploadsDir, relativePath);
      const resolved = path.resolve(targetPath);
      if (!resolved.startsWith(path.resolve(publicUploadsDir))) {
        return;
      }
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
      const uploads = loadUploads();
      const nextUploads = uploads.filter((item) => item.url !== normalized);
      if (nextUploads.length !== uploads.length) {
        writeUploads(nextUploads);
      }
    } catch {
      // ignore cleanup errors
    }
  };

  return {
    buildManagedStorageAreaSummary,
    deleteManagedUploadEntryAssets,
    deletePrivateUploadByUrl,
    ensureUploadEntryHasRequiredVariants,
    extractRequestedUploadFocalPayload,
    getUploadFolderFromUrlValue,
    hasOwnField,
    isPrivateUploadFolder,
    normalizeUploadUrlValue,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    resolveIncomingUploadFocalState,
    upsertUploadEntries,
  };
};

export default createUploadEntriesRuntime;
