const normalizeScopeToken = (value) =>
  String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

export const getUploadScopeRootSegment = (value) => {
  const normalized = normalizeScopeToken(value);
  return String(normalized.split("/")[0] || "").toLowerCase();
};

export const isUsersUploadScopeFolder = (value) => getUploadScopeRootSegment(value) === "users";

const resolveEntryFolder = (entry) => {
  if (!entry || typeof entry !== "object") {
    return "";
  }
  if (typeof entry.folder === "string" && entry.folder.trim()) {
    return entry.folder;
  }
  const normalizedUrl = String(entry.url || "").trim();
  if (!normalizedUrl.startsWith("/uploads/")) {
    return "";
  }
  const relativePath = normalizedUrl.replace(/^\/uploads\//, "");
  const segments = normalizeScopeToken(relativePath).split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "";
  }
  return segments.slice(0, -1).join("/");
};

export const resolveAvatarUploadScopeAccess = ({
  hasUploadManagement = false,
  hasUsersBasic = false,
  folder = "",
  listAll = false,
} = {}) => {
  if (hasUploadManagement) {
    return {
      allowed: true,
      limitedToAvatarScope: false,
    };
  }
  if (!hasUsersBasic) {
    return {
      allowed: false,
      limitedToAvatarScope: false,
    };
  }
  if (listAll || !isUsersUploadScopeFolder(folder)) {
    return {
      allowed: false,
      limitedToAvatarScope: true,
    };
  }
  return {
    allowed: true,
    limitedToAvatarScope: true,
  };
};

export const shouldIncludeUploadInHashDedupe = (entry, { limitedToAvatarScope = false } = {}) => {
  if (!limitedToAvatarScope) {
    return true;
  }
  return isUsersUploadScopeFolder(resolveEntryFolder(entry));
};
