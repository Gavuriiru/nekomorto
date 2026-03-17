import fs from "fs";
import path from "path";
import {
  getUploadAssetDescriptors,
  readUploadStorageProvider,
  streamToBuffer,
} from "./upload-storage.js";
import { resolveUploadAbsolutePath } from "./upload-media.js";

const normalizeFilterFolder = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const matchesFolderFilter = (entry, folder) => {
  const normalizedFilter = normalizeFilterFolder(folder);
  if (!normalizedFilter) {
    return true;
  }
  const entryFolder = normalizeFilterFolder(entry?.folder);
  return entryFolder === normalizedFilter || entryFolder.startsWith(`${normalizedFilter}/`);
};

const matchesUploadIdFilter = (entry, uploadId) => {
  const normalizedId = String(uploadId || "").trim();
  if (!normalizedId) {
    return true;
  }
  return String(entry?.id || "").trim() === normalizedId;
};

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

const pickUploads = (uploads, options = {}) =>
  (Array.isArray(uploads) ? uploads : []).filter(
    (entry) =>
      matchesFolderFilter(entry, options.folder) && matchesUploadIdFilter(entry, options.uploadId),
  );

const collectFailures = (failures) =>
  [...(Array.isArray(failures) ? failures : [])].sort((left, right) =>
    String(left?.url || "").localeCompare(String(right?.url || ""), "en"),
  );

export const syncUploadsToObjectStorage = async ({
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  storageService,
  applyChanges = false,
  folder = "",
  uploadId = "",
} = {}) => {
  const selectedUploads = pickUploads(uploads, { folder, uploadId });
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
        const index = nextUploads.findIndex(
          (item) => String(item?.id || "") === String(entry?.id || ""),
        );
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
} = {}) => {
  const selectedUploads = pickUploads(uploads, { folder, uploadId }).filter(
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
        const index = nextUploads.findIndex(
          (item) => String(item?.id || "") === String(entry?.id || ""),
        );
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
    changed: applyChanges && restoredCount > 0,
    selectedCount: selectedUploads.length,
    restoredCount,
    skippedCount,
    failedCount: failures.length,
    failures: collectFailures(failures),
    uploadsNext: nextUploads,
  };
};
