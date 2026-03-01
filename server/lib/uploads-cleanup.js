import fs from "fs";
import path from "path";
import { buildStorageAreaSummary, resolveUploadAbsolutePath } from "./upload-media.js";
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

const EMPTY_TOTALS = Object.freeze({
  area: "total",
  originalBytes: 0,
  variantBytes: 0,
  totalBytes: 0,
  originalFiles: 0,
  variantFiles: 0,
  totalFiles: 0,
});

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

const collectCleanupCandidates = (datasets) => {
  const referencedUrls = new Set();
  DATASETS_TO_SCAN.forEach((datasetKey) => {
    collectReferencedUploadUrls(datasets?.[datasetKey], referencedUrls);
  });

  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  const candidates = uploads.filter((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    if (!normalizedUrl) {
      return false;
    }
    return !referencedUrls.has(normalizedUrl);
  });

  return {
    uploads,
    candidates,
    referencedUrls,
  };
};

const buildCleanupExamples = (uploads, exampleLimit) => {
  const safeLimitRaw = Number(exampleLimit);
  const safeLimit = Number.isFinite(safeLimitRaw) ? Math.max(0, Math.floor(safeLimitRaw)) : 8;
  if (safeLimit === 0) {
    return [];
  }

  return (Array.isArray(uploads) ? uploads : [])
    .map((upload) => {
      const normalizedUrl = normalizeUploadUrl(upload?.url) || String(upload?.url || "").trim();
      const summary = buildStorageAreaSummary([upload]);
      const totals = normalizeStorageAreaRow(summary?.totals, "total");
      const folder = String(upload?.folder || "").trim();
      const area = String(upload?.area || folder.split("/")[0] || "root");
      return {
        id: upload?.id ? String(upload.id) : null,
        url: normalizedUrl,
        fileName: getUploadFileName(upload, normalizedUrl),
        folder,
        area,
        createdAt: upload?.createdAt ? String(upload.createdAt) : null,
        originalBytes: totals.originalBytes,
        variantBytes: totals.variantBytes,
        totalBytes: totals.totalBytes,
      };
    })
    .sort((left, right) => {
      if (left.totalBytes !== right.totalBytes) {
        return right.totalBytes - left.totalBytes;
      }
      return String(left.url || "").localeCompare(String(right.url || ""), "en");
    })
    .slice(0, safeLimit);
};

const buildCleanupReportBase = (candidates, exampleLimit) => {
  const summary = buildStorageAreaSummary(candidates);
  return {
    generatedAt: new Date().toISOString(),
    unusedCount: Array.isArray(candidates) ? candidates.length : 0,
    totals: normalizeStorageAreaRow(summary?.totals, "total"),
    areas: Array.isArray(summary?.areas)
      ? summary.areas.map((item) => normalizeStorageAreaRow(item, String(item?.area || "root")))
      : [],
    examples: buildCleanupExamples(candidates, exampleLimit),
  };
};

const createRewrittenDatasets = (datasets, nextUploads) => ({
  ...(datasets && typeof datasets === "object" ? datasets : {}),
  uploads: nextUploads,
});

export const runUploadsCleanup = ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  applyChanges = false,
  exampleLimit = 8,
} = {}) => {
  const { uploads, candidates } = collectCleanupCandidates(datasets);
  const reportBase = buildCleanupReportBase(candidates, exampleLimit);

  if (!applyChanges) {
    return {
      mode: "dry-run",
      ...reportBase,
      rewritten: createRewrittenDatasets(datasets, uploads),
      changed: false,
      deletedCount: 0,
      failedCount: 0,
      deletedTotals: { ...EMPTY_TOTALS },
      failures: [],
    };
  }

  const deletedUploads = new Set();
  const failures = [];
  const uploadsRoot = path.resolve(uploadsDir);

  candidates.forEach((upload) => {
    const normalizedUrl = normalizeUploadUrl(upload?.url);
    if (!normalizedUrl) {
      failures.push({
        url: String(upload?.url || ""),
        reason: "invalid_upload_url",
      });
      return;
    }

    try {
      const uploadId = String(upload?.id || "").trim();
      if (uploadId) {
        const variantDir = path.resolve(path.join(uploadsDir, "_variants", uploadId));
        if (!variantDir.startsWith(uploadsRoot)) {
          throw new Error("invalid_variant_path");
        }
        fs.rmSync(variantDir, { recursive: true, force: true });
      }

      const originalPath = resolveUploadAbsolutePath({
        uploadsDir,
        uploadUrl: normalizedUrl,
      });
      if (!originalPath) {
        throw new Error("invalid_upload_path");
      }
      fs.rmSync(originalPath, { force: true });
      deletedUploads.add(upload);
    } catch (error) {
      failures.push({
        url: normalizedUrl,
        reason: String(error?.message || error || "cleanup_failed"),
      });
    }
  });

  const deletedEntries = candidates.filter((upload) => deletedUploads.has(upload));
  const deletedSummary = buildStorageAreaSummary(deletedEntries);
  const nextUploads = uploads.filter((upload) => !deletedUploads.has(upload));

  return {
    mode: "apply",
    ...reportBase,
    rewritten: createRewrittenDatasets(datasets, nextUploads),
    changed: deletedUploads.size > 0,
    deletedCount: deletedUploads.size,
    failedCount: failures.length,
    deletedTotals: normalizeStorageAreaRow(deletedSummary?.totals, "total"),
    failures: failures.sort((left, right) =>
      String(left?.url || "").localeCompare(String(right?.url || ""), "en"),
    ),
  };
};

export const __testing = {
  buildCleanupExamples,
  collectCleanupCandidates,
  collectReferencedUploadUrls,
  normalizeStorageAreaRow,
};
