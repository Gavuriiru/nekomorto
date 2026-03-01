import fs from "fs";
import path from "path";
import { buildStorageAreaSummary, deriveUploadArea, normalizeVariants } from "./upload-media.js";
import { extractUploadUrlsFromText, normalizeUploadUrl } from "./uploads-reorganizer.js";

const DATASETS_TO_SCAN = [
  "siteSettings",
  "posts",
  "projects",
  "users",
  "pages",
  "comments",
  "updates",
];

const VARIANTS_ROOT_SEGMENT = "_variants";
const SAFE_ORIGIN = "https://nekomata.local";

const EMPTY_TOTALS = Object.freeze({
  area: "total",
  originalBytes: 0,
  variantBytes: 0,
  totalBytes: 0,
  originalFiles: 0,
  variantFiles: 0,
  totalFiles: 0,
});

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const isPathInsideRoot = (rootPath, targetPath) => {
  const safeRoot = path.resolve(rootPath);
  const safeTarget = path.resolve(targetPath);
  const relative = path.relative(safeRoot, safeTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const normalizeStorageAreaRow = (value, fallbackArea = "root") => ({
  ...EMPTY_TOTALS,
  ...(value && typeof value === "object" ? value : {}),
  area: String(value?.area || fallbackArea),
});

const getUploadFileName = (upload, normalizedUrl) => {
  const explicitName = String(upload?.fileName || "").trim();
  if (explicitName) {
    return explicitName;
  }
  if (!normalizedUrl.startsWith("/uploads/")) {
    return "";
  }
  return path.posix.basename(normalizedUrl.replace(/^\/uploads\//, ""));
};

const isVariantUploadUrl = (value) => String(value || "").startsWith(`/uploads/${VARIANTS_ROOT_SEGMENT}/`);

const resolveUploadPathFromUrl = ({ uploadsDir, uploadUrl }) => {
  const trimmed = String(uploadUrl || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, SAFE_ORIGIN);
    const decodedPathname = decodeURIComponent(parsed.pathname || "");
    if (!decodedPathname.startsWith("/uploads/")) {
      return null;
    }
    const relativePath = decodedPathname.replace(/^\/uploads\//, "");
    const absolutePath = path.resolve(path.join(uploadsDir, relativePath));
    if (!isPathInsideRoot(uploadsDir, absolutePath)) {
      return null;
    }
    return absolutePath;
  } catch {
    return null;
  }
};

const collectReferencedUploadUrls = (value, urls) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const direct = normalizeUploadUrl(value);
    if (direct) {
      urls.add(direct);
    }
    extractUploadUrlsFromText(value).forEach((item) => {
      urls.add(item);
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferencedUploadUrls(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectReferencedUploadUrls(item, urls));
  }
};

const getManagedUploads = (uploads) =>
  (Array.isArray(uploads) ? uploads : []).filter((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    return Boolean(normalizedUrl) && !isVariantUploadUrl(normalizedUrl);
  });

const collectUnusedUploadCandidates = (datasets) => {
  const referencedUrls = new Set();
  DATASETS_TO_SCAN.forEach((datasetKey) => {
    collectReferencedUploadUrls(datasets?.[datasetKey], referencedUrls);
  });

  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  const managedUploads = getManagedUploads(uploads);
  const unusedUploadCandidates = managedUploads.filter((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    return Boolean(normalizedUrl) && !referencedUrls.has(normalizedUrl);
  });

  return {
    uploads,
    managedUploads,
    referencedUrls,
    unusedUploadCandidates,
    unusedUploadIds: new Set(
      unusedUploadCandidates
        .map((upload) => String(upload?.id || "").trim())
        .filter(Boolean),
    ),
  };
};

const resolveVariantUploadPrefixes = (uploadId) => {
  const encoded = encodeURIComponent(String(uploadId || ""));
  const raw = String(uploadId || "");
  return new Set([`/uploads/${VARIANTS_ROOT_SEGMENT}/${encoded}/`, `/uploads/${VARIANTS_ROOT_SEGMENT}/${raw}/`]);
};

const collectExpectedVariantFilesByUploadId = (uploads, uploadsDir) => {
  const expectedFilesByUploadId = new Map();

  getManagedUploads(uploads).forEach((upload) => {
    const uploadId = String(upload?.id || "").trim();
    if (!uploadId) {
      return;
    }

    const expectedFiles = new Set();
    const validPrefixes = resolveVariantUploadPrefixes(uploadId);
    const variants = normalizeVariants(upload?.variants);

    Object.values(variants).forEach((record) => {
      const formats = record?.formats && typeof record.formats === "object" ? record.formats : {};
      Object.values(formats).forEach((format) => {
        const normalizedUrl = normalizeUploadUrl(format?.url);
        if (!normalizedUrl) {
          return;
        }
        const matchesUploadDir = Array.from(validPrefixes).some((prefix) => normalizedUrl.startsWith(prefix));
        if (!matchesUploadDir) {
          return;
        }
        const absolutePath = resolveUploadPathFromUrl({
          uploadsDir,
          uploadUrl: normalizedUrl,
        });
        if (!absolutePath) {
          return;
        }
        expectedFiles.add(absolutePath);
      });
    });

    expectedFilesByUploadId.set(uploadId, expectedFiles);
  });

  return expectedFilesByUploadId;
};

const scanVariantFilesRecursive = ({ absoluteDir, relativeDir, variantDirUploadId }) => {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const nextAbsolute = path.join(absoluteDir, entry.name);
    const nextRelative = toPosix(path.join(relativeDir, entry.name));

    if (entry.isDirectory()) {
      files.push(
        ...scanVariantFilesRecursive({
          absoluteDir: nextAbsolute,
          relativeDir: nextRelative,
          variantDirUploadId,
        }),
      );
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    const stat = fs.statSync(nextAbsolute);
    files.push({
      variantDirUploadId,
      absolutePath: nextAbsolute,
      relativePath: nextRelative,
      url: `/uploads/${nextRelative}`,
      fileName: entry.name,
      folder: toPosix(path.posix.dirname(nextRelative)).replace(/^\.$/, ""),
      area: VARIANTS_ROOT_SEGMENT,
      bytes: Number(stat.size || 0),
      createdAt: stat.mtime?.toISOString?.() || null,
    });
  });

  return files.sort((left, right) => String(left.url || "").localeCompare(String(right.url || ""), "en"));
};

const scanVariantDirectoryEntries = (variantsRootDir, uploadsDir) => {
  if (!fs.existsSync(variantsRootDir)) {
    return [];
  }

  return fs
    .readdirSync(variantsRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const absoluteDir = path.join(variantsRootDir, entry.name);
      const relativeDir = toPosix(path.join(VARIANTS_ROOT_SEGMENT, entry.name));
      const files = scanVariantFilesRecursive({
        absoluteDir,
        relativeDir,
        variantDirUploadId: entry.name,
      });

      return {
        variantDirUploadId: entry.name,
        absoluteDir,
        relativeDir,
        url: `/uploads/${relativeDir}`,
        files,
        totalBytes: files.reduce((sum, item) => sum + Number(item.bytes || 0), 0),
      };
    })
    .sort((left, right) =>
      String(left.variantDirUploadId || "").localeCompare(String(right.variantDirUploadId || ""), "en"),
    );
};

const collectOrphanedVariantCandidates = ({ uploads, uploadsDir, ignoredUploadIds = new Set() }) => {
  const variantsRootDir = path.join(uploadsDir, VARIANTS_ROOT_SEGMENT);
  const activeUploads = getManagedUploads(uploads);
  const activeUploadIds = new Set(
    activeUploads
      .map((upload) => String(upload?.id || "").trim())
      .filter(Boolean),
  );
  const expectedFilesByUploadId = collectExpectedVariantFilesByUploadId(activeUploads, uploadsDir);
  const orphanedVariantCandidates = [];
  const orphanedVariantDirectoryGroups = [];

  scanVariantDirectoryEntries(variantsRootDir, uploadsDir).forEach((directoryEntry) => {
    const variantDirUploadId = String(directoryEntry.variantDirUploadId || "").trim();
    if (!variantDirUploadId || ignoredUploadIds.has(variantDirUploadId)) {
      return;
    }

    if (!activeUploadIds.has(variantDirUploadId)) {
      orphanedVariantDirectoryGroups.push({
        variantDirUploadId,
        absoluteDir: directoryEntry.absoluteDir,
        relativeDir: directoryEntry.relativeDir,
        url: directoryEntry.url,
        fileCount: directoryEntry.files.length,
        totalBytes: directoryEntry.totalBytes,
        files: directoryEntry.files.map((file) => ({
          kind: "variant",
          scope: "orphaned_variant",
          ownerUploadId: null,
          ...file,
        })),
      });
      orphanedVariantCandidates.push(
        ...directoryEntry.files.map((file) => ({
          kind: "variant",
          scope: "orphaned_variant",
          ownerUploadId: null,
          ...file,
        })),
      );
      return;
    }

    const expectedFiles = expectedFilesByUploadId.get(variantDirUploadId) || new Set();
    directoryEntry.files.forEach((file) => {
      if (expectedFiles.has(file.absolutePath)) {
        return;
      }
      orphanedVariantCandidates.push({
        kind: "variant",
        scope: "orphaned_variant",
        ownerUploadId: variantDirUploadId,
        ...file,
      });
    });
  });

  return {
    orphanedVariantCandidates: orphanedVariantCandidates.sort((left, right) =>
      String(left.url || "").localeCompare(String(right.url || ""), "en"),
    ),
    orphanedVariantDirectoryGroups,
    orphanedVariantFilesCount: orphanedVariantCandidates.length,
    orphanedVariantDirsCount: orphanedVariantDirectoryGroups.length,
  };
};

const buildOrphanedVariantSummary = (orphanedVariantCandidates) => {
  const totals = {
    area: "total",
    originalBytes: 0,
    variantBytes: 0,
    totalBytes: 0,
    originalFiles: 0,
    variantFiles: 0,
    totalFiles: 0,
  };

  (Array.isArray(orphanedVariantCandidates) ? orphanedVariantCandidates : []).forEach((candidate) => {
    const bytes = Number(candidate?.bytes || 0);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return;
    }
    totals.variantBytes += bytes;
    totals.totalBytes += bytes;
    totals.variantFiles += 1;
    totals.totalFiles += 1;
  });

  if (totals.variantFiles === 0) {
    return {
      totals,
      areas: [],
    };
  }

  return {
    totals,
    areas: [
      {
        area: VARIANTS_ROOT_SEGMENT,
        originalBytes: 0,
        variantBytes: totals.variantBytes,
        totalBytes: totals.totalBytes,
        originalFiles: 0,
        variantFiles: totals.variantFiles,
        totalFiles: totals.totalFiles,
      },
    ],
  };
};

const sortStorageAreaRows = (rows) =>
  [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    if (left.totalBytes !== right.totalBytes) {
      return right.totalBytes - left.totalBytes;
    }
    return String(left.area || "").localeCompare(String(right.area || ""), "en");
  });

const sumStorageAreaRows = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => ({
      area: "total",
      originalBytes: acc.originalBytes + Number(row?.originalBytes || 0),
      variantBytes: acc.variantBytes + Number(row?.variantBytes || 0),
      totalBytes: acc.totalBytes + Number(row?.totalBytes || 0),
      originalFiles: acc.originalFiles + Number(row?.originalFiles || 0),
      variantFiles: acc.variantFiles + Number(row?.variantFiles || 0),
      totalFiles: acc.totalFiles + Number(row?.totalFiles || 0),
    }),
    { ...EMPTY_TOTALS },
  );

const mergeStorageAreaRow = (areasMap, row, fallbackArea = "root") => {
  const normalized = normalizeStorageAreaRow(row, fallbackArea);
  const key = String(normalized.area || fallbackArea);
  const current = areasMap.get(key) || normalizeStorageAreaRow({ area: key }, key);

  areasMap.set(key, {
    area: key,
    originalBytes: current.originalBytes + normalized.originalBytes,
    variantBytes: current.variantBytes + normalized.variantBytes,
    totalBytes: current.totalBytes + normalized.totalBytes,
    originalFiles: current.originalFiles + normalized.originalFiles,
    variantFiles: current.variantFiles + normalized.variantFiles,
    totalFiles: current.totalFiles + normalized.totalFiles,
  });
};

const mergeStorageSummaries = (...summaries) => {
  const areasMap = new Map();

  const addArea = (row) => {
    mergeStorageAreaRow(areasMap, row, String(row?.area || "root"));
  };

  summaries.forEach((summary) => {
    (Array.isArray(summary?.areas) ? summary.areas : []).forEach((row) => addArea(row));
  });

  const areas = sortStorageAreaRows(Array.from(areasMap.values()));
  const totals = sumStorageAreaRows(areas);

  return {
    totals,
    areas,
  };
};

const buildUploadCleanupExample = (upload) => {
  const normalizedUrl = normalizeUploadUrl(upload?.url) || String(upload?.url || "").trim();
  const summary = buildStorageAreaSummary([upload]);
  const totals = normalizeStorageAreaRow(summary?.totals, "total");
  const folder = String(upload?.folder || "").trim();
  const area = String(upload?.area || folder.split("/")[0] || "root");

  return {
    kind: "upload",
    scope: "unused_upload",
    id: upload?.id ? String(upload.id) : null,
    ownerUploadId: null,
    url: normalizedUrl,
    fileName: getUploadFileName(upload, normalizedUrl),
    folder,
    area,
    createdAt: upload?.createdAt ? String(upload.createdAt) : null,
    originalBytes: totals.originalBytes,
    variantBytes: totals.variantBytes,
    totalBytes: totals.totalBytes,
  };
};

const buildVariantCleanupExample = (candidate) => ({
  kind: "variant",
  scope: "orphaned_variant",
  id: null,
  ownerUploadId: candidate?.ownerUploadId ? String(candidate.ownerUploadId) : null,
  url: String(candidate?.url || ""),
  fileName: String(candidate?.fileName || ""),
  folder: String(candidate?.folder || ""),
  area: String(candidate?.area || VARIANTS_ROOT_SEGMENT),
  createdAt: candidate?.createdAt ? String(candidate.createdAt) : null,
  originalBytes: 0,
  variantBytes: Number(candidate?.bytes || 0),
  totalBytes: Number(candidate?.bytes || 0),
});

const buildCombinedCleanupExamples = ({
  unusedUploadCandidates,
  orphanedVariantCandidates,
  exampleLimit,
}) => {
  const safeLimitRaw = Number(exampleLimit);
  const safeLimit = Number.isFinite(safeLimitRaw) ? Math.max(0, Math.floor(safeLimitRaw)) : 8;
  if (safeLimit === 0) {
    return [];
  }

  return [
    ...(Array.isArray(unusedUploadCandidates) ? unusedUploadCandidates : []).map((upload) =>
      buildUploadCleanupExample(upload),
    ),
    ...(Array.isArray(orphanedVariantCandidates) ? orphanedVariantCandidates : []).map((candidate) =>
      buildVariantCleanupExample(candidate),
    ),
  ]
    .sort((left, right) => {
      if (left.totalBytes !== right.totalBytes) {
        return right.totalBytes - left.totalBytes;
      }
      return String(left.url || "").localeCompare(String(right.url || ""), "en");
    })
    .slice(0, safeLimit);
};

const buildCleanupReportBase = ({
  unusedUploadCandidates,
  orphanedVariantCandidates,
  orphanedVariantDirsCount,
  exampleLimit,
}) => {
  const unusedUploadSummary = buildStorageAreaSummary(unusedUploadCandidates);
  const orphanedVariantSummary = buildOrphanedVariantSummary(orphanedVariantCandidates);
  const mergedSummary = mergeStorageSummaries(unusedUploadSummary, orphanedVariantSummary);
  const unusedUploadCount = Array.isArray(unusedUploadCandidates) ? unusedUploadCandidates.length : 0;

  return {
    generatedAt: new Date().toISOString(),
    unusedCount: unusedUploadCount,
    unusedUploadCount,
    orphanedVariantFilesCount: Array.isArray(orphanedVariantCandidates) ? orphanedVariantCandidates.length : 0,
    orphanedVariantDirsCount: Number(orphanedVariantDirsCount || 0),
    totals: normalizeStorageAreaRow(mergedSummary.totals, "total"),
    areas: mergedSummary.areas.map((item) => normalizeStorageAreaRow(item, String(item?.area || "root"))),
    examples: buildCombinedCleanupExamples({
      unusedUploadCandidates,
      orphanedVariantCandidates,
      exampleLimit,
    }),
  };
};

const pruneEmptyVariantDirectories = (directoryPath, variantsRootDir) => {
  const safeVariantsRoot = path.resolve(variantsRootDir);
  const safeDirectoryPath = path.resolve(directoryPath);

  if (!isPathInsideRoot(safeVariantsRoot, safeDirectoryPath) || !fs.existsSync(safeDirectoryPath)) {
    return;
  }

  const prune = (currentPath) => {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    entries
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        prune(path.join(currentPath, entry.name));
      });

    if (path.resolve(currentPath) === safeVariantsRoot || !fs.existsSync(currentPath)) {
      return;
    }

    if (fs.readdirSync(currentPath).length === 0) {
      fs.rmdirSync(currentPath);
    }
  };

  prune(safeDirectoryPath);
};

const createRewrittenDatasets = (datasets, nextUploads) => ({
  ...(datasets && typeof datasets === "object" ? datasets : {}),
  uploads: nextUploads,
});

const scanOriginalUploadFilesRecursive = ({ absoluteDir, relativeDir = "" }) => {
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const nextAbsolute = path.join(absoluteDir, entry.name);
    const nextRelative = relativeDir ? toPosix(path.join(relativeDir, entry.name)) : entry.name;

    if (entry.isDirectory()) {
      if (!relativeDir && entry.name === VARIANTS_ROOT_SEGMENT) {
        return;
      }
      files.push(...scanOriginalUploadFilesRecursive({ absoluteDir: nextAbsolute, relativeDir: nextRelative }));
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    const stat = fs.statSync(nextAbsolute);
    files.push({
      absolutePath: nextAbsolute,
      relativePath: toPosix(nextRelative),
      bytes: Number(stat.size || 0),
    });
  });

  return files.sort((left, right) =>
    String(left.relativePath || "").localeCompare(String(right.relativePath || ""), "en"),
  );
};

const deriveOriginalAreaFromRelativePath = (relativePath) => {
  const normalized = toPosix(relativePath).replace(/^\/+/, "");
  const folder = path.posix.dirname(normalized).replace(/^\.$/, "");
  return deriveUploadArea(folder);
};

const scanLooseVariantFiles = (variantsRootDir) => {
  if (!fs.existsSync(variantsRootDir)) {
    return [];
  }

  return fs
    .readdirSync(variantsRootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(variantsRootDir, entry.name);
      const stat = fs.statSync(absolutePath);
      return {
        absolutePath,
        relativePath: toPosix(path.join(VARIANTS_ROOT_SEGMENT, entry.name)),
        bytes: Number(stat.size || 0),
      };
    })
    .sort((left, right) =>
      String(left.relativePath || "").localeCompare(String(right.relativePath || ""), "en"),
    );
};

export const buildDiskStorageAreaSummary = ({
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
} = {}) => {
  const uploadsRootDir = path.resolve(uploadsDir);
  const variantsRootDir = path.join(uploadsRootDir, VARIANTS_ROOT_SEGMENT);
  const managedUploads = getManagedUploads(uploads);
  const uploadsById = new Map(
    managedUploads
      .map((upload) => [String(upload?.id || "").trim(), upload])
      .filter(([uploadId]) => Boolean(uploadId)),
  );
  const areasMap = new Map();

  scanOriginalUploadFilesRecursive({ absoluteDir: uploadsRootDir }).forEach((file) => {
    const bytes = Number(file?.bytes || 0);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return;
    }

    const area = deriveOriginalAreaFromRelativePath(file.relativePath);
    mergeStorageAreaRow(
      areasMap,
      {
        area,
        originalBytes: bytes,
        variantBytes: 0,
        totalBytes: bytes,
        originalFiles: 1,
        variantFiles: 0,
        totalFiles: 1,
      },
      area,
    );
  });

  scanVariantDirectoryEntries(variantsRootDir, uploadsRootDir).forEach((directoryEntry) => {
    const variantDirUploadId = String(directoryEntry?.variantDirUploadId || "").trim();
    const ownerUpload = uploadsById.get(variantDirUploadId);
    const area = ownerUpload
      ? deriveUploadArea(ownerUpload?.area || ownerUpload?.folder || "")
      : VARIANTS_ROOT_SEGMENT;
    const variantFiles = Array.isArray(directoryEntry?.files) ? directoryEntry.files.length : 0;
    const variantBytes = Number(directoryEntry?.totalBytes || 0);
    if (!Number.isFinite(variantBytes) || variantBytes < 0) {
      return;
    }

    mergeStorageAreaRow(
      areasMap,
      {
        area,
        originalBytes: 0,
        variantBytes,
        totalBytes: variantBytes,
        originalFiles: 0,
        variantFiles,
        totalFiles: variantFiles,
      },
      area,
    );
  });

  scanLooseVariantFiles(variantsRootDir).forEach((file) => {
    const bytes = Number(file?.bytes || 0);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return;
    }

    mergeStorageAreaRow(
      areasMap,
      {
        area: VARIANTS_ROOT_SEGMENT,
        originalBytes: 0,
        variantBytes: bytes,
        totalBytes: bytes,
        originalFiles: 0,
        variantFiles: 1,
        totalFiles: 1,
      },
      VARIANTS_ROOT_SEGMENT,
    );
  });

  const areas = sortStorageAreaRows(Array.from(areasMap.values()));
  const totals = sumStorageAreaRows(areas);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    areas,
  };
};

const sortFailures = (failures) =>
  [...(Array.isArray(failures) ? failures : [])].sort((left, right) => {
    const urlOrder = String(left?.url || "").localeCompare(String(right?.url || ""), "en");
    if (urlOrder !== 0) {
      return urlOrder;
    }
    return String(left?.kind || "").localeCompare(String(right?.kind || ""), "en");
  });

export const runUploadsCleanup = ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  applyChanges = false,
  exampleLimit = 8,
} = {}) => {
  const uploadsRootDir = path.resolve(uploadsDir);
  const variantsRootDir = path.resolve(path.join(uploadsDir, VARIANTS_ROOT_SEGMENT));
  const { uploads, unusedUploadCandidates, unusedUploadIds } = collectUnusedUploadCandidates(datasets);
  const {
    orphanedVariantCandidates,
    orphanedVariantDirectoryGroups,
    orphanedVariantFilesCount,
    orphanedVariantDirsCount,
  } = collectOrphanedVariantCandidates({
    uploads,
    uploadsDir,
    ignoredUploadIds: unusedUploadIds,
  });
  const reportBase = buildCleanupReportBase({
    unusedUploadCandidates,
    orphanedVariantCandidates,
    orphanedVariantDirsCount,
    exampleLimit,
  });

  if (!applyChanges) {
    return {
      mode: "dry-run",
      ...reportBase,
      rewritten: createRewrittenDatasets(datasets, uploads),
      changed: false,
      deletedCount: 0,
      deletedUnusedUploadsCount: 0,
      deletedOrphanedVariantFilesCount: 0,
      deletedOrphanedVariantDirsCount: 0,
      failedCount: 0,
      deletedTotals: { ...EMPTY_TOTALS },
      failures: [],
    };
  }

  const deletedUploads = new Set();
  const deletedVariantCandidates = [];
  let deletedOrphanedVariantDirsCount = 0;
  const failures = [];

  unusedUploadCandidates.forEach((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url) || String(upload?.url || "").trim();

    try {
      const uploadId = String(upload?.id || "").trim();
      if (uploadId) {
        const variantDir = path.resolve(path.join(uploadsDir, VARIANTS_ROOT_SEGMENT, uploadId));
        if (!isPathInsideRoot(variantsRootDir, variantDir)) {
          throw new Error("invalid_variant_path");
        }
        fs.rmSync(variantDir, { recursive: true, force: true });
      }

      const originalPath = resolveUploadPathFromUrl({
        uploadsDir,
        uploadUrl: normalizedUrl,
      });
      if (!originalPath || !isPathInsideRoot(uploadsRootDir, originalPath)) {
        throw new Error("invalid_upload_path");
      }
      fs.rmSync(originalPath, { force: true });
      deletedUploads.add(upload);
    } catch (error) {
      failures.push({
        kind: "upload",
        url: normalizedUrl,
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  orphanedVariantDirectoryGroups.forEach((group) => {
    try {
      if (!isPathInsideRoot(variantsRootDir, group.absoluteDir)) {
        throw new Error("invalid_variant_path");
      }
      fs.rmSync(group.absoluteDir, { recursive: true, force: true });
      deletedVariantCandidates.push(...group.files);
      deletedOrphanedVariantDirsCount += 1;
    } catch (error) {
      failures.push({
        kind: "variant",
        url: String(group.url || ""),
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  const orphanedActiveVariantCandidates = orphanedVariantCandidates.filter((candidate) => candidate.ownerUploadId);
  const touchedVariantDirs = new Map();

  orphanedActiveVariantCandidates.forEach((candidate) => {
    try {
      if (!isPathInsideRoot(variantsRootDir, candidate.absolutePath)) {
        throw new Error("invalid_variant_path");
      }
      fs.rmSync(candidate.absolutePath, { force: true });
      deletedVariantCandidates.push(candidate);
      const topLevelDir = path.resolve(path.join(uploadsDir, VARIANTS_ROOT_SEGMENT, candidate.variantDirUploadId));
      touchedVariantDirs.set(candidate.variantDirUploadId, topLevelDir);
    } catch (error) {
      failures.push({
        kind: "variant",
        url: String(candidate.url || ""),
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  touchedVariantDirs.forEach((directoryPath) => {
    pruneEmptyVariantDirectories(directoryPath, variantsRootDir);
  });

  const deletedUploadEntries = unusedUploadCandidates.filter((upload) => deletedUploads.has(upload));
  const deletedSummary = mergeStorageSummaries(
    buildStorageAreaSummary(deletedUploadEntries),
    buildOrphanedVariantSummary(deletedVariantCandidates),
  );
  const nextUploads = uploads.filter((upload) => !deletedUploads.has(upload));

  return {
    mode: "apply",
    ...reportBase,
    rewritten: createRewrittenDatasets(datasets, nextUploads),
    changed:
      deletedUploads.size > 0 ||
      deletedVariantCandidates.length > 0 ||
      deletedOrphanedVariantDirsCount > 0,
    deletedCount: deletedUploads.size,
    deletedUnusedUploadsCount: deletedUploads.size,
    deletedOrphanedVariantFilesCount: deletedVariantCandidates.length,
    deletedOrphanedVariantDirsCount,
    failedCount: failures.length,
    deletedTotals: normalizeStorageAreaRow(deletedSummary.totals, "total"),
    failures: sortFailures(failures),
  };
};

export const __testing = {
  buildDiskStorageAreaSummary,
  buildCombinedCleanupExamples,
  buildOrphanedVariantSummary,
  collectExpectedVariantFilesByUploadId,
  collectOrphanedVariantCandidates,
  collectReferencedUploadUrls,
  collectUnusedUploadCandidates,
  isPathInsideRoot,
  normalizeStorageAreaRow,
  pruneEmptyVariantDirectories,
  resolveUploadPathFromUrl,
  scanVariantDirectoryEntries,
};
