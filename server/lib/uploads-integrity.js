import fs from "fs";
import path from "path";
import {
  extractUploadUrlsFromText,
  normalizeUploadUrl,
  runUploadsReorganization,
} from "./uploads-reorganizer.js";
import { buildUploadFilterScope, getUploadRelativePath } from "./upload-filter-scope.js";
import { readUploadStorageProvider } from "./upload-storage.js";
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
  "linkTypes",
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

const buildUploadsByUrl = (datasets) =>
  new Map(
    (Array.isArray(datasets?.uploads) ? datasets.uploads : [])
      .map((entry) => [normalizeUploadUrl(entry?.url), entry])
      .filter(([key]) => Boolean(key)),
  );

const collectScopedUploadUrlsFromDatasets = (datasets, scope) => {
  const uploadUrls = new Set();
  DATASETS_TO_SCAN.forEach((datasetKey) => {
    collectUploadUrlsDeep(datasets?.[datasetKey], uploadUrls);
  });
  return [...uploadUrls]
    .filter((uploadUrl) => scope.matchesUploadUrl(uploadUrl))
    .sort((a, b) => a.localeCompare(b, "en"));
};

const uploadExists = async ({
  uploadUrl,
  uploadsDir,
  uploadEntry,
  mode = "fast",
  storageService,
} = {}) => {
  const storageProvider = readUploadStorageProvider(uploadEntry);
  if (storageProvider === "s3") {
    if (!uploadEntry) {
      return false;
    }
    if (
      String(mode || "fast")
        .trim()
        .toLowerCase() !== "deep"
    ) {
      return true;
    }
    if (!storageService) {
      return false;
    }
    const remoteHead = await storageService.headUpload({
      provider: "s3",
      uploadUrl,
    });
    return Boolean(remoteHead?.exists);
  }
  const relative = getUploadRelativePath(uploadUrl);
  const diskPath = path.join(uploadsDir, relative);
  return fileExists(diskPath);
};

const collectMissingUploadRefsFromDatasets = async (datasets, uploadsDir, options = {}) => {
  const scope =
    options.scope ||
    buildUploadFilterScope({
      uploads: datasets?.uploads,
      folder: options.folder,
      uploadId: options.uploadId,
      url: options.url,
    });
  const uploadUrls = collectScopedUploadUrlsFromDatasets(datasets, scope);
  const uploadsByUrl = buildUploadsByUrl(datasets);

  const missing = [];
  for (const uploadUrl of uploadUrls) {
    const relative = getUploadRelativePath(uploadUrl);
    const exists = await uploadExists({
      uploadUrl,
      uploadsDir,
      uploadEntry: uploadsByUrl.get(uploadUrl) || null,
      ...options,
    });
    if (!exists) {
      missing.push({
        type: "missing_source_file",
        url: uploadUrl,
        path: relative,
      });
    }
  }
  return missing;
};

const collectMissingVariantRefsFromUploads = async (datasets, uploadsDir, options = {}) => {
  const scope =
    options.scope ||
    buildUploadFilterScope({
      uploads: datasets?.uploads,
      folder: options.folder,
      uploadId: options.uploadId,
      url: options.url,
    });
  const uploads = Array.isArray(scope.selectedUploads) ? scope.selectedUploads : [];
  const issues = [];

  for (const upload of uploads) {
    const variants = upload?.variants;
    if (!variants || typeof variants !== "object") {
      continue;
    }
    for (const [presetKey, presetRecord] of Object.entries(variants)) {
      const formats =
        presetRecord?.formats && typeof presetRecord.formats === "object"
          ? presetRecord.formats
          : null;
      if (!formats) {
        continue;
      }
      for (const [formatKey, formatRecord] of Object.entries(formats)) {
        const uploadUrl = normalizePublicUploadUrl(formatRecord?.url);
        if (!uploadUrl) {
          continue;
        }
        const relative = getUploadRelativePath(uploadUrl);
        const exists = await uploadExists({
          uploadUrl,
          uploadsDir,
          uploadEntry: upload,
          ...options,
        });
        if (exists) {
          continue;
        }
        issues.push({
          type: "missing_variant_file",
          url: uploadUrl,
          path: relative,
          target: `${String(upload?.id || "")}:${presetKey}:${formatKey}`,
        });
      }
    }
  }

  return issues;
};

const filterReorganizationReportByScope = (report, scope) => {
  const mappings = (Array.isArray(report?.mappings) ? report.mappings : []).filter(
    (item) => scope.matchesUploadUrl(item?.oldUrl) || scope.matchesUploadUrl(item?.newUrl),
  );
  const failures = (Array.isArray(report?.failures) ? report.failures : []).filter(
    (item) => scope.matchesUploadUrl(item?.oldUrl) || scope.matchesUploadUrl(item?.newUrl),
  );
  const skipped = (Array.isArray(report?.skipped) ? report.skipped : []).filter((item) =>
    scope.matchesUploadUrl(item?.url),
  );
  return {
    ...(report && typeof report === "object" ? report : {}),
    mappings,
    failures,
    skipped,
    plannedMovesCount: mappings.length,
    moveFailuresCount: failures.length,
  };
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

export const runUploadsIntegrityCheck = async ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  maxExamples = 20,
  privateRootFolders,
  mode = "fast",
  storageService,
  folder = "",
  uploadId = "",
  url = "",
} = {}) => {
  const safeMode =
    String(mode || "fast")
      .trim()
      .toLowerCase() === "deep"
      ? "deep"
      : "fast";
  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  const scope = buildUploadFilterScope({
    uploads,
    folder,
    uploadId,
    url,
  });
  const hasRemoteUploads = scope.selectedUploads.some(
    (entry) => readUploadStorageProvider(entry) === "s3",
  );
  const reorganizationReport = hasRemoteUploads
    ? {
        skipped: [],
        rewritten: datasets || {},
        referencedUrlsCount: collectScopedUploadUrlsFromDatasets(datasets, scope).length,
        plannedMovesCount: 0,
        uploadsInventoryCount: scope.selectedUploads.length,
      }
    : runUploadsReorganization({
        datasets,
        uploadsDir,
        applyChanges: false,
        privateRootFolders,
      });
  const scopedReorganizationReport = filterReorganizationReportByScope(reorganizationReport, scope);
  const datasetsForScan = {
    ...(datasets && typeof datasets === "object" ? datasets : {}),
    ...(reorganizationReport.rewritten && typeof reorganizationReport.rewritten === "object"
      ? reorganizationReport.rewritten
      : {}),
  };
  const referencedUrls = collectScopedUploadUrlsFromDatasets(datasetsForScan, scope);

  const criticalFromReorganization = (scopedReorganizationReport.skipped || [])
    .filter((issue) => hasCriticalType(issue?.type))
    .map((issue) => normalizeIssue(issue, "reorganization"));
  const criticalFromDatasetScan = (
    await collectMissingUploadRefsFromDatasets(datasetsForScan, uploadsDir, {
      mode: safeMode,
      storageService,
      scope,
    })
  ).map((issue) => normalizeIssue(issue, "dataset-scan"));
  const criticalFromUploadsMetadata = (
    await collectMissingVariantRefsFromUploads(datasetsForScan, uploadsDir, {
      mode: safeMode,
      storageService,
      scope,
    })
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
    reorganizationReport: scopedReorganizationReport,
    referencedUrlsCount: referencedUrls.length,
    plannedMovesCount: scopedReorganizationReport.plannedMovesCount,
    uploadsInventoryCount: scope.selectedUploads.length,
  };
};

export const __testing = {
  collectScopedUploadUrlsFromDatasets,
  collectUploadUrlsDeep,
  collectMissingUploadRefsFromDatasets,
  collectMissingVariantRefsFromUploads,
  filterReorganizationReportByScope,
  getUploadRelativePath,
  hasCriticalType,
  mergeCriticalIssues,
};
