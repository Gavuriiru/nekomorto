import fs from "fs";
import path from "path";

import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";
import {
  attachUploadMediaMetadata,
  computeBufferSha256,
  isRasterUploadMime,
  normalizeVariants,
  PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
  resolveUploadAbsolutePath,
} from "../server/lib/upload-media.js";
import {
  extractUploadUrlsFromText,
  normalizeUploadUrl,
} from "../server/lib/uploads-reorganizer.js";

const rootDir = path.resolve(process.cwd());
const uploadsDir = path.join(rootDir, "public", "uploads");
const shouldApply = process.argv.includes("--apply");

const DATASET_KEYS_TO_SCAN = Object.freeze([
  "posts",
  "projects",
  "users",
  "comments",
  "updates",
  "pages",
  "siteSettings",
]);
const PROJECT_SAFE_DATASET_KEYS = new Set(["projects", "updates"]);
const PROJECT_VARIANT_PRESET_KEY_SET = new Set(PROJECT_UPLOAD_VARIANT_PRESET_KEYS);

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("DATABASE_URL obrigatoria.");
  process.exit(1);
}

const addDatasetUsage = (usageByUrl, uploadUrl, datasetKey) => {
  const normalizedUrl = normalizeUploadUrl(uploadUrl);
  if (!normalizedUrl) {
    return;
  }
  if (!usageByUrl.has(normalizedUrl)) {
    usageByUrl.set(normalizedUrl, new Set());
  }
  usageByUrl.get(normalizedUrl).add(datasetKey);
};

const collectUploadUrlsByDataset = (value, datasetKey, usageByUrl) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    addDatasetUsage(usageByUrl, value, datasetKey);
    extractUploadUrlsFromText(value).forEach((item) =>
      addDatasetUsage(usageByUrl, item, datasetKey),
    );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrlsByDataset(item, datasetKey, usageByUrl));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) =>
      collectUploadUrlsByDataset(item, datasetKey, usageByUrl),
    );
  }
};

const collectUsageByUrl = (datasets) => {
  const usageByUrl = new Map();
  DATASET_KEYS_TO_SCAN.forEach((datasetKey) => {
    collectUploadUrlsByDataset(datasets?.[datasetKey], datasetKey, usageByUrl);
  });
  return usageByUrl;
};

const getVariantSummary = (variants, presetFilter = null) => {
  const normalizedVariants = normalizeVariants(variants);
  let bytes = 0;
  let files = 0;

  Object.entries(normalizedVariants).forEach(([presetKey, preset]) => {
    if (presetFilter && !presetFilter.has(presetKey)) {
      return;
    }
    Object.values(preset?.formats || {}).forEach((format) => {
      const size = Number(format?.size || 0);
      if (!Number.isFinite(size) || size <= 0) {
        return;
      }
      bytes += size;
      files += 1;
    });
  });

  return { bytes, files };
};

const isProjectAreaUpload = (upload) => {
  const area = String(upload?.area || upload?.folder || "")
    .trim()
    .toLowerCase();
  return area === "projects" || area.startsWith("projects/");
};

const sortDatasetKeys = (value) =>
  [...new Set(value)].sort((left, right) => left.localeCompare(right, "pt-BR"));

try {
  const datasets = await loadDbDatasets(prisma);
  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  if (uploads.length === 0) {
    console.log("Nenhum upload encontrado para avaliar.");
    process.exit(0);
  }

  const usageByUrl = collectUsageByUrl(datasets);
  const nextUploads = [...uploads];
  const sample = [];

  let scanned = 0;
  let projectAreaUploads = 0;
  let candidates = 0;
  let updated = 0;
  let skippedNonProject = 0;
  let skippedNonRaster = 0;
  let skippedWithoutVariants = 0;
  let skippedAlreadyOptimized = 0;
  let skippedIncompleteProfile = 0;
  let skippedUnreferenced = 0;
  let skippedCrossDatasetReuse = 0;
  let skippedMissingSource = 0;
  let failed = 0;
  let estimatedBytesSaved = 0;
  let estimatedFilesSaved = 0;
  let appliedBytesSaved = 0;
  const failures = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const current = uploads[index];
    scanned += 1;

    if (!isProjectAreaUpload(current)) {
      skippedNonProject += 1;
      continue;
    }
    projectAreaUploads += 1;

    if (!isRasterUploadMime(current?.mime)) {
      skippedNonRaster += 1;
      continue;
    }

    const currentVariants = normalizeVariants(current?.variants);
    const currentPresetKeys = Object.keys(currentVariants);
    if (currentPresetKeys.length === 0) {
      skippedWithoutVariants += 1;
      continue;
    }

    const missingDesiredPresetKeys = PROJECT_UPLOAD_VARIANT_PRESET_KEYS.filter(
      (presetKey) => !currentPresetKeys.includes(presetKey),
    );
    if (missingDesiredPresetKeys.length > 0) {
      skippedIncompleteProfile += 1;
      continue;
    }

    const removablePresetKeys = currentPresetKeys.filter(
      (presetKey) => !PROJECT_VARIANT_PRESET_KEY_SET.has(presetKey),
    );
    if (removablePresetKeys.length === 0) {
      skippedAlreadyOptimized += 1;
      continue;
    }

    const normalizedUrl = normalizeUploadUrl(current?.url);
    const referencedDatasets = normalizedUrl
      ? sortDatasetKeys(usageByUrl.get(normalizedUrl) || [])
      : [];
    if (referencedDatasets.length === 0) {
      skippedUnreferenced += 1;
      continue;
    }
    const hasDisallowedReference = referencedDatasets.some(
      (datasetKey) => !PROJECT_SAFE_DATASET_KEYS.has(datasetKey),
    );
    if (hasDisallowedReference) {
      skippedCrossDatasetReuse += 1;
      continue;
    }

    const sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: current?.url });
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      skippedMissingSource += 1;
      continue;
    }

    const currentVariantSummary = getVariantSummary(currentVariants);
    const removableVariantSummary = getVariantSummary(
      currentVariants,
      new Set(removablePresetKeys),
    );
    const targetVariantSummary = getVariantSummary(currentVariants, PROJECT_VARIANT_PRESET_KEY_SET);

    candidates += 1;
    estimatedBytesSaved += removableVariantSummary.bytes;
    estimatedFilesSaved += removableVariantSummary.files;

    if (sample.length < 20) {
      sample.push({
        id: String(current?.id || ""),
        url: String(current?.url || ""),
        referencedDatasets,
        removablePresetKeys,
        currentVariantBytes: currentVariantSummary.bytes,
        targetVariantBytes: targetVariantSummary.bytes,
        estimatedBytesSaved: removableVariantSummary.bytes,
      });
    }

    if (!shouldApply) {
      continue;
    }

    try {
      const sourceBuffer = fs.readFileSync(sourcePath);
      const next = await attachUploadMediaMetadata({
        uploadsDir,
        entry: current,
        sourcePath,
        sourceMime: current?.mime,
        hashSha256: computeBufferSha256(sourceBuffer),
        variantsVersion: Math.max(1, Number(current?.variantsVersion || 1)),
        regenerateVariants: true,
        variantPresetKeys: PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
      });
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        nextUploads[index] = next;
        updated += 1;
        appliedBytesSaved += Math.max(
          0,
          Number(current?.variantBytes || currentVariantSummary.bytes) -
            Number(next?.variantBytes || 0),
        );
      }
    } catch (error) {
      failed += 1;
      failures.push({
        id: String(current?.id || ""),
        url: String(current?.url || ""),
        error: String(error?.message || error || "unknown_error"),
      });
    }
  }

  if (shouldApply && updated > 0) {
    await persistDbDatasets(prisma, { uploads: nextUploads }, ["uploads"]);
  }

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? "apply" : "dry-run",
        scanned,
        projectAreaUploads,
        candidates,
        updated,
        skippedNonProject,
        skippedNonRaster,
        skippedWithoutVariants,
        skippedAlreadyOptimized,
        skippedIncompleteProfile,
        skippedUnreferenced,
        skippedCrossDatasetReuse,
        skippedMissingSource,
        failed,
        estimatedBytesSaved,
        estimatedFilesSaved,
        appliedBytesSaved,
        projectPresetKeys: PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
        sample,
        failures,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failure
  }
}
