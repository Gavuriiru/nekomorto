import { normalizeComparableUploadUrl } from "@/components/image-library/utils";

export const toComparableSelectionKey = (value: string | null | undefined) => {
  const normalized = normalizeComparableUploadUrl(value);
  return normalized || String(value || "").trim();
};

export const dedupeUrlsByComparableKey = (urls: string[]) => {
  const unique: string[] = [];
  const seen = new Set<string>();
  urls.forEach((url) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) {
      return;
    }
    const key = toComparableSelectionKey(trimmed);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(trimmed);
  });
  return unique;
};

export const areSelectionsSemanticallyEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (toComparableSelectionKey(left[index]) !== toComparableSelectionKey(right[index])) {
      return false;
    }
  }
  return true;
};

export const toSelectionSignature = (urls: string[]) =>
  urls.map((url) => toComparableSelectionKey(url)).join("\u0001");

export const parseSelectionSignature = (value: string) =>
  value
    ? value
        .split("\u0001")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const normalizeProjectIdList = (value: unknown) => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

const normalizeFolderList = (value: unknown) => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

export const toStableProjectIdSignature = (value: unknown) =>
  normalizeProjectIdList(value).join("\u0001");

export const toStableFolderSignature = (value: unknown) =>
  JSON.stringify(normalizeFolderList(value));

export const parseStableFolderSignature = (value: string) => {
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "")) : [];
  } catch {
    return [] as string[];
  }
};

export const buildSelectionSeed = ({
  currentSelectionUrls,
  currentSelectionUrl,
  mode,
}: {
  currentSelectionUrls?: string[];
  currentSelectionUrl?: string;
  mode: "single" | "multiple";
}) => {
  const fromArray =
    Array.isArray(currentSelectionUrls) && currentSelectionUrls.length > 0
      ? currentSelectionUrls
      : undefined;
  const baseUrls = fromArray ?? (currentSelectionUrl ? [currentSelectionUrl] : []);
  const deduped = dedupeUrlsByComparableKey(baseUrls);
  if (mode === "multiple") {
    return deduped;
  }
  return deduped.length > 0 ? [deduped[0]] : [];
};
