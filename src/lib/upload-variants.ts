export type UploadVariantPresetKey = "card" | "cardWide" | "hero" | "og";

export type UploadVariantFormat = {
  url?: string | null;
  mime?: string | null;
  size?: number | null;
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
};

export type UploadMediaVariantsMap = Record<string, UploadMediaVariantEntry>;

const FALLBACK_ORIGIN = "https://nekomata.local";

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
  const presetRecord = variants[preset];
  if (!presetRecord || typeof presetRecord !== "object") {
    return { avif: "", webp: "", fallback: "" };
  }
  const formats =
    presetRecord.formats && typeof presetRecord.formats === "object"
      ? presetRecord.formats
      : null;
  if (!formats) {
    return { avif: "", webp: "", fallback: "" };
  }
  return {
    avif: toFormatUrl(formats.avif),
    webp: toFormatUrl(formats.webp),
    fallback: toFormatUrl(formats.fallback),
  };
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
  return resolved.fallback || resolved.webp || resolved.avif || String(src || "").trim();
};
