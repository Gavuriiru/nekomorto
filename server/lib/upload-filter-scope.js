import { getUploadAssetDescriptors } from "./upload-storage.js";
import { normalizeUploadUrl } from "./uploads-reorganizer.js";

export const normalizeUploadFilterFolder = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/uploads\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\\/g, "/");
  return normalized;
};

export const normalizeUploadFilterUrl = (value) => normalizeUploadUrl(value) || "";

export const getUploadRelativePath = (uploadUrl) =>
  String(uploadUrl || "")
    .replace(/^\/uploads\//, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

const matchesFolderFilterForRelativePath = (relativePath, normalizedFolder) => {
  if (!normalizedFolder) {
    return true;
  }
  const normalizedRelative = getUploadRelativePath(relativePath);
  return (
    normalizedRelative === normalizedFolder ||
    normalizedRelative.startsWith(`${normalizedFolder}/`)
  );
};

const getUploadAssetUrls = (entry) =>
  getUploadAssetDescriptors(entry)
    .map((asset) => normalizeUploadFilterUrl(asset?.url))
    .filter(Boolean);

export const buildUploadFilterScope = ({
  uploads,
  folder = "",
  uploadId = "",
  url = "",
} = {}) => {
  const normalizedFolder = normalizeUploadFilterFolder(folder);
  const normalizedUploadId = String(uploadId || "").trim();
  const normalizedUrl = normalizeUploadFilterUrl(url);

  const matchesUploadEntry = (entry) => {
    if (normalizedUploadId && String(entry?.id || "").trim() !== normalizedUploadId) {
      return false;
    }
    const assetUrls = getUploadAssetUrls(entry);
    if (normalizedUrl && !assetUrls.includes(normalizedUrl)) {
      return false;
    }
    if (
      normalizedFolder &&
      !assetUrls.some((assetUrl) =>
        matchesFolderFilterForRelativePath(getUploadRelativePath(assetUrl), normalizedFolder),
      )
    ) {
      return false;
    }
    return true;
  };

  const selectedUploads = (Array.isArray(uploads) ? uploads : []).filter((entry) =>
    matchesUploadEntry(entry),
  );
  const selectedAssetUrls = new Set(selectedUploads.flatMap((entry) => getUploadAssetUrls(entry)));

  const matchesUploadUrl = (value) => {
    const normalizedValue = normalizeUploadFilterUrl(value);
    if (!normalizedValue) {
      return false;
    }
    if (selectedAssetUrls.has(normalizedValue)) {
      return true;
    }
    if (normalizedUrl) {
      return normalizedValue === normalizedUrl;
    }
    if (normalizedFolder) {
      return matchesFolderFilterForRelativePath(
        getUploadRelativePath(normalizedValue),
        normalizedFolder,
      );
    }
    if (normalizedUploadId) {
      return false;
    }
    return true;
  };

  return {
    hasFilters: Boolean(normalizedFolder || normalizedUploadId || normalizedUrl),
    normalizedFolder,
    normalizedUploadId,
    normalizedUrl,
    selectedUploads,
    selectedAssetUrls,
    matchesUploadEntry,
    matchesUploadUrl,
  };
};

export default buildUploadFilterScope;
