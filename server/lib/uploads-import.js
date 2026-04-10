import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  attachUploadMediaMetadata,
  computeBufferSha256,
  findUploadByHash,
  mergeUploadVariantPresetKeys,
  normalizeUploadVariantPresetKeys,
  normalizeVariants,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
} from "./upload-media.js";
import {
  ALLOWED_UPLOAD_IMAGE_MIMES,
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  getUploadExtFromMime,
  normalizeUploadMime,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  validateUploadRasterDimensions,
} from "./upload-runtime-helpers.js";

export const EPUB_IMPORT_TMP_PREFIX = "tmp/epub-imports";
export const EPUB_IMPORT_TMP_TTL_MS = 72 * 60 * 60 * 1000;

const sanitizeUploadExactFileName = (value, mime) => {
  const normalizedValue = String(value || "").trim();
  const normalizedMime = normalizeUploadMime(mime);
  const expectedExt = getUploadExtFromMime(normalizedMime);
  const parsed = path.parse(normalizedValue);
  const baseName = sanitizeUploadBaseName(parsed.name || normalizedValue);
  return `${baseName || "imagem"}.${expectedExt}`;
};

const validateUploadImageBuffer = async (buffer, requestedMime) => {
  const mime = normalizeUploadMime(requestedMime);
  if (!ALLOWED_UPLOAD_IMAGE_MIMES.has(mime)) {
    return { valid: false, error: "unsupported_image_type" };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: "empty_upload" };
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    return { valid: false, error: "file_too_large" };
  }
  if (mime === "image/svg+xml") {
    if (buffer.length > MAX_SVG_SIZE_BYTES) {
      return { valid: false, error: "svg_too_large" };
    }
    return { valid: true, mime, dimensions: null };
  }

  try {
    const metadata = await sharp(buffer, { animated: false }).metadata();
    const dimensions = validateUploadRasterDimensions({
      width: metadata?.width,
      height: metadata?.height,
    });
    if (!dimensions.valid) {
      return dimensions;
    }
    return {
      valid: true,
      mime,
      dimensions: dimensions.dimensions,
    };
  } catch {
    return { valid: false, error: "invalid_image_data" };
  }
};

const buildUploadRelativeUrl = ({ folder, fileName }) =>
  `/uploads/${folder ? `${folder}/` : ""}${fileName}`;

const ensureUploadHasRequiredVariants = async ({
  uploadsDir,
  uploadEntry,
  sourceMime,
  hashSha256,
  variantPresetKeys,
} = {}) => {
  const currentEntry = uploadEntry && typeof uploadEntry === "object" ? uploadEntry : null;
  if (!currentEntry) {
    return uploadEntry;
  }
  const currentVariantPresetKeys = normalizeUploadVariantPresetKeys(
    Object.keys(normalizeVariants(currentEntry?.variants)),
  );
  const requestedVariantPresetKeys = normalizeUploadVariantPresetKeys(variantPresetKeys);
  if (
    requestedVariantPresetKeys.length === 0 ||
    requestedVariantPresetKeys.every((presetKey) => currentVariantPresetKeys.includes(presetKey))
  ) {
    return currentEntry;
  }
  const requiredVariantPresetKeys = mergeUploadVariantPresetKeys(
    currentVariantPresetKeys,
    requestedVariantPresetKeys,
  );
  const sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: currentEntry?.url });
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return currentEntry;
  }
  try {
    return await attachUploadMediaMetadata({
      uploadsDir,
      entry: currentEntry,
      sourcePath,
      sourceMime: sourceMime || normalizeUploadMime(currentEntry?.mime),
      hashSha256,
      variantsVersion: Math.max(1, Number(currentEntry?.variantsVersion || 1)),
      regenerateVariants: true,
      variantPresetKeys: requiredVariantPresetKeys,
    });
  } catch {
    return currentEntry;
  }
};

export const buildEpubImportTempFolder = ({ userId, importId }) =>
  sanitizeUploadFolder(
    `${EPUB_IMPORT_TMP_PREFIX}/${String(userId || "anonymous").trim() || "anonymous"}/${String(importId || "").trim() || crypto.randomUUID()}`,
    { trimTrailingSlash: true },
  );

export const isEpubImportTempFolder = (folder) =>
  sanitizeUploadFolder(folder, { trimTrailingSlash: true }).startsWith(`${EPUB_IMPORT_TMP_PREFIX}/`);

export const storeUploadImageBuffer = async ({
  uploadsDir,
  uploads,
  buffer,
  mime,
  filename,
  folder,
  altText = "",
  exactFileName,
  dedupeMode = "global",
} = {}) => {
  const nextUploads = Array.isArray(uploads) ? [...uploads] : [];
  const validation = await validateUploadImageBuffer(buffer, mime);
  if (!validation.valid) {
    const error = new Error(String(validation.error || "invalid_upload"));
    error.code = validation.error || "invalid_upload";
    throw error;
  }

  const normalizedMime = validation.mime;
  const safeFolder = sanitizeUploadFolder(folder, { trimTrailingSlash: true });
  const sourceBuffer =
    normalizedMime === "image/svg+xml"
      ? Buffer.from(sanitizeSvg(Buffer.from(buffer).toString("utf-8")), "utf-8")
      : Buffer.from(buffer);
  const hashSha256 = computeBufferSha256(sourceBuffer);
  const safeDedupeMode = dedupeMode === "none" || dedupeMode === "folder" ? dedupeMode : "global";
  const dedupePool =
    safeDedupeMode === "folder"
      ? nextUploads.filter((entry) => String(entry?.folder || "") === safeFolder)
      : nextUploads;
  const dedupeEntry = safeDedupeMode === "none" ? null : findUploadByHash(dedupePool, hashSha256);
  if (dedupeEntry) {
    const ensuredEntry = await ensureUploadHasRequiredVariants({
      uploadsDir,
      uploadEntry: dedupeEntry,
      sourceMime: normalizedMime,
      hashSha256,
      variantPresetKeys: resolveUploadVariantPresetKeysForArea(safeFolder),
    });
    if (ensuredEntry !== dedupeEntry) {
      const dedupeIndex = nextUploads.findIndex(
        (item) => String(item?.id || "") === String(dedupeEntry?.id || ""),
      );
      if (dedupeIndex >= 0) {
        nextUploads[dedupeIndex] = ensuredEntry;
      }
    }
    return {
      uploadEntry: ensuredEntry,
      uploads: nextUploads,
      dedupeHit: true,
      variantsGenerated: true,
      variantGenerationError: "",
      hashSha256,
    };
  }

  const ext = getUploadExtFromMime(normalizedMime);
  const fileName = exactFileName
    ? sanitizeUploadExactFileName(exactFileName, normalizedMime)
    : `${crypto.randomUUID()}.${ext}`;
  const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, sourceBuffer);

  const uploadEntryBase = {
    id: crypto.randomUUID(),
    url: buildUploadRelativeUrl({ folder: safeFolder, fileName }),
    fileName,
    folder: safeFolder,
    storageProvider: "local",
    size: sourceBuffer.length,
    mime: normalizedMime,
    width: validation.dimensions?.width || null,
    height: validation.dimensions?.height || null,
    area: safeFolder ? String(safeFolder).split("/")[0] : "root",
    createdAt: new Date().toISOString(),
    altText: String(altText || "").trim(),
  };

  let uploadEntry = uploadEntryBase;
  let variantsGenerated = true;
  let variantGenerationError = "";
  try {
    uploadEntry = await attachUploadMediaMetadata({
      uploadsDir,
      entry: uploadEntryBase,
      sourcePath: filePath,
      sourceMime: normalizedMime,
      hashSha256,
      regenerateVariants: true,
    });
  } catch (error) {
    variantsGenerated = false;
    variantGenerationError = String(error?.message || "variant_generation_failed");
    uploadEntry = {
      ...uploadEntryBase,
      hashSha256,
      variantsVersion: 1,
      variants: {},
      variantBytes: 0,
      area: safeFolder ? String(safeFolder).split("/")[0] : "root",
    };
  }

  nextUploads.push(uploadEntry);
  return {
    uploadEntry,
    uploads: nextUploads,
    dedupeHit: false,
    variantsGenerated,
    variantGenerationError,
    hashSha256,
  };
};
