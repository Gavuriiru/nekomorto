import "dotenv/config";
import fs from "fs";
import path from "path";

import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";
import {
  attachUploadMediaMetadata,
  computeBufferSha256,
  isRasterUploadMime,
  mergeUploadVariantPresetKeys,
  normalizeUploadVariantPresetKeys,
  normalizeVariants,
  POST_UPLOAD_VARIANT_PRESET_KEYS,
  PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
  USER_UPLOAD_VARIANT_PRESET_KEYS,
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

const DATASET_VARIANT_PRESET_KEYS = Object.freeze({
  posts: POST_UPLOAD_VARIANT_PRESET_KEYS,
  projects: PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
  updates: PROJECT_UPLOAD_VARIANT_PRESET_KEYS,
  users: USER_UPLOAD_VARIANT_PRESET_KEYS,
});

const KNOWN_POLICY_DATASET_KEYS = new Set(Object.keys(DATASET_VARIANT_PRESET_KEYS));

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

const sortDatasetKeys = (value) =>
  [...new Set(value)].sort((left, right) => left.localeCompare(right, "pt-BR"));

const getVariantSummary = (variants, presetKeys = null) => {
  const normalizedVariants = normalizeVariants(variants);
  const allowedPresetKeys =
    Array.isArray(presetKeys) && presetKeys.length > 0 ? new Set(presetKeys) : null;
  let bytes = 0;
  let files = 0;

  Object.entries(normalizedVariants).forEach(([presetKey, preset]) => {
    if (allowedPresetKeys && !allowedPresetKeys.has(presetKey)) {
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

const hasSamePresetKeys = (left, right) =>
  left.length === right.length && left.every((presetKey) => right.includes(presetKey));

const buildTargetPresetKeys = (upload, referencedDatasets) => {
  let targetPresetKeys = resolveUploadVariantPresetKeysForArea(
    upload?.area || upload?.folder || "",
  );
  const ambiguousReferencedDatasets = [];

  referencedDatasets.forEach((datasetKey) => {
    const datasetPresetKeys = DATASET_VARIANT_PRESET_KEYS[datasetKey];
    if (!datasetPresetKeys) {
      ambiguousReferencedDatasets.push(datasetKey);
      return;
    }
    targetPresetKeys = mergeUploadVariantPresetKeys(targetPresetKeys, datasetPresetKeys);
  });

  return {
    targetPresetKeys: normalizeUploadVariantPresetKeys(targetPresetKeys),
    ambiguousReferencedDatasets,
  };
};

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
  let candidates = 0;
  let updated = 0;
  let skippedNonRaster = 0;
  let skippedAlreadyAligned = 0;
  let skippedMissingSource = 0;
  let skippedAmbiguousShrink = 0;
  let failed = 0;
  let shrinkCandidates = 0;
  let expandCandidates = 0;
  let mixedCandidates = 0;
  let estimatedBytesReclaimed = 0;
  let estimatedFilesReclaimed = 0;
  let appliedBytesDelta = 0;
  const failures = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const current = uploads[index];
    scanned += 1;

    if (!isRasterUploadMime(current?.mime)) {
      skippedNonRaster += 1;
      continue;
    }

    const currentVariants = normalizeVariants(current?.variants);
    const currentPresetKeys = normalizeUploadVariantPresetKeys(Object.keys(currentVariants));
    const normalizedUrl = normalizeUploadUrl(current?.url);
    const referencedDatasets = normalizedUrl
      ? sortDatasetKeys(usageByUrl.get(normalizedUrl) || [])
      : [];
    const { targetPresetKeys, ambiguousReferencedDatasets } = buildTargetPresetKeys(
      current,
      referencedDatasets,
    );
    const wouldShrink = currentPresetKeys.some(
      (presetKey) => !targetPresetKeys.includes(presetKey),
    );
    const wouldExpand = targetPresetKeys.some(
      (presetKey) => !currentPresetKeys.includes(presetKey),
    );

    if (hasSamePresetKeys(currentPresetKeys, targetPresetKeys)) {
      skippedAlreadyAligned += 1;
      continue;
    }

    if (wouldShrink && ambiguousReferencedDatasets.length > 0) {
      skippedAmbiguousShrink += 1;
      continue;
    }

    if (wouldShrink && wouldExpand) {
      mixedCandidates += 1;
    } else if (wouldShrink) {
      shrinkCandidates += 1;
    } else if (wouldExpand) {
      expandCandidates += 1;
    }

    const currentVariantSummary = getVariantSummary(currentVariants);
    const removablePresetKeys = currentPresetKeys.filter(
      (presetKey) => !targetPresetKeys.includes(presetKey),
    );
    const removableVariantSummary = getVariantSummary(currentVariants, removablePresetKeys);

    candidates += 1;
    estimatedBytesReclaimed += removableVariantSummary.bytes;
    estimatedFilesReclaimed += removableVariantSummary.files;

    if (sample.length < 25) {
      sample.push({
        id: String(current?.id || ""),
        area: String(current?.area || ""),
        folder: String(current?.folder || ""),
        url: String(current?.url || ""),
        referencedDatasets,
        ambiguousReferencedDatasets,
        currentPresetKeys,
        targetPresetKeys,
        currentVariantBytes: currentVariantSummary.bytes,
        estimatedBytesReclaimed: removableVariantSummary.bytes,
      });
    }

    if (!shouldApply) {
      continue;
    }

    const sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: current?.url });
    const requiresSource = targetPresetKeys.length > 0;
    if (requiresSource && (!sourcePath || !fs.existsSync(sourcePath))) {
      skippedMissingSource += 1;
      continue;
    }

    try {
      const sourceBuffer =
        sourcePath && fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath) : null;
      const next = await attachUploadMediaMetadata({
        uploadsDir,
        entry: current,
        sourcePath: sourcePath || undefined,
        sourceMime: current?.mime,
        hashSha256: sourceBuffer ? computeBufferSha256(sourceBuffer) : current?.hashSha256,
        variantsVersion: Math.max(1, Number(current?.variantsVersion || 1)),
        regenerateVariants: true,
        variantPresetKeys: targetPresetKeys,
      });
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        nextUploads[index] = next;
        updated += 1;
        appliedBytesDelta +=
          Number(next?.variantBytes || 0) -
          Number(current?.variantBytes || currentVariantSummary.bytes || 0);
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
        candidates,
        updated,
        skippedNonRaster,
        skippedAlreadyAligned,
        skippedMissingSource,
        skippedAmbiguousShrink,
        failed,
        shrinkCandidates,
        expandCandidates,
        mixedCandidates,
        estimatedBytesReclaimed,
        estimatedFilesReclaimed,
        appliedBytesDelta,
        datasetPolicies: Object.fromEntries(
          Object.entries(DATASET_VARIANT_PRESET_KEYS).map(([datasetKey, presetKeys]) => [
            datasetKey,
            presetKeys,
          ]),
        ),
        knownPolicyDatasets: [...KNOWN_POLICY_DATASET_KEYS].sort((left, right) =>
          left.localeCompare(right, "pt-BR"),
        ),
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
