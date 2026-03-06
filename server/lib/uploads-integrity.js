import fs from "fs";
import path from "path";
import {
  extractUploadUrlsFromText,
  normalizeUploadUrl,
  runUploadsReorganization,
} from "./uploads-reorganizer.js";
import { normalizePublicUploadUrl } from "./public-media-variants.js";

const CRITICAL_ISSUE_TYPES = new Set([
  "missing_source_file",
  "missing_variant_file",
  "missing_upload_file_for_inventory",
]);

const DATASETS_TO_SCAN = [
  "posts",
  "projects",
  "siteSettings",
  "pages",
  "comments",
  "updates",
  "users",
];

const hasCriticalType = (value) => CRITICAL_ISSUE_TYPES.has(String(value || "").trim());

const normalizeIssue = (issue, source) => ({
  type: String(issue?.type || ""),
  url: String(issue?.url || ""),
  path: String(issue?.path || ""),
  target: String(issue?.target || ""),
  source,
});

const issueKey = (issue) =>
  `${String(issue?.type || "")}::${String(issue?.url || "")}::${String(issue?.path || "")}`;

const fileExists = (value) => {
  try {
    return fs.existsSync(value);
  } catch {
    return false;
  }
};

const getUploadRelativePath = (uploadUrl) =>
  String(uploadUrl || "")
    .replace(/^\/uploads\//, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

const collectUploadUrlsDeep = (value, urls) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const direct = normalizeUploadUrl(value);
    if (direct) {
      urls.add(direct);
    }
    extractUploadUrlsFromText(value).forEach((uploadUrl) => {
      urls.add(uploadUrl);
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrlsDeep(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrlsDeep(item, urls));
  }
};

const collectMissingUploadRefsFromDatasets = (datasets, uploadsDir) => {
  const uploadUrls = new Set();
  DATASETS_TO_SCAN.forEach((datasetKey) => {
    collectUploadUrlsDeep(datasets?.[datasetKey], uploadUrls);
  });

  return [...uploadUrls]
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((uploadUrl) => {
      const relative = getUploadRelativePath(uploadUrl);
      const diskPath = path.join(uploadsDir, relative);
      if (fileExists(diskPath)) {
        return null;
      }
      return {
        type: "missing_source_file",
        url: uploadUrl,
        path: relative,
      };
    })
    .filter(Boolean);
};

const collectMissingVariantRefsFromUploads = (datasets, uploadsDir) => {
  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  const issues = [];

  uploads.forEach((upload) => {
    const variants = upload?.variants;
    if (!variants || typeof variants !== "object") {
      return;
    }
    Object.entries(variants).forEach(([presetKey, presetRecord]) => {
      const formats =
        presetRecord?.formats && typeof presetRecord.formats === "object"
          ? presetRecord.formats
          : null;
      if (!formats) {
        return;
      }
      Object.entries(formats).forEach(([formatKey, formatRecord]) => {
        const uploadUrl = normalizePublicUploadUrl(formatRecord?.url);
        if (!uploadUrl) {
          return;
        }
        const relative = getUploadRelativePath(uploadUrl);
        const diskPath = path.join(uploadsDir, relative);
        if (fileExists(diskPath)) {
          return;
        }
        issues.push({
          type: "missing_variant_file",
          url: uploadUrl,
          path: relative,
          target: `${String(upload?.id || "")}:${presetKey}:${formatKey}`,
        });
      });
    });
  });

  return issues;
};

const mergeCriticalIssues = (issues) => {
  const deduped = new Map();
  issues.forEach((issue) => {
    const normalized = normalizeIssue(issue, issue?.source || "unknown");
    if (!normalized.type || !normalized.url) {
      return;
    }
    deduped.set(issueKey(normalized), normalized);
  });
  return [...deduped.values()].sort((a, b) => {
    const typeOrder = a.type.localeCompare(b.type, "en");
    if (typeOrder !== 0) {
      return typeOrder;
    }
    const urlOrder = a.url.localeCompare(b.url, "en");
    if (urlOrder !== 0) {
      return urlOrder;
    }
    return a.path.localeCompare(b.path, "en");
  });
};

export const runUploadsIntegrityCheck = ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  maxExamples = 20,
  privateRootFolders,
} = {}) => {
  const reorganizationReport = runUploadsReorganization({
    datasets,
    uploadsDir,
    applyChanges: false,
    privateRootFolders,
  });

  const criticalFromReorganization = (reorganizationReport.skipped || [])
    .filter((issue) => hasCriticalType(issue?.type))
    .map((issue) => normalizeIssue(issue, "reorganization"));
  const criticalFromDatasetScan = collectMissingUploadRefsFromDatasets(
    reorganizationReport.rewritten || datasets || {},
    uploadsDir,
  ).map((issue) => normalizeIssue(issue, "dataset-scan"));
  const criticalFromUploadsMetadata = collectMissingVariantRefsFromUploads(
    reorganizationReport.rewritten || datasets || {},
    uploadsDir,
  ).map((issue) => normalizeIssue(issue, "uploads-metadata"));

  const criticalIssues = mergeCriticalIssues([
    ...criticalFromReorganization,
    ...criticalFromDatasetScan,
    ...criticalFromUploadsMetadata,
  ]);

  const criticalCountByType = criticalIssues.reduce((acc, issue) => {
    const key = String(issue.type || "");
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: criticalIssues.length === 0,
    criticalCount: criticalIssues.length,
    criticalCountByType,
    criticalIssues,
    examples: criticalIssues.slice(0, Math.max(1, Number(maxExamples) || 20)),
    reorganizationReport,
    referencedUrlsCount: reorganizationReport.referencedUrlsCount,
    plannedMovesCount: reorganizationReport.plannedMovesCount,
    uploadsInventoryCount: reorganizationReport.uploadsInventoryCount,
  };
};

export const __testing = {
  collectUploadUrlsDeep,
  collectMissingUploadRefsFromDatasets,
  collectMissingVariantRefsFromUploads,
  getUploadRelativePath,
  hasCriticalType,
  mergeCriticalIssues,
};
