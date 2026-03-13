import sharp from "sharp";

export const OG_MAX_RECOMMENDED_BYTES = 600 * 1024;
export const OG_PUBLIC_TARGET_KB_MIN = 150;
export const OG_PUBLIC_TARGET_KB_MAX = 1024;
export const OG_PUBLIC_DEFAULT_TARGET_KB = 350;
export const OG_PUBLIC_JPEG_MIN_QUALITY = 60;
export const OG_PUBLIC_JPEG_MAX_QUALITY = 100;
export const OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER = Object.freeze([84, 80, 76, 72]);
export const OG_PUBLIC_JPEG_MAX_BYTES = OG_PUBLIC_DEFAULT_TARGET_KB * 1024;
export const OG_PUBLIC_JPEG_QUALITY_LADDER = OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER;

const OG_PUBLIC_JPEG_FLATTEN_BACKGROUND = {
  r: 2,
  g: 5,
  b: 11,
};
const ogPublicImageEncodingWarningCache = new Set();

const isFinitePositiveInteger = (value) =>
  Number.isFinite(Number(value)) && Math.floor(Number(value)) > 0;

const toValidMaxBytes = (value) =>
  isFinitePositiveInteger(value) ? Math.floor(Number(value)) : OG_MAX_RECOMMENDED_BYTES;

const toValidOptimizeMode = (value) => (String(value || "").trim() === "lossless" ? "lossless" : "adaptive");
const toAlwaysAttempt = (value) => value === true;
const normalizeText = (value) => String(value || "").trim();
const toValidPublicTargetFormat = (value) =>
  normalizeText(value).toLowerCase() === "jpeg" ? "jpeg" : "jpeg";
const toValidPublicProfile = (value) =>
  normalizeText(value).toLowerCase() === "visually-lossless" ? "visually-lossless" : "visually-lossless";
const toValidPublicTargetKb = (value) => {
  if (!isFinitePositiveInteger(value)) {
    return OG_PUBLIC_DEFAULT_TARGET_KB;
  }
  const normalizedValue = Math.floor(Number(value));
  if (normalizedValue < OG_PUBLIC_TARGET_KB_MIN || normalizedValue > OG_PUBLIC_TARGET_KB_MAX) {
    return OG_PUBLIC_DEFAULT_TARGET_KB;
  }
  return normalizedValue;
};
const normalizePublicJpegQualityLadder = (value) => {
  const candidates = Array.isArray(value) ? value : normalizeText(value).split(",");
  const seen = new Set();
  const normalized = [];

  for (const candidate of candidates) {
    const trimmed = normalizeText(candidate);
    if (!trimmed || !Number.isFinite(Number(trimmed))) {
      continue;
    }
    const quality = Math.floor(Number(trimmed));
    if (quality < OG_PUBLIC_JPEG_MIN_QUALITY || quality > OG_PUBLIC_JPEG_MAX_QUALITY) {
      continue;
    }
    if (seen.has(quality)) {
      continue;
    }
    seen.add(quality);
    normalized.push(quality);
  }

  if (normalized.length === 0) {
    return [...OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER];
  }

  return normalized.sort((left, right) => right - left);
};
const toValidContentType = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "image/jpeg";
  }
  if (normalized === "image/png") {
    return "image/png";
  }
  return "image/png";
};

const optimizePngWithPreset = async (buffer, options) =>
  sharp(buffer)
    .png(options)
    .toBuffer();

const optimizeJpegWithPreset = async (buffer, options) =>
  sharp(buffer)
    .flatten({ background: OG_PUBLIC_JPEG_FLATTEN_BACKGROUND })
    .jpeg(options)
    .toBuffer();

const warnOgPublicImageEncodingConfig = ({
  targetKbRaw,
  targetKbEffective,
  qualityValuesRaw,
  qualityLadderEffective,
  discardedQualityValues,
  usedDefaultTargetKb,
  usedDefaultQualityLadder,
  logger = console.warn,
} = {}) => {
  if (
    !usedDefaultTargetKb &&
    !usedDefaultQualityLadder &&
    (!Array.isArray(discardedQualityValues) || discardedQualityValues.length === 0)
  ) {
    return;
  }

  const warningSignature = JSON.stringify({
    targetKbRaw: normalizeText(targetKbRaw),
    targetKbEffective,
    qualityValuesRaw: normalizeText(qualityValuesRaw),
    qualityLadderEffective: Array.isArray(qualityLadderEffective) ? qualityLadderEffective : [],
    discardedQualityValues: Array.isArray(discardedQualityValues) ? discardedQualityValues : [],
    usedDefaultTargetKb: Boolean(usedDefaultTargetKb),
    usedDefaultQualityLadder: Boolean(usedDefaultQualityLadder),
  });
  if (ogPublicImageEncodingWarningCache.has(warningSignature)) {
    return;
  }
  ogPublicImageEncodingWarningCache.add(warningSignature);

  logger("og_public_image_encoding_config_invalid", {
    targetKbRaw: normalizeText(targetKbRaw) || null,
    targetKbEffective: Number(targetKbEffective) || OG_PUBLIC_DEFAULT_TARGET_KB,
    qualityValuesRaw: normalizeText(qualityValuesRaw) || null,
    qualityLadderEffective: Array.isArray(qualityLadderEffective)
      ? [...qualityLadderEffective]
      : [...OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER],
    discardedQualityValues: Array.isArray(discardedQualityValues) ? [...discardedQualityValues] : [],
    usedDefaultTargetKb: Boolean(usedDefaultTargetKb),
    usedDefaultQualityLadder: Boolean(usedDefaultQualityLadder),
  });
};

export const resolveOgPublicImageEncodingConfig = ({ env = process.env } = {}) => {
  const targetKbRaw = env?.OG_PUBLIC_TARGET_KB;
  const qualityValuesRaw = env?.OG_PUBLIC_JPEG_QUALITIES;
  const hasTargetKbInput = normalizeText(targetKbRaw) !== "";
  const hasQualityInput = Array.isArray(qualityValuesRaw)
    ? qualityValuesRaw.some((candidate) => normalizeText(candidate) !== "")
    : normalizeText(qualityValuesRaw) !== "";
  const targetKb = toValidPublicTargetKb(targetKbRaw);
  const qualityCandidates = Array.isArray(qualityValuesRaw)
    ? qualityValuesRaw
    : normalizeText(qualityValuesRaw).split(",");
  const qualityLadder = normalizePublicJpegQualityLadder(qualityValuesRaw);
  const discardedQualityValues = qualityCandidates
    .map((candidate) => normalizeText(candidate))
    .filter((candidate) => {
      if (!candidate) {
        return false;
      }
      if (!Number.isFinite(Number(candidate))) {
        return true;
      }
      const quality = Math.floor(Number(candidate));
      return quality < OG_PUBLIC_JPEG_MIN_QUALITY || quality > OG_PUBLIC_JPEG_MAX_QUALITY;
    });
  const usedDefaultTargetKb = hasTargetKbInput && String(targetKb) !== String(normalizeText(targetKbRaw));
  const usedDefaultQualityLadder =
    hasQualityInput &&
    qualityLadder.length === OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER.length &&
    qualityLadder.every((quality, index) => quality === OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER[index]) &&
    normalizeText(qualityValuesRaw) !== normalizeText(OG_PUBLIC_DEFAULT_JPEG_QUALITY_LADDER.join(","));

  warnOgPublicImageEncodingConfig({
    targetKbRaw,
    targetKbEffective: targetKb,
    qualityValuesRaw,
    qualityLadderEffective: qualityLadder,
    discardedQualityValues,
    usedDefaultTargetKb,
    usedDefaultQualityLadder,
  });

  return {
    targetKb,
    maxBytes: targetKb * 1024,
    qualityLadder,
  };
};

export const optimizeOgPngBuffer = async ({
  buffer,
  maxBytes = OG_MAX_RECOMMENDED_BYTES,
  mode = "adaptive",
  alwaysAttempt = false,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Buffer.isBuffer(buffer) ? buffer : Buffer.alloc(0);
  }

  const maxSizeBytes = toValidMaxBytes(maxBytes);
  const optimizeMode = toValidOptimizeMode(mode);
  const shouldAlwaysAttempt = toAlwaysAttempt(alwaysAttempt);
  if (!shouldAlwaysAttempt && buffer.length <= maxSizeBytes) {
    return buffer;
  }

  if (optimizeMode === "lossless") {
    try {
      const optimized = await optimizePngWithPreset(buffer, {
        palette: false,
        compressionLevel: 9,
        adaptiveFiltering: true,
      });
      if (Buffer.isBuffer(optimized) && optimized.length > 0 && optimized.length < buffer.length) {
        return optimized;
      }
      return buffer;
    } catch {
      return buffer;
    }
  }

  const attempts = [
    { palette: true, compressionLevel: 1, quality: 100 },
    { palette: true, compressionLevel: 9, quality: 100, effort: 10 },
  ];

  let best = buffer;
  for (const attempt of attempts) {
    try {
      const optimized = await optimizePngWithPreset(buffer, attempt);
      if (Buffer.isBuffer(optimized) && optimized.length > 0 && optimized.length < best.length) {
        best = optimized;
      }
      if (best.length <= maxSizeBytes) {
        return best;
      }
    } catch {
      return buffer;
    }
  }

  return best;
};

export const optimizeOgPublicImageBuffer = async ({
  buffer,
  sourceContentType = "image/png",
  targetFormat = "jpeg",
  profile = "visually-lossless",
  maxBytes,
  qualityLadder,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.alloc(0),
      contentType: toValidContentType(sourceContentType),
      format: toValidContentType(sourceContentType) === "image/jpeg" ? "jpeg" : "png",
      quality: null,
    };
  }

  const normalizedSourceContentType = toValidContentType(sourceContentType);
  const safeTargetFormat = toValidPublicTargetFormat(targetFormat);
  const safeProfile = toValidPublicProfile(profile);
  const encodingConfig = resolveOgPublicImageEncodingConfig();
  const maxSizeBytes = isFinitePositiveInteger(maxBytes)
    ? Math.floor(Number(maxBytes))
    : encodingConfig.maxBytes;
  const safeQualityLadder = normalizePublicJpegQualityLadder(
    qualityLadder ?? encodingConfig.qualityLadder,
  );

  if (safeTargetFormat !== "jpeg" || safeProfile !== "visually-lossless") {
    return {
      buffer,
      contentType: normalizedSourceContentType,
      format: normalizedSourceContentType === "image/jpeg" ? "jpeg" : "png",
      quality: null,
    };
  }

  let best = null;
  for (const quality of safeQualityLadder) {
    try {
      const encodedBuffer = await optimizeJpegWithPreset(buffer, {
        quality,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: "4:4:4",
      });
      if (!Buffer.isBuffer(encodedBuffer) || encodedBuffer.length === 0) {
        continue;
      }
      if (!best || encodedBuffer.length < best.buffer.length) {
        best = {
          buffer: encodedBuffer,
          contentType: "image/jpeg",
          format: "jpeg",
          quality,
        };
      }
      if (encodedBuffer.length <= maxSizeBytes) {
        best = {
          buffer: encodedBuffer,
          contentType: "image/jpeg",
          format: "jpeg",
          quality,
        };
        break;
      }
    } catch {
      return {
        buffer,
        contentType: normalizedSourceContentType,
        format: normalizedSourceContentType === "image/jpeg" ? "jpeg" : "png",
        quality: null,
      };
    }
  }

  if (!best || best.buffer.length >= buffer.length) {
    return {
      buffer,
      contentType: normalizedSourceContentType,
      format: normalizedSourceContentType === "image/jpeg" ? "jpeg" : "png",
      quality: null,
    };
  }

  return best;
};
