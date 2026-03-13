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

const MAX_SVG_SIZE_BYTES = 256 * 1024;
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 8192;
const MAX_UPLOAD_IMAGE_PIXELS = 33_554_432;

const ALLOWED_UPLOAD_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const UPLOAD_MIME_TO_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const EPUB_IMPORT_TMP_PREFIX = "tmp/epub-imports";
export const EPUB_IMPORT_TMP_TTL_MS = 72 * 60 * 60 * 1000;

const normalizeUploadMime = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};

const sanitizeUploadFolder = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
};

const sanitizeUploadBaseName = (value) =>
  String(value || "upload")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getUploadExtFromMime = (value) =>
  UPLOAD_MIME_TO_EXTENSION[String(value || "").toLowerCase()] || "png";

const sanitizeSvg = (value) => {
  if (!value) {
    return "";
  }
  let output = String(value);
  output = output.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  output = output.replace(/<\s*foreignObject[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "");
  output = output.replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  output = output.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
  output = output.replace(/javascript:/gi, "");
  output = output.replace(/data:(?!image\/(png|jpe?g|gif|webp);base64)/gi, "");
  output = output.replace(
    /(href|xlink:href|src)\s*=\s*(["'])(.*?)\2/gi,
    (_match, attr, quote, url) => {
      const safe = String(url || "");
      if (safe.startsWith("#") || safe.startsWith("/")) {
        return `${attr}=${quote}${safe}${quote}`;
      }
      return "";
    },
  );
  return output;
};

const validateRasterDimensions = ({ width, height }) => {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return { valid: false, error: "invalid_image_dimensions" };
  }
  if (safeWidth > MAX_UPLOAD_IMAGE_DIMENSION || safeHeight > MAX_UPLOAD_IMAGE_DIMENSION) {
    return { valid: false, error: "image_dimensions_too_large" };
  }
  if (safeWidth * safeHeight > MAX_UPLOAD_IMAGE_PIXELS) {
    return { valid: false, error: "image_pixel_count_too_large" };
  }
  return {
    valid: true,
    dimensions: {
      width: safeWidth,
      height: safeHeight,
    },
  };
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
    const dimensions = validateRasterDimensions({
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
  );

export const isEpubImportTempFolder = (folder) =>
  sanitizeUploadFolder(folder).startsWith(`${EPUB_IMPORT_TMP_PREFIX}/`);

export const storeUploadImageBuffer = async ({
  uploadsDir,
  uploads,
  buffer,
  mime,
  filename,
  folder,
  altText = "",
} = {}) => {
  const nextUploads = Array.isArray(uploads) ? [...uploads] : [];
  const validation = await validateUploadImageBuffer(buffer, mime);
  if (!validation.valid) {
    const error = new Error(String(validation.error || "invalid_upload"));
    error.code = validation.error || "invalid_upload";
    throw error;
  }

  const normalizedMime = validation.mime;
  const safeFolder = sanitizeUploadFolder(folder);
  const sourceBuffer =
    normalizedMime === "image/svg+xml"
      ? Buffer.from(sanitizeSvg(Buffer.from(buffer).toString("utf-8")), "utf-8")
      : Buffer.from(buffer);
  const hashSha256 = computeBufferSha256(sourceBuffer);
  const dedupeEntry = findUploadByHash(nextUploads, hashSha256);
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
  const safeName = sanitizeUploadBaseName(filename || "upload");
  const fileName = `${safeName || "imagem"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
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
