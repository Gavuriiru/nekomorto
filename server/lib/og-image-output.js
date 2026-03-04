import sharp from "sharp";

export const OG_MAX_RECOMMENDED_BYTES = 600 * 1024;

const isFinitePositiveInteger = (value) =>
  Number.isFinite(Number(value)) && Math.floor(Number(value)) > 0;

const toValidMaxBytes = (value) =>
  isFinitePositiveInteger(value) ? Math.floor(Number(value)) : OG_MAX_RECOMMENDED_BYTES;

const optimizePngWithPreset = async (buffer, options) =>
  sharp(buffer)
    .png(options)
    .toBuffer();

export const optimizeOgPngBuffer = async ({
  buffer,
  maxBytes = OG_MAX_RECOMMENDED_BYTES,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Buffer.isBuffer(buffer) ? buffer : Buffer.alloc(0);
  }

  const maxSizeBytes = toValidMaxBytes(maxBytes);
  if (buffer.length <= maxSizeBytes) {
    return buffer;
  }

  const attempts = [
    { palette: true, compressionLevel: 9, quality: 92 },
    { palette: true, compressionLevel: 9, quality: 82 },
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
