import type { UploadVariantPresetKey } from "@/lib/upload-variants";

export type UploadFocalPoint = {
  x: number;
  y: number;
};

export type UploadFocalPoints = Record<UploadVariantPresetKey, UploadFocalPoint>;

export const UPLOAD_VARIANT_PRESET_DIMENSIONS: Record<
  UploadVariantPresetKey,
  { width: number; height: number }
> = Object.freeze({
  thumb: Object.freeze({ width: 320, height: 320 }),
  card: Object.freeze({ width: 640, height: 360 }),
  hero: Object.freeze({ width: 1600, height: 900 }),
  og: Object.freeze({ width: 1200, height: 630 }),
});

export const UPLOAD_VARIANT_PRESET_KEYS = Object.freeze(
  Object.keys(UPLOAD_VARIANT_PRESET_DIMENSIONS) as UploadVariantPresetKey[],
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isUploadFocalPointValue = (value: unknown): value is Partial<UploadFocalPoint> =>
  Boolean(value && typeof value === "object" && ("x" in value || "y" in value));

const resolvePresetFocalSource = ({
  value,
  fallback,
  preset,
}: {
  value: unknown;
  fallback?: unknown;
  preset: UploadVariantPresetKey;
}) => {
  if (isUploadFocalPointValue(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Partial<Record<UploadVariantPresetKey, unknown>>;
    if (record[preset] && typeof record[preset] === "object") {
      return record[preset];
    }
  }
  if (isUploadFocalPointValue(fallback)) {
    return fallback;
  }
  if (fallback && typeof fallback === "object") {
    const record = fallback as Partial<Record<UploadVariantPresetKey, unknown>>;
    if (record[preset] && typeof record[preset] === "object") {
      return record[preset];
    }
  }
  return null;
};

export const normalizeUploadFocalPoint = (value: unknown): UploadFocalPoint => {
  const source = value && typeof value === "object" ? (value as Partial<UploadFocalPoint>) : {};
  const x = Number(source.x);
  const y = Number(source.y);
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 1) : 0.5,
    y: Number.isFinite(y) ? clamp(y, 0, 1) : 0.5,
  };
};

export const normalizeUploadFocalPoints = (
  value?: unknown,
  fallbackValue?: unknown,
): UploadFocalPoints => {
  const next = {} as UploadFocalPoints;
  UPLOAD_VARIANT_PRESET_KEYS.forEach((preset) => {
    next[preset] = normalizeUploadFocalPoint(
      resolvePresetFocalSource({ value, fallback: fallbackValue, preset }),
    );
  });
  return next;
};

export const deriveLegacyUploadFocalPoint = (
  value?: unknown,
  fallbackValue?: unknown,
): UploadFocalPoint =>
  normalizeUploadFocalPoint(resolvePresetFocalSource({ value, fallback: fallbackValue, preset: "card" }));

export const computeUploadFocalCoverRect = ({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focalPoint,
}: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  focalPoint: UploadFocalPoint;
}) => {
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

  const focal = normalizeUploadFocalPoint(focalPoint);
  const centerX = focal.x * safeSourceWidth;
  const centerY = focal.y * safeSourceHeight;
  const maxLeft = safeSourceWidth - cropWidth;
  const maxTop = safeSourceHeight - cropHeight;

  return {
    left: clamp(Math.round(centerX - cropWidth / 2), 0, Math.max(0, maxLeft)),
    top: clamp(Math.round(centerY - cropHeight / 2), 0, Math.max(0, maxTop)),
    width: cropWidth,
    height: cropHeight,
  };
};
