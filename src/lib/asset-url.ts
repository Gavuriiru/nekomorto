export const normalizeAssetBase = (value: unknown) =>
  String(value || "").trim().replace(/\/+$/, "");

export const resolveAssetBase = ({
  envAssetBase,
  envApiBase,
  locationOrigin,
}: {
  envAssetBase?: unknown;
  envApiBase?: unknown;
  locationOrigin?: unknown;
}) => {
  const normalizedAssetBase = normalizeAssetBase(envAssetBase);
  if (normalizedAssetBase) {
    return normalizedAssetBase;
  }

  const normalizedApiBase = normalizeAssetBase(envApiBase);
  if (normalizedApiBase) {
    return normalizedApiBase;
  }

  return normalizeAssetBase(locationOrigin);
};

export const getAssetBase = () =>
  resolveAssetBase({
    envAssetBase: import.meta.env.VITE_ASSET_BASE,
    envApiBase: import.meta.env.VITE_API_BASE,
    locationOrigin:
      typeof window !== "undefined" && window.location ? window.location.origin : "",
  });

export const normalizeAssetUrl = (rawUrl?: string | null) => {
  if (!rawUrl) {
    return rawUrl || "";
  }
  if (typeof window === "undefined") {
    return rawUrl;
  }
  const trimmed = String(rawUrl).trim();
  if (!trimmed) {
    return "";
  }

  const assetBase = getAssetBase();
  if (trimmed.startsWith("/")) {
    return assetBase ? `${assetBase}${trimmed}` : trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const isHttpUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    if (isHttpUrl && parsed.pathname.startsWith("/uploads/")) {
      return assetBase
        ? `${assetBase}${parsed.pathname}${parsed.search}${parsed.hash}`
        : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
};
