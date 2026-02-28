import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const UPLOAD_VARIANT_PRESETS = Object.freeze({
  thumb: Object.freeze({ width: 320, height: 320 }),
  card: Object.freeze({ width: 640, height: 360 }),
  hero: Object.freeze({ width: 1600, height: 900 }),
  og: Object.freeze({ width: 1200, height: 630 }),
});

export const UPLOAD_VARIANT_PRESET_KEYS = Object.freeze(Object.keys(UPLOAD_VARIANT_PRESETS));

const RASTER_UPLOAD_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeUploadMime = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};

const toArea = (value) => {
  const trimmed = String(value || "").trim().replace(/^\/+/, "");
  if (!trimmed) {
    return "root";
  }
  const [root] = trimmed.split(/[\\/]/);
  return String(root || "root").toLowerCase() || "root";
};

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const sanitizeVariantVersion = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const normalizeVariantFormats = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    avif: source.avif && typeof source.avif === "object" ? source.avif : null,
    webp: source.webp && typeof source.webp === "object" ? source.webp : null,
    fallback: source.fallback && typeof source.fallback === "object" ? source.fallback : null,
  };
};

const normalizeVariantRecord = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const formats = normalizeVariantFormats(source.formats);
  return {
    width: toNumberOrNull(source.width),
    height: toNumberOrNull(source.height),
    formats,
  };
};

const sumVariantSizes = (variants) => {
  let bytes = 0;
  let files = 0;
  const source = variants && typeof variants === "object" ? variants : {};
  Object.values(source).forEach((record) => {
    const normalized = normalizeVariantRecord(record);
    Object.values(normalized.formats).forEach((format) => {
      if (!format || typeof format !== "object") {
        return;
      }
      const size = Number(format.size);
      if (!Number.isFinite(size) || size < 0) {
        return;
      }
      bytes += size;
      files += 1;
    });
  });
  return { bytes, files };
};

const computeFocalCoverRect = ({ sourceWidth, sourceHeight, targetWidth, targetHeight, focalPoint }) => {
  const safeSourceWidth = Math.max(1, Math.floor(Number(sourceWidth || 1)));
  const safeSourceHeight = Math.max(1, Math.floor(Number(sourceHeight || 1)));
  const safeTargetWidth = Math.max(1, Math.floor(Number(targetWidth || 1)));
  const safeTargetHeight = Math.max(1, Math.floor(Number(targetHeight || 1)));

  const sourceRatio = safeSourceWidth / safeSourceHeight;
  const targetRatio = safeTargetWidth / safeTargetHeight;
  let cropWidth = safeSourceWidth;
  let cropHeight = safeSourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(safeSourceHeight * targetRatio);
    cropHeight = safeSourceHeight;
  } else if (sourceRatio < targetRatio) {
    cropWidth = safeSourceWidth;
    cropHeight = Math.round(safeSourceWidth / targetRatio);
  }

  cropWidth = clamp(cropWidth, 1, safeSourceWidth);
  cropHeight = clamp(cropHeight, 1, safeSourceHeight);

  const focal = normalizeFocalPoint(focalPoint);
  const centerX = focal.x * safeSourceWidth;
  const centerY = focal.y * safeSourceHeight;
  const maxLeft = safeSourceWidth - cropWidth;
  const maxTop = safeSourceHeight - cropHeight;
  const left = clamp(Math.round(centerX - cropWidth / 2), 0, Math.max(0, maxLeft));
  const top = clamp(Math.round(centerY - cropHeight / 2), 0, Math.max(0, maxTop));

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
  };
};

const toUploadVariantUrl = ({ uploadId, preset, version, extension }) =>
  `/uploads/_variants/${encodeURIComponent(uploadId)}/${preset}-v${version}.${extension}`;

const resetVariantDirectory = (uploadsDir, uploadId) => {
  const dir = path.join(uploadsDir, "_variants", uploadId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const createBaseVariantPipeline = ({ sourcePath, rect, preset }) =>
  sharp(sourcePath, { animated: false }).extract(rect).resize(preset.width, preset.height, {
    fit: "fill",
  });

const toFallbackFormat = (hasAlpha) =>
  hasAlpha
    ? { format: "png", mime: "image/png", extension: "png" }
    : { format: "jpeg", mime: "image/jpeg", extension: "jpeg" };

const createVariantFilePath = ({ dir, preset, version, extension }) =>
  path.join(dir, `${preset}-v${version}.${extension}`);

const normalizeVariants = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  Object.entries(source).forEach(([key, record]) => {
    next[key] = normalizeVariantRecord(record);
  });
  return next;
};

export const isRasterUploadMime = (mime) => RASTER_UPLOAD_MIMES.has(normalizeUploadMime(mime));

export const normalizeFocalPoint = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 1) : 0.5,
    y: Number.isFinite(y) ? clamp(y, 0, 1) : 0.5,
  };
};

const isFocalPointValue = (value) =>
  Boolean(value && typeof value === "object" && ("x" in value || "y" in value));

const resolvePresetFocalSource = ({ value, fallback, presetKey }) => {
  if (isFocalPointValue(value)) {
    return value;
  }
  if (value && typeof value === "object" && value[presetKey] && typeof value[presetKey] === "object") {
    return value[presetKey];
  }
  if (isFocalPointValue(fallback)) {
    return fallback;
  }
  if (
    fallback &&
    typeof fallback === "object" &&
    fallback[presetKey] &&
    typeof fallback[presetKey] === "object"
  ) {
    return fallback[presetKey];
  }
  return null;
};

export const normalizeFocalPoints = (value, fallbackValue) => {
  const next = {};
  UPLOAD_VARIANT_PRESET_KEYS.forEach((presetKey) => {
    next[presetKey] = normalizeFocalPoint(
      resolvePresetFocalSource({ value, fallback: fallbackValue, presetKey }),
    );
  });
  return next;
};

export const getPrimaryFocalPoint = (value, fallbackValue) =>
  normalizeFocalPoint(resolvePresetFocalSource({ value, fallback: fallbackValue, presetKey: "card" }));

export const deriveUploadArea = (folder) => toArea(folder);

export const computeBufferSha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

export const findUploadByHash = (uploads, hashSha256) => {
  const target = String(hashSha256 || "").trim().toLowerCase();
  if (!target) {
    return null;
  }
  return (
    (Array.isArray(uploads) ? uploads : []).find(
      (entry) => String(entry?.hashSha256 || "").trim().toLowerCase() === target,
    ) || null
  );
};

export const resolveUploadAbsolutePath = ({ uploadsDir, uploadUrl }) => {
  const normalizedUrl = String(uploadUrl || "").trim();
  if (!normalizedUrl.startsWith("/uploads/")) {
    return null;
  }
  const relative = normalizedUrl.replace(/^\/uploads\//, "");
  const resolved = path.resolve(path.join(uploadsDir, relative));
  const uploadsRoot = path.resolve(uploadsDir);
  if (!resolved.startsWith(uploadsRoot)) {
    return null;
  }
  return resolved;
};

export const generateUploadVariants = async ({
  uploadsDir,
  uploadId,
  sourcePath,
  sourceMime,
  focalPoint,
  focalPoints,
  variantsVersion = 1,
} = {}) => {
  if (!isRasterUploadMime(sourceMime)) {
    return { variants: {}, sourceWidth: null, sourceHeight: null, variantBytes: 0 };
  }
  if (!uploadsDir || !uploadId || !sourcePath) {
    return { variants: {}, sourceWidth: null, sourceHeight: null, variantBytes: 0 };
  }

  const metadata = await sharp(sourcePath, { animated: false }).metadata();
  const sourceWidth = Number(metadata?.width);
  const sourceHeight = Number(metadata?.height);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
    throw new Error("source_image_dimensions_unavailable");
  }
  const hasAlpha = metadata?.hasAlpha === true || Number(metadata?.channels || 0) >= 4;
  const fallback = toFallbackFormat(hasAlpha);
  const safeVersion = sanitizeVariantVersion(variantsVersion);
  const safeFocalPoints = normalizeFocalPoints(focalPoints, focalPoint);
  const variantDir = resetVariantDirectory(uploadsDir, uploadId);

  const variants = {};
  let variantBytes = 0;

  for (const [presetKey, preset] of Object.entries(UPLOAD_VARIANT_PRESETS)) {
    const rect = computeFocalCoverRect({
      sourceWidth,
      sourceHeight,
      targetWidth: preset.width,
      targetHeight: preset.height,
      focalPoint: safeFocalPoints[presetKey],
    });
    const base = createBaseVariantPipeline({ sourcePath, rect, preset });
    const avifPath = createVariantFilePath({
      dir: variantDir,
      preset: presetKey,
      version: safeVersion,
      extension: "avif",
    });
    const webpPath = createVariantFilePath({
      dir: variantDir,
      preset: presetKey,
      version: safeVersion,
      extension: "webp",
    });
    const fallbackPath = createVariantFilePath({
      dir: variantDir,
      preset: presetKey,
      version: safeVersion,
      extension: fallback.extension,
    });

    const [avifInfo, webpInfo, fallbackInfo] = await Promise.all([
      base.clone().avif({ quality: 52 }).toFile(avifPath),
      base.clone().webp({ quality: 74 }).toFile(webpPath),
      fallback.format === "png"
        ? base.clone().png({ quality: 90, compressionLevel: 9 }).toFile(fallbackPath)
        : base.clone().jpeg({ quality: 84, mozjpeg: true }).toFile(fallbackPath),
    ]);

    variants[presetKey] = {
      width: preset.width,
      height: preset.height,
      formats: {
        avif: {
          url: toUploadVariantUrl({
            uploadId,
            preset: presetKey,
            version: safeVersion,
            extension: "avif",
          }),
          mime: "image/avif",
          size: Number(avifInfo?.size || 0),
        },
        webp: {
          url: toUploadVariantUrl({
            uploadId,
            preset: presetKey,
            version: safeVersion,
            extension: "webp",
          }),
          mime: "image/webp",
          size: Number(webpInfo?.size || 0),
        },
        fallback: {
          url: toUploadVariantUrl({
            uploadId,
            preset: presetKey,
            version: safeVersion,
            extension: fallback.extension,
          }),
          mime: fallback.mime,
          size: Number(fallbackInfo?.size || 0),
        },
      },
    };

    variantBytes += Number(avifInfo?.size || 0);
    variantBytes += Number(webpInfo?.size || 0);
    variantBytes += Number(fallbackInfo?.size || 0);
  }

  return {
    variants,
    sourceWidth,
    sourceHeight,
    variantBytes,
  };
};

export const attachUploadMediaMetadata = async ({
  uploadsDir,
  entry,
  sourcePath,
  sourceMime,
  hashSha256,
  focalPoint,
  focalPoints,
  variantsVersion,
  regenerateVariants = true,
} = {}) => {
  const current = entry && typeof entry === "object" ? { ...entry } : {};
  const normalizedFocalPoints =
    typeof focalPoints !== "undefined"
      ? normalizeFocalPoints(focalPoints, current?.focalPoints ?? current?.focalPoint)
      : typeof focalPoint !== "undefined"
        ? normalizeFocalPoints(focalPoint)
        : normalizeFocalPoints(current?.focalPoints, current?.focalPoint);
  const normalizedFocal = getPrimaryFocalPoint(normalizedFocalPoints);
  const normalizedHash = String(hashSha256 || current.hashSha256 || "").trim().toLowerCase();
  const nextVersion = sanitizeVariantVersion(variantsVersion ?? current.variantsVersion ?? 1);
  let nextVariants = normalizeVariants(current.variants);
  let sourceWidth = toNumberOrNull(current.width);
  let sourceHeight = toNumberOrNull(current.height);
  let variantBytes = sumVariantSizes(nextVariants).bytes;

  if (regenerateVariants && sourcePath && isRasterUploadMime(sourceMime)) {
    const generated = await generateUploadVariants({
      uploadsDir,
      uploadId: String(current.id || ""),
      sourcePath,
      sourceMime,
      focalPoints: normalizedFocalPoints,
      variantsVersion: nextVersion,
    });
    nextVariants = normalizeVariants(generated.variants);
    sourceWidth = toNumberOrNull(generated.sourceWidth) ?? sourceWidth;
    sourceHeight = toNumberOrNull(generated.sourceHeight) ?? sourceHeight;
    variantBytes = Number(generated.variantBytes || 0);
  }

  return {
    ...current,
    hashSha256: normalizedHash || "",
    focalPoints: normalizedFocalPoints,
    focalPoint: normalizedFocal,
    variantsVersion: nextVersion,
    variants: nextVariants,
    variantBytes: Number.isFinite(variantBytes) ? variantBytes : 0,
    area: deriveUploadArea(current.folder || ""),
    width: Number.isFinite(sourceWidth) ? sourceWidth : null,
    height: Number.isFinite(sourceHeight) ? sourceHeight : null,
  };
};

export const buildStorageAreaSummary = (uploads) => {
  const areasMap = new Map();
  const addArea = (areaKey) => {
    if (!areasMap.has(areaKey)) {
      areasMap.set(areaKey, {
        area: areaKey,
        originalBytes: 0,
        variantBytes: 0,
        totalBytes: 0,
        originalFiles: 0,
        variantFiles: 0,
        totalFiles: 0,
      });
    }
    return areasMap.get(areaKey);
  };

  (Array.isArray(uploads) ? uploads : []).forEach((item) => {
    const area = deriveUploadArea(item?.area || item?.folder || "");
    const bucket = addArea(area);
    const originalSize = Number(item?.size);
    if (Number.isFinite(originalSize) && originalSize >= 0) {
      bucket.originalBytes += originalSize;
      bucket.originalFiles += 1;
    }
    const variantSummary = sumVariantSizes(item?.variants);
    if (variantSummary.bytes > 0) {
      bucket.variantBytes += variantSummary.bytes;
      bucket.variantFiles += variantSummary.files;
    }
  });

  const areas = Array.from(areasMap.values())
    .map((item) => ({
      ...item,
      totalBytes: item.originalBytes + item.variantBytes,
      totalFiles: item.originalFiles + item.variantFiles,
    }))
    .sort((left, right) => {
      if (left.totalBytes !== right.totalBytes) {
        return right.totalBytes - left.totalBytes;
      }
      return String(left.area || "").localeCompare(String(right.area || ""), "pt-BR");
    });

  const totals = areas.reduce(
    (acc, item) => ({
      originalBytes: acc.originalBytes + item.originalBytes,
      variantBytes: acc.variantBytes + item.variantBytes,
      totalBytes: acc.totalBytes + item.totalBytes,
      originalFiles: acc.originalFiles + item.originalFiles,
      variantFiles: acc.variantFiles + item.variantFiles,
      totalFiles: acc.totalFiles + item.totalFiles,
    }),
    {
      originalBytes: 0,
      variantBytes: 0,
      totalBytes: 0,
      originalFiles: 0,
      variantFiles: 0,
      totalFiles: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    areas,
  };
};

export const deriveUploadFolderFromUrl = (url) => {
  const normalized = String(url || "").trim();
  if (!normalized.startsWith("/uploads/")) {
    return "";
  }
  const relative = normalized.replace(/^\/uploads\//, "");
  const folder = toPosix(path.dirname(relative)).replace(/^\.$/, "");
  return folder;
};
