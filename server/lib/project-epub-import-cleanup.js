import fs from "fs";
import path from "path";
import { isEpubImportTempFolder } from "./uploads-import.js";
import { resolveUploadAbsolutePath } from "./upload-media.js";

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const normalizeImportId = (value) => String(value || "").trim();

const normalizeUploadUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("/uploads/")) {
    return raw.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(raw);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    return "";
  }
  return "";
};

const isPathInsideRoot = (rootPath, targetPath) => {
  const safeRoot = path.resolve(rootPath);
  const safeTarget = path.resolve(targetPath);
  const relative = path.relative(safeRoot, safeTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const parseTempImportFolder = (folder) => {
  if (!isEpubImportTempFolder(folder)) {
    return null;
  }
  const normalized = toPosix(String(folder || "").trim()).replace(/^\/+/, "").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "tmp" || parts[1] !== "epub-imports") {
    return null;
  }
  return {
    ownerId: String(parts[2] || "").trim(),
    importId: String(parts[3] || "").trim(),
  };
};

const removeUploadVariantDir = ({ uploadsDir, uploadId }) => {
  const safeUploadId = String(uploadId || "").trim();
  if (!safeUploadId) {
    return;
  }
  const variantsRootDir = path.resolve(path.join(uploadsDir, "_variants"));
  const variantDir = path.resolve(path.join(variantsRootDir, safeUploadId));
  if (!isPathInsideRoot(variantsRootDir, variantDir)) {
    throw new Error("invalid_variant_path");
  }
  fs.rmSync(variantDir, { recursive: true, force: true });
};

export const cleanupProjectEpubImportTempUploads = ({
  importIds,
  uploadUserId,
  uploads,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  usedUploadUrls,
} = {}) => {
  const requestedImportIds = Array.from(
    new Set((Array.isArray(importIds) ? importIds : []).map(normalizeImportId).filter(Boolean)),
  );
  const requestedImportIdSet = new Set(requestedImportIds);
  const safeUserId = String(uploadUserId || "anonymous").trim() || "anonymous";
  const usedUrlSet = new Set(
    (usedUploadUrls instanceof Set ? Array.from(usedUploadUrls) : Array.isArray(usedUploadUrls) ? usedUploadUrls : [])
      .map((item) => normalizeUploadUrl(item))
      .filter(Boolean),
  );

  if (requestedImportIds.length === 0) {
    return {
      requestedImportIds,
      matchedUploads: 0,
      deletedUploads: 0,
      skippedInUse: 0,
      skippedNotOwned: 0,
      failed: 0,
      failures: [],
      changed: false,
      uploadsNext: Array.isArray(uploads) ? uploads : [],
    };
  }

  const sourceUploads = Array.isArray(uploads) ? uploads : [];
  const uploadsNext = [];
  const failures = [];
  let matchedUploads = 0;
  let deletedUploads = 0;
  let skippedInUse = 0;
  let skippedNotOwned = 0;
  let failed = 0;

  sourceUploads.forEach((upload) => {
    const tempInfo = parseTempImportFolder(upload?.folder);
    if (!tempInfo || !requestedImportIdSet.has(tempInfo.importId)) {
      uploadsNext.push(upload);
      return;
    }

    matchedUploads += 1;
    if (tempInfo.ownerId !== safeUserId) {
      skippedNotOwned += 1;
      uploadsNext.push(upload);
      return;
    }

    const normalizedUrl = normalizeUploadUrl(upload?.url);
    if (!normalizedUrl) {
      failed += 1;
      failures.push({
        url: String(upload?.url || ""),
        reason: "invalid_upload_url",
      });
      uploadsNext.push(upload);
      return;
    }
    if (usedUrlSet.has(normalizedUrl)) {
      skippedInUse += 1;
      uploadsNext.push(upload);
      return;
    }

    try {
      const absoluteUploadPath = resolveUploadAbsolutePath({
        uploadsDir,
        uploadUrl: normalizedUrl,
      });
      if (!absoluteUploadPath || !isPathInsideRoot(uploadsDir, absoluteUploadPath)) {
        throw new Error("invalid_upload_path");
      }
      fs.rmSync(absoluteUploadPath, { force: true });
      removeUploadVariantDir({
        uploadsDir,
        uploadId: upload?.id,
      });
      deletedUploads += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        url: normalizedUrl,
        reason: String(error?.message || error || "cleanup_failed"),
      });
      uploadsNext.push(upload);
    }
  });

  return {
    requestedImportIds,
    matchedUploads,
    deletedUploads,
    skippedInUse,
    skippedNotOwned,
    failed,
    failures,
    changed: deletedUploads > 0,
    uploadsNext,
  };
};

export const __testing = {
  isPathInsideRoot,
  normalizeUploadUrl,
  parseTempImportFolder,
};

