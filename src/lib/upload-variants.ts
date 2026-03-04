export type UploadVariantPresetKey =
  | "card"
  | "cardHome"
  | "cardWide"
  | "hero"
  | "og"
  | "poster"
  | "posterThumb"
  | "square";

export type UploadVariantFormat = {
  url?: string | null;
  mime?: string | null;
  size?: number | null;
};

export type UploadMediaVariantFocalPoint = {
  x?: number | null;
  y?: number | null;
};

export type UploadVariantPreset = {
  width?: number | null;
  height?: number | null;
  formats?: {
    avif?: UploadVariantFormat | null;
    webp?: UploadVariantFormat | null;
    fallback?: UploadVariantFormat | null;
  } | null;
};

export type UploadMediaVariantEntry = {
  variantsVersion?: number | null;
  variants?: Partial<Record<UploadVariantPresetKey, UploadVariantPreset | null>> | null;
  focalPoints?: Partial<Record<"card" | "hero", UploadMediaVariantFocalPoint | null>> | null;
  focalPoint?: UploadMediaVariantFocalPoint | null;
};

export type UploadMediaVariantsMap = Record<string, UploadMediaVariantEntry>;

const FALLBACK_ORIGIN = "https://nekomata.local";
const UPLOAD_VARIANT_PRESET_FALLBACK_ORDER: Record<
  UploadVariantPresetKey,
  readonly UploadVariantPresetKey[]
> = Object.freeze({
  card: Object.freeze(["card"]),
  cardHome: Object.freeze(["cardHome", "card"]),
  cardWide: Object.freeze(["cardWide"]),
  hero: Object.freeze(["hero"]),
  og: Object.freeze(["og"]),
  poster: Object.freeze(["poster"]),
  posterThumb: Object.freeze(["posterThumb", "poster"]),
  square: Object.freeze(["square"]),
});

export const normalizeUploadVariantUrlKey = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split("?")[0].split("#")[0];
  }
  try {
    const base =
      typeof window !== "undefined" && window?.location?.origin
        ? window.location.origin
        : FALLBACK_ORIGIN;
    const parsed = new URL(trimmed, base);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Ignore parse errors and fallback to empty key.
  }
  return "";
};

const toFormatUrl = (format: UploadVariantFormat | null | undefined) => {
  if (!format || typeof format !== "object") {
    return "";
  }
  const url = String(format.url || "").trim();
  if (!url) {
    return "";
  }
  return url;
};

const normalizeFocalAxis = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.min(1, Math.max(0, numeric));
};

const normalizeFocalPoint = (
  value: UploadMediaVariantFocalPoint | null | undefined,
): { x: number; y: number } | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const x = normalizeFocalAxis(value.x);
  const y = normalizeFocalAxis(value.y);
  if (x === null || y === null) {
    return null;
  }
  return { x, y };
};

export const resolveUploadVariantSources = ({
  src,
  preset,
  mediaVariants,
}: {
  src: string | null | undefined;
  preset: UploadVariantPresetKey;
  mediaVariants?: UploadMediaVariantsMap | null;
}) => {
  const key = normalizeUploadVariantUrlKey(src);
  if (!key || !mediaVariants || typeof mediaVariants !== "object") {
    return { avif: "", webp: "", fallback: "" };
  }
  const entry = mediaVariants[key];
  if (!entry || typeof entry !== "object") {
    return { avif: "", webp: "", fallback: "" };
  }
  const variants = entry.variants && typeof entry.variants === "object" ? entry.variants : null;
  if (!variants) {
    return { avif: "", webp: "", fallback: "" };
  }
  for (const fallbackPreset of UPLOAD_VARIANT_PRESET_FALLBACK_ORDER[preset]) {
    const presetRecord = variants[fallbackPreset];
    if (!presetRecord || typeof presetRecord !== "object") {
      continue;
    }
    const formats =
      presetRecord.formats && typeof presetRecord.formats === "object"
        ? presetRecord.formats
        : null;
    if (!formats) {
      continue;
    }
    return {
      avif: toFormatUrl(formats.avif),
      webp: toFormatUrl(formats.webp),
      fallback: toFormatUrl(formats.fallback),
    };
  }
  return {
    avif: "",
    webp: "",
    fallback: "",
  };
};

export const resolveUploadVariantFocalPoint = ({
  src,
  preset,
  mediaVariants,
}: {
  src: string | null | undefined;
  preset: UploadVariantPresetKey;
  mediaVariants?: UploadMediaVariantsMap | null;
}) => {
  const key = normalizeUploadVariantUrlKey(src);
  if (!key || !mediaVariants || typeof mediaVariants !== "object") {
    return null;
  }
  const entry = mediaVariants[key];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const mappedPreset = preset === "hero" ? "hero" : "card";
  const focalPoints =
    entry.focalPoints && typeof entry.focalPoints === "object" ? entry.focalPoints : null;
  const presetFocal = focalPoints ? normalizeFocalPoint(focalPoints[mappedPreset]) : null;
  if (presetFocal) {
    return presetFocal;
  }
  return normalizeFocalPoint(entry.focalPoint);
};

export const resolveUploadVariantUrl = ({
  src,
  preset,
  mediaVariants,
}: {
  src: string | null | undefined;
  preset: UploadVariantPresetKey;
  mediaVariants?: UploadMediaVariantsMap | null;
}) => {
  const resolved = resolveUploadVariantSources({ src, preset, mediaVariants });
  const sourceUrl = String(src || "").trim();
  return resolved.fallback || resolved.webp || sourceUrl || resolved.avif;
};
