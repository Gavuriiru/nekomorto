import fs from "fs";
import dns from "dns/promises";
import net from "net";
import path from "path";

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
const UPLOAD_EXTENSION_TO_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const UPLOAD_MIME_TO_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const SUPPORTED_UPLOAD_EXTENSIONS = Array.from(
  new Set([
    ...Object.keys(UPLOAD_EXTENSION_TO_MIME),
    ...Object.values(UPLOAD_MIME_TO_EXTENSION),
  ]),
);
const DEFAULT_UPLOAD_FILE_BASE = "imagem";
const MAX_REDIRECTS = 5;
const PRIVATE_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

const isPrivateIpv4 = (value) => {
  const normalized = String(value || "").trim();
  if (!net.isIP(normalized) || net.isIP(normalized) !== 4) {
    return false;
  }
  const octets = normalized.split(".").map((chunk) => Number(chunk));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv6 = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/%.+$/, "");
  if (!net.isIP(normalized) || net.isIP(normalized) !== 6) {
    return false;
  }
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  return false;
};

const isPrivateHost = (host) => {
  const normalized = String(host || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (PRIVATE_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost")) {
    return true;
  }
  if (net.isIP(normalized)) {
    return isPrivateIpv4(normalized) || isPrivateIpv6(normalized);
  }
  return false;
};

const resolveHostAddresses = async (host) => {
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    return Array.isArray(records)
      ? records.map((record) => String(record?.address || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const validateRemoteTarget = async (target) => {
  if (!target || !(target instanceof URL)) {
    return toFailureResult("invalid_url", "Invalid URL.");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return toFailureResult("invalid_url", "Only HTTP/HTTPS URLs are allowed.");
  }
  if (target.username || target.password) {
    return toFailureResult("invalid_url_credentials", "URL credentials are not allowed.");
  }
  const host = String(target.hostname || "").trim().toLowerCase();
  if (isPrivateHost(host)) {
    return toFailureResult("host_not_allowed", "Remote host is not allowed.");
  }
  const resolvedAddresses = await resolveHostAddresses(host);
  if (resolvedAddresses.some((address) => isPrivateHost(address))) {
    return toFailureResult("host_not_allowed", "Remote host is not allowed.");
  }
  return { ok: true };
};

const sanitizeUploadFolder = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "");
};

const sanitizeUploadBaseName = (value) =>
  String(value || "upload")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeUploadMime = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};

const isSupportedUploadImageMime = (value) =>
  ALLOWED_UPLOAD_IMAGE_MIMES.has(normalizeUploadMime(value));

const getUploadExtFromMime = (value) =>
  UPLOAD_MIME_TO_EXTENSION[normalizeUploadMime(value)] || "png";

const getUploadMimeFromExtension = (value) =>
  UPLOAD_EXTENSION_TO_MIME[String(value || "").toLowerCase()] || "";

const readUInt24LE = (buffer, offset) =>
  buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);

const detectUploadImageMimeFromBuffer = (buffer) => {
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
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
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

const getUploadImageDimensions = (buffer, mime) => {
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

const validateUploadImageBuffer = (buffer, requestedMime) => {
  const normalizedRequested = normalizeUploadMime(requestedMime);
  const detectedMime = detectUploadImageMimeFromBuffer(buffer);
  const mime = detectedMime || normalizedRequested;
  if (!isSupportedUploadImageMime(mime)) {
    return { valid: false, error: "unsupported_image_type" };
  }
  if (mime === "image/svg+xml") {
    return { valid: true, mime, dimensions: null };
  }
  const dimensions = getUploadImageDimensions(buffer, mime);
  if (!dimensions) {
    return { valid: false, error: "invalid_image_data" };
  }
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, error: "invalid_image_dimensions" };
  }
  if (width > MAX_UPLOAD_IMAGE_DIMENSION || height > MAX_UPLOAD_IMAGE_DIMENSION) {
    return { valid: false, error: "image_dimensions_too_large" };
  }
  if (width * height > MAX_UPLOAD_IMAGE_PIXELS) {
    return { valid: false, error: "image_pixel_count_too_large" };
  }
  return {
    valid: true,
    mime,
    dimensions: {
      width,
      height,
    },
  };
};

const sanitizeSvg = (value) => {
  if (!value) return "";
  let output = value;
  output = output.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  output = output.replace(/<\s*foreignObject[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "");
  output = output.replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  output = output.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
  output = output.replace(/javascript:/gi, "");
  output = output.replace(/data:(?!image\/(png|jpe?g|gif|webp);base64)/gi, "");
  output = output.replace(/(href|xlink:href|src)\s*=\s*(["'])(.*?)\2/gi, (_m, attr, quote, url) => {
    const safe = String(url || "");
    if (safe.startsWith("#") || safe.startsWith("/")) {
      return `${attr}=${quote}${safe}${quote}`;
    }
    return "";
  });
  return output;
};

const createImportError = (code, message, extra = {}) => ({
  code: String(code || "import_failed"),
  message: String(message || "Remote image import failed."),
  ...extra,
});

const toFailureResult = (code, message, extra = {}) => ({
  ok: false,
  error: createImportError(code, message, extra),
});

const toSuccessResult = (entry) => ({
  ok: true,
  entry,
});

const fetchWithSafeRedirects = async ({ fetchImpl, initialUrl, timeoutMs }) => {
  let current = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let parsedCurrent;
    try {
      parsedCurrent = new URL(current);
    } catch {
      return toFailureResult("redirect_not_allowed", "Invalid redirect target.");
    }

    const targetValidation = await validateRemoteTarget(parsedCurrent);
    if (!targetValidation.ok) {
      return targetValidation;
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 20_000));
    let response;
    try {
      response = await fetchImpl(parsedCurrent.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return toFailureResult("fetch_failed", "Request timed out.", { reason: "timeout" });
      }
      return toFailureResult("fetch_failed", "Failed to fetch remote image.");
    } finally {
      clearTimeout(timeoutHandle);
    }

    const status = Number(response?.status || 0);
    if (status >= 300 && status < 400) {
      const location = String(response.headers?.get?.("location") || "").trim();
      if (!location) {
        return toFailureResult("redirect_not_allowed", "Redirect location is invalid.");
      }
      if (redirectCount >= MAX_REDIRECTS) {
        return toFailureResult("redirect_not_allowed", "Too many redirects.");
      }
      try {
        current = new URL(location, parsedCurrent).toString();
      } catch {
        return toFailureResult("redirect_not_allowed", "Redirect location is invalid.");
      }
      continue;
    }

    return { ok: true, response };
  }

  return toFailureResult("redirect_not_allowed", "Too many redirects.");
};

const resolveUrlBaseName = (parsedRemote) => {
  const rawBaseName = path.basename(parsedRemote.pathname || "") || "upload";
  try {
    return decodeURIComponent(rawBaseName);
  } catch {
    return rawBaseName;
  }
};

const resolveOnExistingPolicy = (deterministic, onExisting) => {
  if (!deterministic) {
    return "overwrite";
  }
  const normalized = String(onExisting || "reuse").trim().toLowerCase();
  return normalized === "overwrite" ? "overwrite" : "reuse";
};

const buildUploadUrl = (folder, fileName) => `/uploads/${folder ? `${folder}/` : ""}${fileName}`;

const collectDeterministicCandidateNames = (safeBase) =>
  SUPPORTED_UPLOAD_EXTENSIONS.map((ext) => `${safeBase}.${ext}`);

const buildEntryFromDiskFile = ({ filePath, fileName, folder, createdAt }) => {
  const stat = fs.statSync(filePath);
  const size = Number(stat.size || 0);
  if (!size) {
    return toFailureResult("empty_upload", "Remote image is empty.");
  }
  if (size > MAX_UPLOAD_SIZE_BYTES) {
    return toFailureResult("file_too_large", "Remote image is too large.");
  }

  const buffer = fs.readFileSync(filePath);
  const extFromFile = path.extname(fileName).replace(".", "").toLowerCase();
  const fallbackMime = getUploadMimeFromExtension(extFromFile);
  const validation = validateUploadImageBuffer(buffer, fallbackMime);
  if (!validation.valid) {
    return toFailureResult(validation.error, `Remote image validation failed: ${validation.error}.`);
  }
  const mime = validation.mime;
  if (mime === "image/svg+xml" && buffer.length > MAX_SVG_SIZE_BYTES) {
    return toFailureResult("svg_too_large", "SVG image is too large.");
  }

  return toSuccessResult({
    url: buildUploadUrl(folder, fileName),
    fileName,
    folder: folder || "",
    size,
    mime,
    width: validation.dimensions?.width || null,
    height: validation.dimensions?.height || null,
    createdAt: String(createdAt || stat.mtime.toISOString()),
  });
};

const maybeReuseExistingDeterministicFile = ({ targetDir, safeBase, folder, onExistingPolicy }) => {
  if (onExistingPolicy !== "reuse") {
    return null;
  }
  const candidates = collectDeterministicCandidateNames(safeBase);
  for (const candidate of candidates) {
    const candidatePath = path.join(targetDir, candidate);
    if (!fs.existsSync(candidatePath)) {
      continue;
    }
    const existingResult = buildEntryFromDiskFile({
      filePath: candidatePath,
      fileName: candidate,
      folder,
    });
    if (existingResult.ok) {
      return existingResult;
    }
  }
  return null;
};

const removeAlternativeDeterministicFiles = ({ targetDir, safeBase, keepFileName }) => {
  const candidates = collectDeterministicCandidateNames(safeBase);
  candidates.forEach((candidate) => {
    if (candidate === keepFileName) {
      return;
    }
    const candidatePath = path.join(targetDir, candidate);
    if (!fs.existsSync(candidatePath)) {
      return;
    }
    try {
      fs.unlinkSync(candidatePath);
    } catch {
      // keep stale alternatives when deletion fails
    }
  });
};

export const importRemoteImageFile = async ({
  remoteUrl,
  folder = "",
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  timeoutMs = 20_000,
  fileBaseOverride = "",
  deterministic = false,
  onExisting = "reuse",
  fetchImpl = globalThis.fetch,
  throwOnError = false,
} = {}) => {
  try {
    const rawUrl = String(remoteUrl || "").trim();
    if (!rawUrl) {
      return toFailureResult("url_required", "URL is required.");
    }

    let parsedRemote;
    try {
      parsedRemote = new URL(rawUrl);
    } catch {
      return toFailureResult("invalid_url", "Invalid URL.");
    }
    const targetValidation = await validateRemoteTarget(parsedRemote);
    if (!targetValidation.ok) {
      return targetValidation;
    }

    if (typeof fetchImpl !== "function") {
      return toFailureResult("fetch_unavailable", "Fetch implementation is not available.");
    }

    const uploadsRoot = path.resolve(String(uploadsDir || ""));
    const safeFolder = sanitizeUploadFolder(folder);
    const targetDir = safeFolder ? path.join(uploadsRoot, safeFolder) : uploadsRoot;
    const resolvedTarget = path.resolve(targetDir);
    if (!resolvedTarget.startsWith(uploadsRoot)) {
      return toFailureResult("invalid_folder", "Invalid target folder.");
    }
    fs.mkdirSync(resolvedTarget, { recursive: true });

    const deterministicMode = Boolean(deterministic);
    const onExistingPolicy = resolveOnExistingPolicy(deterministicMode, onExisting);
    const parsedName = resolveUrlBaseName(parsedRemote);
    const preferredBase = deterministicMode ? String(fileBaseOverride || parsedName || "upload") : parsedName;
    const safeBase = sanitizeUploadBaseName(preferredBase) || DEFAULT_UPLOAD_FILE_BASE;

    if (deterministicMode) {
      const reusedResult = maybeReuseExistingDeterministicFile({
        targetDir: resolvedTarget,
        safeBase,
        folder: safeFolder,
        onExistingPolicy,
      });
      if (reusedResult) {
        return reusedResult;
      }
    }

    const fetchResult = await fetchWithSafeRedirects({
      fetchImpl,
      initialUrl: parsedRemote.toString(),
      timeoutMs,
    });
    if (!fetchResult.ok) {
      return fetchResult;
    }
    const response = fetchResult.response;

    if (!response?.ok) {
      return toFailureResult("fetch_failed", "Remote server responded with error.", {
        status: Number(response?.status || 0),
      });
    }

    let finalRemote = parsedRemote;
    try {
      if (response.url) {
        finalRemote = new URL(response.url);
      }
    } catch {
      finalRemote = parsedRemote;
    }

    const contentTypeHeader = String(response.headers?.get?.("content-type") || "");
    const headerMime = normalizeUploadMime(contentTypeHeader.split(";")[0].trim().toLowerCase());
    const extFromUrl = path.extname(finalRemote.pathname || "").replace(".", "").toLowerCase();
    let mime = isSupportedUploadImageMime(headerMime) ? headerMime : getUploadMimeFromExtension(extFromUrl);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return toFailureResult("empty_upload", "Remote image is empty.");
    }
    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      return toFailureResult("file_too_large", "Remote image is too large.");
    }

    const validation = validateUploadImageBuffer(buffer, mime);
    if (!validation.valid) {
      return toFailureResult(validation.error, `Remote image validation failed: ${validation.error}.`);
    }
    mime = validation.mime;
    if (mime === "image/svg+xml" && buffer.length > MAX_SVG_SIZE_BYTES) {
      return toFailureResult("svg_too_large", "SVG image is too large.");
    }

    const ext = getUploadExtFromMime(mime);
    const fileName = deterministicMode ? `${safeBase}.${ext}` : `${safeBase}-${Date.now()}.${ext}`;
    const filePath = path.join(resolvedTarget, fileName);

    if (deterministicMode && onExistingPolicy === "reuse" && fs.existsSync(filePath)) {
      return buildEntryFromDiskFile({
        filePath,
        fileName,
        folder: safeFolder,
      });
    }

    if (mime === "image/svg+xml") {
      const sanitized = sanitizeSvg(buffer.toString("utf-8"));
      fs.writeFileSync(filePath, sanitized);
    } else {
      fs.writeFileSync(filePath, buffer);
    }

    if (deterministicMode) {
      removeAlternativeDeterministicFiles({
        targetDir: resolvedTarget,
        safeBase,
        keepFileName: fileName,
      });
    }

    const createdAt = new Date().toISOString();
    return buildEntryFromDiskFile({
      filePath,
      fileName,
      folder: safeFolder,
      createdAt,
    });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    return toFailureResult("import_failed", "Unexpected error while importing remote image.");
  }
};
