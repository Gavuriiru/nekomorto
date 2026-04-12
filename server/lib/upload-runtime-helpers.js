export const MAX_SVG_SIZE_BYTES = 256 * 1024;
export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_IMAGE_DIMENSION = 8192;
export const MAX_UPLOAD_IMAGE_PIXELS = 33_554_432;

export const ALLOWED_UPLOAD_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export const UPLOAD_EXTENSION_TO_MIME = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
});

export const UPLOAD_MIME_TO_EXTENSION = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
});

export const SUPPORTED_UPLOAD_EXTENSIONS = Object.freeze(
  Array.from(
    new Set([...Object.keys(UPLOAD_EXTENSION_TO_MIME), ...Object.values(UPLOAD_MIME_TO_EXTENSION)]),
  ),
);

export const DEFAULT_AVATAR_DISPLAY = Object.freeze({
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
});

export const sanitizeUploadFolder = (value, { trimTrailingSlash = false } = {}) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const normalized = value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "");
  if (!trimTrailingSlash) {
    return normalized;
  }
  return normalized.replace(/\/+$/, "");
};

export const sanitizeUploadBaseName = (value) =>
  String(value || "upload")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sanitizeUploadSlot = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeAvatarDisplay = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  const zoom = Number(source.zoom);
  const rotation = Number(source.rotation);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_AVATAR_DISPLAY.x,
    y: Number.isFinite(y) ? y : DEFAULT_AVATAR_DISPLAY.y,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_AVATAR_DISPLAY.zoom,
    rotation: Number.isFinite(rotation) ? rotation : DEFAULT_AVATAR_DISPLAY.rotation,
  };
};

export const normalizeUploadMime = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};

export const isSupportedUploadImageMime = (value) =>
  ALLOWED_UPLOAD_IMAGE_MIMES.has(normalizeUploadMime(value));

export const getUploadExtFromMime = (value) =>
  UPLOAD_MIME_TO_EXTENSION[normalizeUploadMime(value)] || "png";

export const getUploadMimeFromExtension = (value) =>
  UPLOAD_EXTENSION_TO_MIME[String(value || "").toLowerCase()] || "";

const readUInt24LE = (buffer, offset) =>
  buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);

export const detectUploadImageMimeFromBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return "";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  const snippet = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096)).replace(/^\uFEFF/, "");
  if (/<svg[\s>]/i.test(snippet)) {
    return "image/svg+xml";
  }
  return "";
};

const getPngDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return null;
  }
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const getGifDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
    return null;
  }
  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
};

const getJpegDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 >= buffer.length) {
        break;
      }
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
};

const getWebpDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) {
      break;
    }
    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7),
      };
    }
    if (chunkType === "VP8L" && chunkSize >= 5) {
      if (buffer[dataOffset] !== 0x2f) {
        return null;
      }
      const b0 = buffer[dataOffset + 1];
      const b1 = buffer[dataOffset + 2];
      const b2 = buffer[dataOffset + 3];
      const b3 = buffer[dataOffset + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (chunkType === "VP8 " && chunkSize >= 10) {
      if (
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) {
        return null;
      }
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};

export const getUploadImageDimensions = (buffer, mime) => {
  const normalizedMime = normalizeUploadMime(mime);
  if (normalizedMime === "image/png") {
    return getPngDimensions(buffer);
  }
  if (normalizedMime === "image/jpeg") {
    return getJpegDimensions(buffer);
  }
  if (normalizedMime === "image/gif") {
    return getGifDimensions(buffer);
  }
  if (normalizedMime === "image/webp") {
    return getWebpDimensions(buffer);
  }
  return null;
};

export const validateUploadRasterDimensions = (
  { width, height } = {},
  { maxDimension = MAX_UPLOAD_IMAGE_DIMENSION, maxPixels = MAX_UPLOAD_IMAGE_PIXELS } = {},
) => {
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
  if (safeWidth > maxDimension || safeHeight > maxDimension) {
    return { valid: false, error: "image_dimensions_too_large" };
  }
  if (safeWidth * safeHeight > maxPixels) {
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

export const validateUploadImageBuffer = (buffer, requestedMime, options = {}) => {
  const strictRequestedMime = options.strictRequestedMime === true;
  const requireBuffer = options.requireBuffer === true;
  const maxSizeBytes = Number(options.maxSizeBytes);
  const maxSvgSizeBytes = Number(options.maxSvgSizeBytes);

  if (requireBuffer && (!Buffer.isBuffer(buffer) || buffer.length === 0)) {
    return { valid: false, error: "empty_upload" };
  }
  if (Buffer.isBuffer(buffer) && Number.isFinite(maxSizeBytes) && maxSizeBytes > 0) {
    if (buffer.length > maxSizeBytes) {
      return { valid: false, error: "file_too_large" };
    }
  }

  const normalizedRequested = normalizeUploadMime(requestedMime);
  const detectedMime = detectUploadImageMimeFromBuffer(buffer);
  if (
    strictRequestedMime &&
    detectedMime &&
    normalizedRequested &&
    detectedMime !== normalizedRequested
  ) {
    return { valid: false, error: "mime_mismatch" };
  }
  const mime = detectedMime || normalizedRequested;
  if (!isSupportedUploadImageMime(mime)) {
    return { valid: false, error: "unsupported_image_type" };
  }
  if (mime === "image/svg+xml") {
    if (Buffer.isBuffer(buffer) && Number.isFinite(maxSvgSizeBytes) && maxSvgSizeBytes > 0) {
      if (buffer.length > maxSvgSizeBytes) {
        return { valid: false, error: "svg_too_large" };
      }
    }
    return { valid: true, mime, dimensions: null };
  }
  const dimensions = getUploadImageDimensions(buffer, mime);
  if (!dimensions) {
    return { valid: false, error: "invalid_image_data" };
  }
  const validatedDimensions = validateUploadRasterDimensions(dimensions);
  if (!validatedDimensions.valid) {
    return validatedDimensions;
  }
  return {
    valid: true,
    mime,
    dimensions: validatedDimensions.dimensions,
  };
};

export const sanitizeSvg = (value) => {
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
