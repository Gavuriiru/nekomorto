import fs from "fs";
import path from "path";
import { buildStorageAreaSummary, deriveUploadArea, normalizeVariants } from "./upload-media.js";
import { getUploadVariantUrlPrefix, readUploadStorageProvider } from "./upload-storage.js";
import {
  EPUB_IMPORT_TMP_PREFIX,
  EPUB_IMPORT_TMP_TTL_MS,
  isEpubImportTempFolder,
} from "./uploads-import.js";
import { extractUploadUrlsFromText, normalizeUploadUrl } from "./uploads-reorganizer.js";

const DATASETS_TO_SCAN = [
  "siteSettings",
  "posts",
  "projects",
  "users",
  "pages",
  "comments",
  "updates",
  "linkTypes",
];

const VARIANTS_ROOT_SEGMENT = "_variants";
const QUARANTINE_ROOT_SEGMENT = "_quarantine";
const QUARANTINE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
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

const isVariantUploadUrl = (value) =>
  String(value || "").startsWith(`/uploads/${VARIANTS_ROOT_SEGMENT}/`);
const isQuarantineUploadUrl = (value) =>
  String(value || "").startsWith(`/uploads/${QUARANTINE_ROOT_SEGMENT}/`);

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
    return (
      Boolean(normalizedUrl) &&
      !isVariantUploadUrl(normalizedUrl) &&
      !isQuarantineUploadUrl(normalizedUrl)
    );
  });

const isStaleEpubImportTempUpload = (upload, nowTs = Date.now()) => {
  if (!isEpubImportTempFolder(upload?.folder)) {
    return false;
  }
  const createdAtTs = new Date(upload?.createdAt || 0).getTime();
  if (!Number.isFinite(createdAtTs) || createdAtTs <= 0) {
    return true;
  }
  return nowTs - createdAtTs >= EPUB_IMPORT_TMP_TTL_MS;
};

const collectUnusedUploadCandidates = (datasets) => {
  const nowTs = Date.now();
  const referencedUrls = new Set();
  DATASETS_TO_SCAN.forEach((datasetKey) => {
    collectReferencedUploadUrls(datasets?.[datasetKey], referencedUrls);
  });

  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  const managedUploads = getManagedUploads(uploads);
  const unusedUploadCandidates = managedUploads.filter((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    if (!normalizedUrl || referencedUrls.has(normalizedUrl)) {
      return false;
    }
    if (String(upload?.folder || "").startsWith(`${EPUB_IMPORT_TMP_PREFIX}/`)) {
      return isStaleEpubImportTempUpload(upload, nowTs);
    }
    return true;
  });

  return {
    uploads,
    managedUploads,
    referencedUrls,
    unusedUploadCandidates,
    unusedUploadIds: new Set(
      unusedUploadCandidates.map((upload) => String(upload?.id || "").trim()).filter(Boolean),
    ),
  };
};

const resolveVariantUploadPrefixes = (uploadId) => {
  const encoded = encodeURIComponent(String(uploadId || ""));
  const raw = String(uploadId || "");
  return new Set([
    `/uploads/${VARIANTS_ROOT_SEGMENT}/${encoded}/`,
    `/uploads/${VARIANTS_ROOT_SEGMENT}/${raw}/`,
  ]);
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
        const matchesUploadDir = Array.from(validPrefixes).some((prefix) =>
          normalizedUrl.startsWith(prefix),
        );
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

  return files.sort((left, right) =>
    String(left.url || "").localeCompare(String(right.url || ""), "en"),
  );
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
      String(left.variantDirUploadId || "").localeCompare(
        String(right.variantDirUploadId || ""),
        "en",
      ),
    );
};

const collectOrphanedVariantCandidates = ({
  uploads,
  uploadsDir,
  ignoredUploadIds = new Set(),
}) => {
  const variantsRootDir = path.join(uploadsDir, VARIANTS_ROOT_SEGMENT);
  const activeUploads = getManagedUploads(uploads);
  const activeUploadIds = new Set(
    activeUploads.map((upload) => String(upload?.id || "").trim()).filter(Boolean),
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

  (Array.isArray(orphanedVariantCandidates) ? orphanedVariantCandidates : []).forEach(
    (candidate) => {
      const bytes = Number(candidate?.bytes || 0);
      if (!Number.isFinite(bytes) || bytes < 0) {
        return;
      }
      totals.variantBytes += bytes;
      totals.totalBytes += bytes;
      totals.variantFiles += 1;
      totals.totalFiles += 1;
    },
  );

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

const buildLooseOriginalCleanupExample = (candidate) => ({
  kind: "upload",
  scope: "loose_original",
  id: null,
  ownerUploadId: null,
  url: String(candidate?.url || ""),
  fileName: String(candidate?.fileName || ""),
  folder: String(candidate?.folder || ""),
  area: String(candidate?.area || deriveUploadArea(candidate?.folder || "")),
  createdAt: candidate?.createdAt ? String(candidate.createdAt) : null,
  originalBytes: Number(candidate?.bytes || 0),
  variantBytes: 0,
  totalBytes: Number(candidate?.bytes || 0),
});

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
  looseOriginalCandidates,
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
    ...(Array.isArray(orphanedVariantCandidates) ? orphanedVariantCandidates : []).map(
      (candidate) => buildVariantCleanupExample(candidate),
    ),
    ...(Array.isArray(looseOriginalCandidates) ? looseOriginalCandidates : []).map((candidate) =>
      buildLooseOriginalCleanupExample(candidate),
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
  looseOriginalCandidates,
  quarantinePendingDeleteCandidates,
  exampleLimit,
}) => {
  const unusedUploadSummary = buildStorageAreaSummary(unusedUploadCandidates);
  const orphanedVariantSummary = buildOrphanedVariantSummary(orphanedVariantCandidates);
  const looseOriginalSummary = buildLooseOriginalSummary(looseOriginalCandidates);
  const quarantinePendingSummary = buildQuarantinePendingSummary(quarantinePendingDeleteCandidates);
  const mergedSummary = mergeStorageSummaries(
    unusedUploadSummary,
    orphanedVariantSummary,
    looseOriginalSummary,
    quarantinePendingSummary,
  );
  const unusedUploadCount = Array.isArray(unusedUploadCandidates)
    ? unusedUploadCandidates.length
    : 0;
  const looseOriginalFilesCount = Array.isArray(looseOriginalCandidates)
    ? looseOriginalCandidates.length
    : 0;
  const quarantinePendingDeleteCount = Array.isArray(quarantinePendingDeleteCandidates)
    ? quarantinePendingDeleteCandidates.length
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    unusedCount: unusedUploadCount,
    unusedUploadCount,
    orphanedVariantFilesCount: Array.isArray(orphanedVariantCandidates)
      ? orphanedVariantCandidates.length
      : 0,
    orphanedVariantDirsCount: Number(orphanedVariantDirsCount || 0),
    looseOriginalFilesCount,
    looseOriginalTotals: normalizeStorageAreaRow(looseOriginalSummary.totals, "total"),
    quarantinePendingDeleteCount,
    quarantinePendingDeleteTotals: normalizeStorageAreaRow(
      quarantinePendingSummary.totals,
      "total",
    ),
    totals: normalizeStorageAreaRow(mergedSummary.totals, "total"),
    areas: mergedSummary.areas.map((item) =>
      normalizeStorageAreaRow(item, String(item?.area || "root")),
    ),
    examples: buildCombinedCleanupExamples({
      unusedUploadCandidates,
      orphanedVariantCandidates,
      looseOriginalCandidates,
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

const scanOriginalUploadFilesRecursive = ({
  absoluteDir,
  relativeDir = "",
  ignoredRootSegments = new Set([VARIANTS_ROOT_SEGMENT]),
}) => {
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const nextAbsolute = path.join(absoluteDir, entry.name);
    const nextRelative = relativeDir ? toPosix(path.join(relativeDir, entry.name)) : entry.name;

    if (entry.isDirectory()) {
      if (!relativeDir && ignoredRootSegments.has(entry.name)) {
        return;
      }
      files.push(
        ...scanOriginalUploadFilesRecursive({
          absoluteDir: nextAbsolute,
          relativeDir: nextRelative,
          ignoredRootSegments,
        }),
      );
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
      createdAt: stat.mtime?.toISOString?.() || null,
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

const buildLooseOriginalCandidateFromFile = (file) => {
  const relativePath = toPosix(String(file?.relativePath || "").replace(/^\/+/, ""));
  const folder = path.posix.dirname(relativePath).replace(/^\.$/, "");
  return {
    kind: "upload",
    scope: "loose_original",
    id: null,
    ownerUploadId: null,
    absolutePath: path.resolve(String(file?.absolutePath || "")),
    relativePath,
    url: `/uploads/${relativePath}`,
    fileName: path.posix.basename(relativePath),
    folder,
    area: deriveOriginalAreaFromRelativePath(relativePath),
    bytes: Number(file?.bytes || 0),
    createdAt: file?.createdAt ? String(file.createdAt) : null,
  };
};

const collectLooseOriginalCandidates = ({ uploads, uploadsDir, referencedUrls = new Set() }) => {
  const uploadsRootDir = path.resolve(uploadsDir);
  const managedOriginalPaths = new Set();
  const referencedOriginalPaths = new Set();

  getManagedUploads(uploads).forEach((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    if (
      !normalizedUrl ||
      isVariantUploadUrl(normalizedUrl) ||
      isQuarantineUploadUrl(normalizedUrl)
    ) {
      return;
    }
    const absolutePath = resolveUploadPathFromUrl({ uploadsDir, uploadUrl: normalizedUrl });
    if (!absolutePath) {
      return;
    }
    managedOriginalPaths.add(path.resolve(absolutePath));
  });

  (referencedUrls instanceof Set ? referencedUrls : new Set()).forEach((item) => {
    const normalizedUrl = normalizeUploadUrl(item);
    if (
      !normalizedUrl ||
      isVariantUploadUrl(normalizedUrl) ||
      isQuarantineUploadUrl(normalizedUrl)
    ) {
      return;
    }
    const absolutePath = resolveUploadPathFromUrl({ uploadsDir, uploadUrl: normalizedUrl });
    if (!absolutePath) {
      return;
    }
    referencedOriginalPaths.add(path.resolve(absolutePath));
  });

  const filesOnDisk = scanOriginalUploadFilesRecursive({
    absoluteDir: uploadsRootDir,
    ignoredRootSegments: new Set([VARIANTS_ROOT_SEGMENT, QUARANTINE_ROOT_SEGMENT]),
  });

  const looseOriginalCandidates = filesOnDisk
    .filter((file) => {
      const absolutePath = path.resolve(String(file?.absolutePath || ""));
      return !managedOriginalPaths.has(absolutePath) && !referencedOriginalPaths.has(absolutePath);
    })
    .map((file) => buildLooseOriginalCandidateFromFile(file));

  return {
    looseOriginalCandidates,
    managedOriginalPaths,
    referencedOriginalPaths,
  };
};

const buildLooseOriginalSummary = (looseOriginalCandidates) => {
  const areasMap = new Map();

  (Array.isArray(looseOriginalCandidates) ? looseOriginalCandidates : []).forEach((candidate) => {
    const bytes = Number(candidate?.bytes || 0);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return;
    }
    const area = String(
      candidate?.area || deriveOriginalAreaFromRelativePath(candidate?.relativePath || ""),
    );
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

  const areas = sortStorageAreaRows(Array.from(areasMap.values()));
  return {
    totals: sumStorageAreaRows(areas),
    areas,
  };
};

const parseQuarantineDateSegmentToTs = (value) => {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const ts = new Date(`${normalized}T00:00:00.000Z`).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const scanQuarantineFilesRecursive = ({ absoluteDir, relativeDir = "" }) => {
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const nextAbsolute = path.join(absoluteDir, entry.name);
    const nextRelative = relativeDir ? toPosix(path.join(relativeDir, entry.name)) : entry.name;

    if (entry.isDirectory()) {
      files.push(
        ...scanQuarantineFilesRecursive({ absoluteDir: nextAbsolute, relativeDir: nextRelative }),
      );
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    const stat = fs.statSync(nextAbsolute);
    files.push({
      absolutePath: path.resolve(nextAbsolute),
      relativePath: toPosix(nextRelative),
      bytes: Number(stat.size || 0),
      createdAt: stat.mtime?.toISOString?.() || null,
      modifiedAtMs: Number(stat.mtimeMs || 0),
    });
  });

  return files.sort((left, right) =>
    String(left.relativePath || "").localeCompare(String(right.relativePath || ""), "en"),
  );
};

const isQuarantineCandidateExpired = (candidate, nowTs = Date.now()) => {
  const relativePath = String(candidate?.relativePath || "");
  const rootSegment = relativePath.split("/")[0] || "";
  const dateTs = parseQuarantineDateSegmentToTs(rootSegment);
  if (Number.isFinite(dateTs)) {
    return nowTs - dateTs >= QUARANTINE_RETENTION_MS;
  }
  const modifiedAtMs = Number(candidate?.modifiedAtMs || 0);
  if (!Number.isFinite(modifiedAtMs) || modifiedAtMs <= 0) {
    return true;
  }
  return nowTs - modifiedAtMs >= QUARANTINE_RETENTION_MS;
};

const buildQuarantinePendingCandidate = (file) => {
  const relativePathInQuarantine = toPosix(String(file?.relativePath || "").replace(/^\/+/, ""));
  const relativePath = toPosix(path.join(QUARANTINE_ROOT_SEGMENT, relativePathInQuarantine));
  const folder = path.posix.dirname(relativePath).replace(/^\.$/, "");
  return {
    kind: "upload",
    scope: "quarantine_pending_delete",
    id: null,
    ownerUploadId: null,
    absolutePath: path.resolve(String(file?.absolutePath || "")),
    relativePath,
    url: `/uploads/${relativePath}`,
    fileName: path.posix.basename(relativePathInQuarantine),
    folder,
    area: QUARANTINE_ROOT_SEGMENT,
    bytes: Number(file?.bytes || 0),
    createdAt: file?.createdAt ? String(file.createdAt) : null,
    modifiedAtMs: Number(file?.modifiedAtMs || 0),
  };
};

const collectQuarantinePendingDeleteCandidates = ({ uploadsDir, nowTs = Date.now() }) => {
  const quarantineRootDir = path.resolve(path.join(uploadsDir, QUARANTINE_ROOT_SEGMENT));
  const quarantineFiles = scanQuarantineFilesRecursive({ absoluteDir: quarantineRootDir });
  const quarantinePendingDeleteCandidates = quarantineFiles
    .filter((file) => isQuarantineCandidateExpired(file, nowTs))
    .map((file) => buildQuarantinePendingCandidate(file));

  return {
    quarantineRootDir,
    quarantinePendingDeleteCandidates,
  };
};

const buildQuarantinePendingSummary = (quarantinePendingDeleteCandidates) => {
  const totalBytes = (
    Array.isArray(quarantinePendingDeleteCandidates) ? quarantinePendingDeleteCandidates : []
  ).reduce((sum, candidate) => {
    const bytes = Number(candidate?.bytes || 0);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return sum;
    }
    return sum + bytes;
  }, 0);
  const totalFiles = Array.isArray(quarantinePendingDeleteCandidates)
    ? quarantinePendingDeleteCandidates.length
    : 0;

  if (totalFiles === 0) {
    return {
      totals: { ...EMPTY_TOTALS },
      areas: [],
    };
  }

  return {
    totals: {
      area: "total",
      originalBytes: totalBytes,
      variantBytes: 0,
      totalBytes,
      originalFiles: totalFiles,
      variantFiles: 0,
      totalFiles,
    },
    areas: [
      {
        area: QUARANTINE_ROOT_SEGMENT,
        originalBytes: totalBytes,
        variantBytes: 0,
        totalBytes,
        originalFiles: totalFiles,
        variantFiles: 0,
        totalFiles,
      },
    ],
  };
};

const buildQuarantineDateFolder = (nowTs = Date.now()) =>
  new Date(nowTs).toISOString().slice(0, 10);

const resolveQuarantineTargetPath = ({
  uploadsDir,
  dateFolder,
  sourceRelativePath,
  nowTs = Date.now(),
}) => {
  const uploadsRootDir = path.resolve(uploadsDir);
  const safeDateFolder = String(dateFolder || "").trim();
  if (!safeDateFolder || !/^\d{4}-\d{2}-\d{2}$/.test(safeDateFolder)) {
    return null;
  }

  const rawRelativePath = toPosix(String(sourceRelativePath || "").replace(/^\/+/, ""));
  const normalizedSourceRelativePath = path.posix.normalize(rawRelativePath);
  if (
    !normalizedSourceRelativePath ||
    normalizedSourceRelativePath === "." ||
    normalizedSourceRelativePath.startsWith("../") ||
    normalizedSourceRelativePath.includes("/../") ||
    path.posix.isAbsolute(normalizedSourceRelativePath)
  ) {
    return null;
  }

  const sourceDir = path.posix.dirname(normalizedSourceRelativePath).replace(/^\.$/, "");
  const sourceExt = path.posix.extname(normalizedSourceRelativePath);
  const sourceBaseName = sourceExt
    ? path.posix.basename(normalizedSourceRelativePath, sourceExt)
    : path.posix.basename(normalizedSourceRelativePath);

  let attempt = 0;
  while (attempt < 1000) {
    const suffix = attempt === 0 ? "" : `__${nowTs}${attempt === 1 ? "" : `-${attempt}`}`;
    const fileName = `${sourceBaseName}${suffix}${sourceExt}`;
    const targetLeafRelative = sourceDir ? path.posix.join(sourceDir, fileName) : fileName;
    const targetRelativePath = toPosix(
      path.posix.join(QUARANTINE_ROOT_SEGMENT, safeDateFolder, targetLeafRelative),
    );
    const targetAbsolutePath = path.resolve(path.join(uploadsRootDir, targetRelativePath));

    if (!isPathInsideRoot(uploadsRootDir, targetAbsolutePath)) {
      return null;
    }
    if (!fs.existsSync(targetAbsolutePath)) {
      return {
        targetRelativePath,
        targetAbsolutePath,
        targetUrl: `/uploads/${targetRelativePath}`,
      };
    }
    attempt += 1;
  }

  return null;
};

const moveFileWithFallback = (sourcePath, targetPath) => {
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (String(error?.code || "").trim() !== "EXDEV") {
      throw error;
    }
    fs.copyFileSync(sourcePath, targetPath);
    fs.rmSync(sourcePath, { force: true });
  }
};

const pruneEmptyDirectoriesUpward = ({ startDir, stopDir }) => {
  const safeStopDir = path.resolve(stopDir);
  let current = path.resolve(startDir);

  while (current !== safeStopDir) {
    if (!isPathInsideRoot(safeStopDir, current)) {
      return;
    }
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }
    if (fs.readdirSync(current).length > 0) {
      return;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
};

const pruneEmptyDirectoriesRecursive = ({ directoryPath, rootDir }) => {
  const safeRootDir = path.resolve(rootDir);
  const safeDirectoryPath = path.resolve(directoryPath);
  if (!isPathInsideRoot(safeRootDir, safeDirectoryPath) || !fs.existsSync(safeDirectoryPath)) {
    return 0;
  }

  let removedDirectories = 0;

  const prune = (currentPath) => {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    fs.readdirSync(currentPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        prune(path.join(currentPath, entry.name));
      });

    const safeCurrentPath = path.resolve(currentPath);
    if (safeCurrentPath === safeRootDir || !fs.existsSync(currentPath)) {
      return;
    }

    if (fs.readdirSync(currentPath).length === 0) {
      fs.rmdirSync(currentPath);
      removedDirectories += 1;
    }
  };

  prune(safeDirectoryPath);

  return removedDirectories;
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

export const runUploadsCleanup = async ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  applyChanges = false,
  exampleLimit = 8,
  storageService = null,
} = {}) => {
  const nowTs = Date.now();
  const uploadsRootDir = path.resolve(uploadsDir);
  const variantsRootDir = path.resolve(path.join(uploadsDir, VARIANTS_ROOT_SEGMENT));
  const { uploads, unusedUploadCandidates, unusedUploadIds, referencedUrls } =
    collectUnusedUploadCandidates(datasets);
  const { orphanedVariantCandidates, orphanedVariantDirectoryGroups, orphanedVariantDirsCount } =
    collectOrphanedVariantCandidates({
      uploads,
      uploadsDir,
      ignoredUploadIds: unusedUploadIds,
    });
  const { looseOriginalCandidates } = collectLooseOriginalCandidates({
    uploads,
    uploadsDir,
    referencedUrls,
  });
  const { quarantineRootDir, quarantinePendingDeleteCandidates } =
    collectQuarantinePendingDeleteCandidates({
      uploadsDir,
      nowTs,
    });
  const reportBase = buildCleanupReportBase({
    unusedUploadCandidates,
    orphanedVariantCandidates,
    orphanedVariantDirsCount,
    looseOriginalCandidates,
    quarantinePendingDeleteCandidates,
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
      quarantinedLooseOriginalFilesCount: 0,
      deletedQuarantineFilesCount: 0,
      deletedQuarantineDirsCount: 0,
      failedCount: 0,
      deletedTotals: { ...EMPTY_TOTALS },
      quarantinedTotals: { ...EMPTY_TOTALS },
      purgedQuarantineTotals: { ...EMPTY_TOTALS },
      failures: [],
    };
  }

  const deletedUploads = new Set();
  const deletedVariantCandidates = [];
  let deletedOrphanedVariantDirsCount = 0;
  const quarantinedLooseOriginalCandidates = [];
  const deletedQuarantineCandidates = [];
  let deletedQuarantineDirsCount = 0;
  const failures = [];

  for (const upload of unusedUploadCandidates) {
    const normalizedUrl = normalizeUploadUrl(upload?.url) || String(upload?.url || "").trim();

    try {
      const storageProvider = readUploadStorageProvider(upload);
      if (storageProvider === "s3") {
        if (!storageService) {
          throw new Error("storage_service_required");
        }
        await storageService.deleteUpload({
          provider: "s3",
          uploadUrl: normalizedUrl,
        });
        const variantPrefix = getUploadVariantUrlPrefix(upload);
        if (variantPrefix) {
          await storageService.deleteUploadPrefix({
            provider: "s3",
            uploadUrlPrefix: variantPrefix,
          });
        }
      } else {
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
      }
      deletedUploads.add(upload);
    } catch (error) {
      failures.push({
        kind: "upload",
        url: normalizedUrl,
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  }

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

  const orphanedActiveVariantCandidates = orphanedVariantCandidates.filter(
    (candidate) => candidate.ownerUploadId,
  );
  const touchedVariantDirs = new Map();

  orphanedActiveVariantCandidates.forEach((candidate) => {
    try {
      if (!isPathInsideRoot(variantsRootDir, candidate.absolutePath)) {
        throw new Error("invalid_variant_path");
      }
      fs.rmSync(candidate.absolutePath, { force: true });
      deletedVariantCandidates.push(candidate);
      const topLevelDir = path.resolve(
        path.join(uploadsDir, VARIANTS_ROOT_SEGMENT, candidate.variantDirUploadId),
      );
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

  const quarantineDateFolder = buildQuarantineDateFolder(nowTs);

  looseOriginalCandidates.forEach((candidate) => {
    const sourceAbsolutePath = path.resolve(String(candidate?.absolutePath || ""));
    try {
      if (!isPathInsideRoot(uploadsRootDir, sourceAbsolutePath)) {
        throw new Error("invalid_upload_path");
      }
      if (!fs.existsSync(sourceAbsolutePath)) {
        throw new Error("upload_file_not_found");
      }

      const quarantineTarget = resolveQuarantineTargetPath({
        uploadsDir,
        dateFolder: quarantineDateFolder,
        sourceRelativePath: candidate?.relativePath,
        nowTs,
      });
      if (!quarantineTarget) {
        throw new Error("invalid_quarantine_path");
      }
      if (!isPathInsideRoot(uploadsRootDir, quarantineTarget.targetAbsolutePath)) {
        throw new Error("invalid_quarantine_path");
      }

      fs.mkdirSync(path.dirname(quarantineTarget.targetAbsolutePath), { recursive: true });
      moveFileWithFallback(sourceAbsolutePath, quarantineTarget.targetAbsolutePath);
      quarantinedLooseOriginalCandidates.push({
        ...candidate,
        url: quarantineTarget.targetUrl,
        relativePath: quarantineTarget.targetRelativePath,
        absolutePath: quarantineTarget.targetAbsolutePath,
        area: QUARANTINE_ROOT_SEGMENT,
      });
      pruneEmptyDirectoriesUpward({
        startDir: path.dirname(sourceAbsolutePath),
        stopDir: uploadsRootDir,
      });
    } catch (error) {
      failures.push({
        kind: "upload",
        url: String(candidate?.url || ""),
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  quarantinePendingDeleteCandidates.forEach((candidate) => {
    const targetAbsolutePath = path.resolve(String(candidate?.absolutePath || ""));
    try {
      if (!isPathInsideRoot(quarantineRootDir, targetAbsolutePath)) {
        throw new Error("invalid_quarantine_path");
      }
      fs.rmSync(targetAbsolutePath, { force: true });
      deletedQuarantineCandidates.push(candidate);
    } catch (error) {
      failures.push({
        kind: "upload",
        url: String(candidate?.url || ""),
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  deletedQuarantineDirsCount = pruneEmptyDirectoriesRecursive({
    directoryPath: quarantineRootDir,
    rootDir: quarantineRootDir,
  });

  const deletedUploadEntries = unusedUploadCandidates.filter((upload) =>
    deletedUploads.has(upload),
  );
  const deletedSummary = mergeStorageSummaries(
    buildStorageAreaSummary(deletedUploadEntries),
    buildOrphanedVariantSummary(deletedVariantCandidates),
    buildQuarantinePendingSummary(deletedQuarantineCandidates),
  );
  const quarantinedSummary = buildLooseOriginalSummary(quarantinedLooseOriginalCandidates);
  const purgedQuarantineSummary = buildQuarantinePendingSummary(deletedQuarantineCandidates);
  const nextUploads = uploads.filter((upload) => !deletedUploads.has(upload));
  const deletedCount =
    deletedUploads.size + deletedVariantCandidates.length + deletedQuarantineCandidates.length;

  return {
    mode: "apply",
    ...reportBase,
    rewritten: createRewrittenDatasets(datasets, nextUploads),
    changed:
      deletedUploads.size > 0 ||
      deletedVariantCandidates.length > 0 ||
      deletedOrphanedVariantDirsCount > 0 ||
      quarantinedLooseOriginalCandidates.length > 0 ||
      deletedQuarantineCandidates.length > 0 ||
      deletedQuarantineDirsCount > 0,
    deletedCount,
    deletedUnusedUploadsCount: deletedUploads.size,
    deletedOrphanedVariantFilesCount: deletedVariantCandidates.length,
    deletedOrphanedVariantDirsCount,
    quarantinedLooseOriginalFilesCount: quarantinedLooseOriginalCandidates.length,
    deletedQuarantineFilesCount: deletedQuarantineCandidates.length,
    deletedQuarantineDirsCount,
    failedCount: failures.length,
    deletedTotals: normalizeStorageAreaRow(deletedSummary.totals, "total"),
    quarantinedTotals: normalizeStorageAreaRow(quarantinedSummary.totals, "total"),
    purgedQuarantineTotals: normalizeStorageAreaRow(purgedQuarantineSummary.totals, "total"),
    failures: sortFailures(failures),
  };
};

export const __testing = {
  buildDiskStorageAreaSummary,
  buildCombinedCleanupExamples,
  buildLooseOriginalSummary,
  buildOrphanedVariantSummary,
  buildQuarantinePendingSummary,
  collectExpectedVariantFilesByUploadId,
  collectLooseOriginalCandidates,
  collectOrphanedVariantCandidates,
  collectQuarantinePendingDeleteCandidates,
  collectReferencedUploadUrls,
  collectUnusedUploadCandidates,
  isPathInsideRoot,
  normalizeStorageAreaRow,
  parseQuarantineDateSegmentToTs,
  pruneEmptyVariantDirectories,
  pruneEmptyDirectoriesRecursive,
  resolveUploadPathFromUrl,
  resolveQuarantineTargetPath,
  scanVariantDirectoryEntries,
};
