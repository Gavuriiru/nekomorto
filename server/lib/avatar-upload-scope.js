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

const normalizeScopeUserId = (value) => String(value || "").trim();

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

const buildAllowedUploadRoots = ({
  canManagePosts = false,
  canManageProjects = false,
  canManageUsersBasic = false,
  canManagePages = false,
  canManageSettings = false,
  sessionUserId = "",
  scopeUserId = "",
} = {}) => {
  const allowedRoots = new Set();
  if (canManagePosts) {
    allowedRoots.add("posts");
  }
  if (canManageProjects) {
    allowedRoots.add("projects");
  }
  const normalizedSessionUserId = normalizeScopeUserId(sessionUserId);
  const normalizedScopeUserId = normalizeScopeUserId(scopeUserId);
  if (
    canManageUsersBasic ||
    (normalizedSessionUserId && normalizedScopeUserId && normalizedSessionUserId === normalizedScopeUserId)
  ) {
    allowedRoots.add("users");
  }
  if (canManagePages || canManagePosts || canManageSettings) {
    allowedRoots.add("shared");
  }
  if (canManageSettings) {
    allowedRoots.add("");
    allowedRoots.add("branding");
    allowedRoots.add("downloads");
    allowedRoots.add("socials");
  }
  return Array.from(allowedRoots);
};

export const resolveUploadScopeAccess = ({
  hasUploadManagement = false,
  canManagePosts = false,
  canManageProjects = false,
  canManageUsersBasic = false,
  canManagePages = false,
  canManageSettings = false,
  sessionUserId = "",
  scopeUserId = "",
  folder = "",
  listAll = false,
} = {}) => {
  if (hasUploadManagement) {
    return {
      allowed: true,
      hasFullAccess: true,
      allowedRoots: [],
    };
  }
  const allowedRoots = buildAllowedUploadRoots({
    canManagePosts,
    canManageProjects,
    canManageUsersBasic,
    canManagePages,
    canManageSettings,
    sessionUserId,
    scopeUserId,
  });
  if (allowedRoots.length === 0) {
    return {
      allowed: false,
      hasFullAccess: false,
      allowedRoots,
    };
  }
  if (listAll) {
    return {
      allowed: true,
      hasFullAccess: false,
      allowedRoots,
    };
  }
  const requestedRoot = getUploadScopeRootSegment(folder);
  return {
    allowed: allowedRoots.includes(requestedRoot),
    hasFullAccess: false,
    allowedRoots,
  };
};

export const isUploadFolderAllowedInScope = (folder, { hasFullAccess = false, allowedRoots = [] } = {}) => {
  if (hasFullAccess) {
    return true;
  }
  return allowedRoots.includes(getUploadScopeRootSegment(folder));
};

export const shouldIncludeUploadInHashDedupe = (entry, accessScope = {}) => {
  return isUploadFolderAllowedInScope(resolveEntryFolder(entry), accessScope);
};
