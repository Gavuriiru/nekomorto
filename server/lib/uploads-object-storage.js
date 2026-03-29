import fs from "fs";
import path from "path";
import {
  attachUploadMediaMetadata,
  computeBufferSha256,
  isRasterUploadMime,
  resolveUploadAbsolutePath,
} from "./upload-media.js";
import { buildUploadFilterScope } from "./upload-filter-scope.js";
import {
  getUploadAssetDescriptors,
  readUploadStorageProvider,
  streamToBuffer,
} from "./upload-storage.js";

const readLocalAssetBuffer = ({ uploadsDir, uploadUrl }) => {
  const sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl });
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`local_asset_missing:${uploadUrl}`);
  }
  return fs.readFileSync(sourcePath);
};

const writeLocalAssetBuffer = ({ uploadsDir, uploadUrl, buffer }) => {
  const targetPath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl });
  if (!targetPath) {
    throw new Error(`invalid_upload_path:${uploadUrl}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
};

const localAssetExists = ({ uploadsDir, uploadUrl }) => {
  const targetPath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl });
  return Boolean(targetPath && fs.existsSync(targetPath));
};

const pickUploads = (uploads, options = {}) =>
  buildUploadFilterScope({
    uploads,
    folder: options.folder,
    uploadId: options.uploadId,
    url: options.url,
  }).selectedUploads;

const collectFailures = (failures) =>
  [...(Array.isArray(failures) ? failures : [])].sort((left, right) =>
    String(left?.url || "").localeCompare(String(right?.url || ""), "en"),
  );

const findUploadIndex = (uploads, entry) =>
  (Array.isArray(uploads) ? uploads : []).findIndex(
    (item) => String(item?.id || "") === String(entry?.id || ""),
  );

const getOriginalUploadAssetDescriptor = (entry) =>
  getUploadAssetDescriptors(entry).find((asset) => asset?.kind === "original") || null;

const listMissingLocalVariantAssets = (entry, uploadsDir) =>
  getUploadAssetDescriptors(entry).filter(
    (asset) => asset?.kind === "variant" && !localAssetExists({ uploadsDir, uploadUrl: asset.url }),
  );

const resolveEntrySourcePath = (entry, uploadsDir) =>
  resolveUploadAbsolutePath({ uploadsDir, uploadUrl: entry?.url });

const updateUploadEntryFromLocalSource = async ({ entry, uploadsDir } = {}) => {
  const sourcePath = resolveEntrySourcePath(entry, uploadsDir);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`local_asset_missing:${entry?.url}`);
  }
  const sourceBuffer = fs.readFileSync(sourcePath);
  const originalAsset = getOriginalUploadAssetDescriptor(entry);
  const sourceMime = String(originalAsset?.contentType || entry?.mime || "").trim();
  const nextEntry = await attachUploadMediaMetadata({
    uploadsDir,
    entry: {
      ...(entry && typeof entry === "object" ? entry : {}),
      storageProvider: "local",
    },
    sourcePath,
    sourceMime,
    hashSha256: computeBufferSha256(sourceBuffer),
    variantsVersion: Math.max(1, Number(entry?.variantsVersion || 1)),
    regenerateVariants: true,
  });
  const stat = fs.statSync(sourcePath);
  return {
    ...nextEntry,
    storageProvider: "local",
    size: Number(stat.size || 0),
  };
};

const repairUploadEntryMissingLocalAssets = async ({
  entry,
  uploadsDir,
  storageService,
  applyChanges = false,
} = {}) => {
  const currentEntry = entry && typeof entry === "object" ? entry : null;
  if (!currentEntry) {
    return { status: "skipped", nextEntry: entry };
  }

  const originalAsset = getOriginalUploadAssetDescriptor(currentEntry);
  if (!originalAsset?.url) {
    return { status: "skipped", nextEntry: currentEntry };
  }

  const originalExistsLocally = localAssetExists({
    uploadsDir,
    uploadUrl: originalAsset.url,
  });
  const missingVariantAssets = listMissingLocalVariantAssets(currentEntry, uploadsDir);

  if (originalExistsLocally && missingVariantAssets.length === 0) {
    return { status: "skipped", nextEntry: currentEntry };
  }

  if (!originalExistsLocally) {
    const remoteHead = await storageService.headUpload({
      provider: "s3",
      uploadUrl: originalAsset.url,
    });
    if (!remoteHead?.exists) {
      throw new Error(`remote_asset_missing:${originalAsset.url}`);
    }
    if (applyChanges) {
      const response = await storageService.getUploadStream({
        provider: "s3",
        uploadUrl: originalAsset.url,
      });
      const buffer = await streamToBuffer(response.stream);
      writeLocalAssetBuffer({
        uploadsDir,
        uploadUrl: originalAsset.url,
        buffer,
      });
    }
  }

  const sourceMime = String(originalAsset.contentType || currentEntry?.mime || "").trim();
  if (missingVariantAssets.length > 0 && !isRasterUploadMime(sourceMime)) {
    throw new Error(`non_raster_upload_cannot_regenerate_variants:${currentEntry?.url}`);
  }

  if (!applyChanges) {
    return { status: "repaired", nextEntry: currentEntry };
  }

  const nextEntry = await updateUploadEntryFromLocalSource({
    entry: currentEntry,
    uploadsDir,
  });
  return {
    status: "repaired",
    nextEntry,
  };
};

export const syncUploadsToObjectStorage = async ({
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  storageService,
  applyChanges = false,
  folder = "",
  uploadId = "",
  url = "",
} = {}) => {
  const selectedUploads = pickUploads(uploads, { folder, uploadId, url });
  const failures = [];
  let syncedCount = 0;
  let skippedCount = 0;
  const nextUploads = [...(Array.isArray(uploads) ? uploads : [])];

  for (const entry of selectedUploads) {
    const currentProvider = readUploadStorageProvider(entry);
    if (currentProvider === "s3") {
      skippedCount += 1;
      continue;
    }

    const assets = getUploadAssetDescriptors(entry);
    if (assets.length === 0) {
      skippedCount += 1;
      continue;
    }

    try {
      for (const asset of assets) {
        const buffer = readLocalAssetBuffer({ uploadsDir, uploadUrl: asset.url });
        const remoteHead = await storageService.headUpload({
          provider: "s3",
          uploadUrl: asset.url,
        });
        if (
          remoteHead?.exists &&
          Number.isFinite(Number(asset.expectedSize)) &&
          Number(remoteHead?.contentLength) === Number(asset.expectedSize)
        ) {
          continue;
        }
        if (applyChanges) {
          await storageService.putUploadUrl({
            provider: "s3",
            uploadUrl: asset.url,
            buffer,
            contentType: asset.contentType,
          });
        }
        const verification = applyChanges
          ? await storageService.headUpload({
              provider: "s3",
              uploadUrl: asset.url,
            })
          : { exists: true };
        if (!verification?.exists) {
          throw new Error(`remote_asset_missing_after_sync:${asset.url}`);
        }
      }

      if (applyChanges) {
        const index = findUploadIndex(nextUploads, entry);
        if (index >= 0) {
          nextUploads[index] = {
            ...nextUploads[index],
            storageProvider: "s3",
          };
        }
      }
      syncedCount += 1;
    } catch (error) {
      failures.push({
        uploadId: String(entry?.id || ""),
        url: String(entry?.url || ""),
        reason: String(error?.message || error || "sync_failed"),
      });
    }
  }

  return {
    mode: applyChanges ? "apply" : "dry-run",
    changed: applyChanges && syncedCount > 0,
    selectedCount: selectedUploads.length,
    syncedCount,
    skippedCount,
    failedCount: failures.length,
    failures: collectFailures(failures),
    uploadsNext: nextUploads,
  };
};

export const restoreUploadsFromObjectStorage = async ({
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  storageService,
  applyChanges = false,
  folder = "",
  uploadId = "",
  url = "",
} = {}) => {
  const selectedUploads = pickUploads(uploads, { folder, uploadId, url }).filter(
    (entry) => readUploadStorageProvider(entry) === "s3",
  );
  const failures = [];
  let restoredCount = 0;
  let skippedCount = 0;
  const nextUploads = [...(Array.isArray(uploads) ? uploads : [])];

  for (const entry of selectedUploads) {
    const assets = getUploadAssetDescriptors(entry);
    if (assets.length === 0) {
      skippedCount += 1;
      continue;
    }

    try {
      for (const asset of assets) {
        if (!applyChanges) {
          const head = await storageService.headUpload({
            provider: "s3",
            uploadUrl: asset.url,
          });
          if (!head?.exists) {
            throw new Error(`remote_asset_missing:${asset.url}`);
          }
          continue;
        }
        const response = await storageService.getUploadStream({
          provider: "s3",
          uploadUrl: asset.url,
        });
        const buffer = await streamToBuffer(response.stream);
        writeLocalAssetBuffer({ uploadsDir, uploadUrl: asset.url, buffer });
      }

      if (applyChanges) {
        const index = findUploadIndex(nextUploads, entry);
        if (index >= 0) {
          nextUploads[index] = {
            ...nextUploads[index],
            storageProvider: "local",
          };
        }
      }
      restoredCount += 1;
    } catch (error) {
      failures.push({
        uploadId: String(entry?.id || ""),
        url: String(entry?.url || ""),
        reason: String(error?.message || error || "restore_failed"),
      });
    }
  }

  return {
    mode: applyChanges ? "apply" : "dry-run",
    operation: "restore-from-object-storage",
    changed: applyChanges && restoredCount > 0,
    selectedCount: selectedUploads.length,
    restoredCount,
    skippedCount,
    failedCount: failures.length,
    failures: collectFailures(failures),
    uploadsNext: nextUploads,
  };
};

export const repairMissingLocalUploadsFromObjectStorage = async ({
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  storageService,
  applyChanges = false,
  folder = "",
  uploadId = "",
  url = "",
} = {}) => {
  const selectedUploads = pickUploads(uploads, { folder, uploadId, url }).filter(
    (entry) => readUploadStorageProvider(entry) !== "s3",
  );
  const failures = [];
  let repairedCount = 0;
  let skippedCount = 0;
  const nextUploads = [...(Array.isArray(uploads) ? uploads : [])];

  for (const entry of selectedUploads) {
    try {
      const result = await repairUploadEntryMissingLocalAssets({
        entry,
        uploadsDir,
        storageService,
        applyChanges,
      });
      if (result.status === "skipped") {
        skippedCount += 1;
        continue;
      }
      if (applyChanges) {
        const index = findUploadIndex(nextUploads, entry);
        if (index >= 0) {
          nextUploads[index] = result.nextEntry;
        }
      }
      repairedCount += 1;
    } catch (error) {
      failures.push({
        uploadId: String(entry?.id || ""),
        url: String(entry?.url || ""),
        reason: String(error?.message || error || "repair_missing_local_failed"),
      });
    }
  }

  return {
    mode: applyChanges ? "apply" : "dry-run",
    operation: "repair-missing-local",
    changed: applyChanges && repairedCount > 0,
    selectedCount: selectedUploads.length,
    repairedCount,
    restoredCount: repairedCount,
    skippedCount,
    failedCount: failures.length,
    failures: collectFailures(failures),
    uploadsNext: nextUploads,
  };
};
