import type { UploadVariantPresetKey } from "@/lib/upload-variants";

export type UploadFocalPoint = {
  x: number;
  y: number;
};

export type UploadFocalPresetKey = "card" | "hero";

export type UploadFocalPoints = Record<UploadFocalPresetKey, UploadFocalPoint>;

export type UploadFocalCropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type UploadFocalCrops = Record<UploadFocalPresetKey, UploadFocalCropRect>;

export type UploadContainFitRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

export const UPLOAD_VARIANT_PRESET_DIMENSIONS: Record<
  UploadVariantPresetKey,
  { width: number; height: number }
> = Object.freeze({
  card: Object.freeze({ width: 1280, height: 853 }),
  cardWide: Object.freeze({ width: 1280, height: 720 }),
  hero: Object.freeze({ width: 1600, height: 900 }),
  og: Object.freeze({ width: 1200, height: 675 }),
});

export const UPLOAD_VARIANT_PRESET_KEYS = Object.freeze(
  Object.keys(UPLOAD_VARIANT_PRESET_DIMENSIONS) as UploadVariantPresetKey[],
);

export const UPLOAD_FOCAL_PRESET_KEYS = Object.freeze(["card", "hero"] as UploadFocalPresetKey[]);

type UploadLegacyFocalPresetKey = UploadFocalPresetKey | "og" | "thumb";

const UPLOAD_FOCAL_PRESET_FALLBACK_ORDER: Record<
  UploadFocalPresetKey,
  readonly UploadLegacyFocalPresetKey[]
> = Object.freeze({
  card: Object.freeze(["card", "og", "thumb"]),
  hero: Object.freeze(["hero"]),
});

const FULL_UPLOAD_FOCAL_CROP_RECT: UploadFocalCropRect = Object.freeze({
  left: 0,
  top: 0,
  width: 1,
  height: 1,
});

type NormalizeUploadFocalCropsOptions = {
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  fallbackPoints?: unknown;
  fallbackPoint?: unknown;
};

type DeriveUploadViewportCoverRectArgs = {
  rect: UploadFocalCropRect;
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  positionX?: number;
  positionY?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundNormalized = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const isUploadFocalPointValue = (value: unknown): value is Partial<UploadFocalPoint> =>
  Boolean(value && typeof value === "object" && ("x" in value || "y" in value));

const isUploadFocalCropRectValue = (value: unknown): value is Partial<UploadFocalCropRect> =>
  Boolean(
    value &&
      typeof value === "object" &&
      ("left" in value || "top" in value || "width" in value || "height" in value),
  );

const resolvePresetFocalSource = ({
  value,
  fallback,
  preset,
}: {
  value: unknown;
  fallback?: unknown;
  preset: UploadFocalPresetKey;
}) => {
  if (isUploadFocalPointValue(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Partial<Record<UploadLegacyFocalPresetKey, unknown>>;
    for (const key of UPLOAD_FOCAL_PRESET_FALLBACK_ORDER[preset]) {
      if (record[key] && typeof record[key] === "object") {
        return record[key];
      }
    }
  }
  if (isUploadFocalPointValue(fallback)) {
    return fallback;
  }
  if (fallback && typeof fallback === "object") {
    const record = fallback as Partial<Record<UploadLegacyFocalPresetKey, unknown>>;
    for (const key of UPLOAD_FOCAL_PRESET_FALLBACK_ORDER[preset]) {
      if (record[key] && typeof record[key] === "object") {
        return record[key];
      }
    }
  }
  return null;
};

const resolvePresetFocalCropSource = ({
  value,
  fallback,
  preset,
}: {
  value: unknown;
  fallback?: unknown;
  preset: UploadFocalPresetKey;
}) => {
  if (isUploadFocalCropRectValue(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Partial<Record<UploadFocalPresetKey, unknown>>;
    if (isUploadFocalCropRectValue(record[preset])) {
      return record[preset];
    }
  }
  if (isUploadFocalCropRectValue(fallback)) {
    return fallback;
  }
  if (fallback && typeof fallback === "object") {
    const record = fallback as Partial<Record<UploadFocalPresetKey, unknown>>;
    if (isUploadFocalCropRectValue(record[preset])) {
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

export const normalizeUploadFocalCropRect = (
  value: unknown,
  fallbackValue?: unknown,
): UploadFocalCropRect => {
  const source =
    value && typeof value === "object" ? (value as Partial<UploadFocalCropRect>) : null;
  const fallback =
    fallbackValue && typeof fallbackValue === "object"
      ? (fallbackValue as Partial<UploadFocalCropRect>)
      : FULL_UPLOAD_FOCAL_CROP_RECT;
  const fallbackLeft = Number(fallback.left);
  const fallbackTop = Number(fallback.top);
  const fallbackWidth = Number(fallback.width);
  const fallbackHeight = Number(fallback.height);
  let width = Number(source?.width);
  let height = Number(source?.height);

  if (!Number.isFinite(width) || width <= 0) {
    width = Number.isFinite(fallbackWidth) && fallbackWidth > 0 ? fallbackWidth : 1;
  }
  if (!Number.isFinite(height) || height <= 0) {
    height = Number.isFinite(fallbackHeight) && fallbackHeight > 0 ? fallbackHeight : 1;
  }

  width = clamp(width, Number.EPSILON, 1);
  height = clamp(height, Number.EPSILON, 1);

  let left = Number(source?.left);
  let top = Number(source?.top);
  if (!Number.isFinite(left)) {
    left = Number.isFinite(fallbackLeft) ? fallbackLeft : 0;
  }
  if (!Number.isFinite(top)) {
    top = Number.isFinite(fallbackTop) ? fallbackTop : 0;
  }

  left = clamp(left, 0, 1);
  top = clamp(top, 0, 1);

  if (left + width > 1) {
    left = Math.max(0, 1 - width);
  }
  if (top + height > 1) {
    top = Math.max(0, 1 - height);
  }

  return {
    left,
    top,
    width,
    height,
  };
};

export const deriveUploadFocalPointFromCropRect = (value: unknown): UploadFocalPoint => {
  const rect = normalizeUploadFocalCropRect(value);
  return normalizeUploadFocalPoint({
    x: roundNormalized(rect.left + rect.width / 2),
    y: roundNormalized(rect.top + rect.height / 2),
  });
};

export const deriveDefaultUploadFocalCropRect = ({
  preset,
  sourceWidth,
  sourceHeight,
  focalPoint,
}: {
  preset: UploadFocalPresetKey;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  focalPoint?: unknown;
}): UploadFocalCropRect => {
  const dimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[preset];
  const safeSourceWidth = Math.max(1, Math.floor(Number(sourceWidth || 1000)));
  const safeSourceHeight = Math.max(1, Math.floor(Number(sourceHeight || 1000)));
  const rect = computeUploadFocalCoverRect({
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    targetWidth: dimensions.width,
    targetHeight: dimensions.height,
    focalPoint: normalizeUploadFocalPoint(focalPoint),
  });
  return {
    left: rect.left / safeSourceWidth,
    top: rect.top / safeSourceHeight,
    width: rect.width / safeSourceWidth,
    height: rect.height / safeSourceHeight,
  };
};

export const deriveUploadFocalCropsFromPoints = ({
  value,
  fallbackValue,
  sourceWidth,
  sourceHeight,
}: {
  value?: unknown;
  fallbackValue?: unknown;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
}): UploadFocalCrops => {
  const next = {} as UploadFocalCrops;
  UPLOAD_FOCAL_PRESET_KEYS.forEach((preset) => {
    next[preset] = deriveDefaultUploadFocalCropRect({
      preset,
      sourceWidth,
      sourceHeight,
      focalPoint: resolvePresetFocalSource({ value, fallback: fallbackValue, preset }),
    });
  });
  return next;
};

export const normalizeUploadFocalCrops = (
  value?: unknown,
  fallbackValue?: unknown,
  options: NormalizeUploadFocalCropsOptions = {},
): UploadFocalCrops => {
  const next = {} as UploadFocalCrops;
  const fallbackFromPoints = deriveUploadFocalCropsFromPoints({
    value: options.fallbackPoints,
    fallbackValue: options.fallbackPoint,
    sourceWidth: options.sourceWidth,
    sourceHeight: options.sourceHeight,
  });
  UPLOAD_FOCAL_PRESET_KEYS.forEach((preset) => {
    next[preset] = normalizeUploadFocalCropRect(
      resolvePresetFocalCropSource({ value, fallback: fallbackValue, preset }),
      fallbackFromPoints[preset],
    );
  });
  return next;
};

export const normalizeUploadFocalPoints = (
  value?: unknown,
  fallbackValue?: unknown,
): UploadFocalPoints => {
  const next = {} as UploadFocalPoints;
  UPLOAD_FOCAL_PRESET_KEYS.forEach((preset) => {
    const cropSource = resolvePresetFocalCropSource({ value, fallback: fallbackValue, preset });
    next[preset] = cropSource
      ? deriveUploadFocalPointFromCropRect(cropSource)
      : normalizeUploadFocalPoint(resolvePresetFocalSource({ value, fallback: fallbackValue, preset }));
  });
  return next;
};

export const deriveLegacyUploadFocalPoint = (
  value?: unknown,
  fallbackValue?: unknown,
): UploadFocalPoint =>
  normalizeUploadFocalPoints(value, fallbackValue).card;

export const deriveUploadFocalPointsFromCrops = (value?: unknown, fallbackValue?: unknown): UploadFocalPoints =>
  normalizeUploadFocalPoints(value, fallbackValue);

export const deriveUploadViewportCoverRect = ({
  rect,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  positionX = 0.5,
  positionY = 0.5,
}: DeriveUploadViewportCoverRectArgs): UploadFocalCropRect => {
  const normalizedRect = normalizeUploadFocalCropRect(rect);
  const safeSourceWidth = Math.max(1, Math.floor(Number(sourceWidth || 1)));
  const safeSourceHeight = Math.max(1, Math.floor(Number(sourceHeight || 1)));
  const safeViewportWidth = Math.max(1, Math.floor(Number(viewportWidth || 1)));
  const safeViewportHeight = Math.max(1, Math.floor(Number(viewportHeight || 1)));
  const nestedRect = computeUploadFocalCoverRect({
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    targetWidth: safeViewportWidth,
    targetHeight: safeViewportHeight,
    focalPoint: normalizeUploadFocalPoint({
      x: positionX,
      y: positionY,
    }),
  });

  return normalizeUploadFocalCropRect({
    left: normalizedRect.left + normalizedRect.width * (nestedRect.left / safeSourceWidth),
    top: normalizedRect.top + normalizedRect.height * (nestedRect.top / safeSourceHeight),
    width: normalizedRect.width * (nestedRect.width / safeSourceWidth),
    height: normalizedRect.height * (nestedRect.height / safeSourceHeight),
  });
};

export const computeUploadContainFitRect = ({
  stageWidth,
  stageHeight,
  sourceWidth,
  sourceHeight,
}: {
  stageWidth: number;
  stageHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}): UploadContainFitRect => {
  const safeStageWidth = Math.max(0, Number(stageWidth || 0));
  const safeStageHeight = Math.max(0, Number(stageHeight || 0));
  const safeSourceWidth = Math.max(1, Number(sourceWidth || 1));
  const safeSourceHeight = Math.max(1, Number(sourceHeight || 1));

  if (safeStageWidth <= 0 || safeStageHeight <= 0) {
    return {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      scale: 0,
    };
  }

  const scale = Math.min(safeStageWidth / safeSourceWidth, safeStageHeight / safeSourceHeight);
  const width = safeSourceWidth * scale;
  const height = safeSourceHeight * scale;

  return {
    left: (safeStageWidth - width) / 2,
    top: (safeStageHeight - height) / 2,
    width,
    height,
    scale,
  };
};

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
