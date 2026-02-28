const PENDING_MFA_ALLOWED_API_PATHS = new Set([
  "/auth/mfa/verify",
  "/logout",
  "/version",
  "/contracts",
  "/contracts/v1",
  "/contracts/v1.json",
]);

const normalizeApiPath = (pathValue) => {
  return String(pathValue || "").split("?")[0] || "/";
};

export const canAccessApiDuringPendingMfa = (pathValue) => {
  const normalizedPath = normalizeApiPath(pathValue);
  if (normalizedPath.startsWith("/public/")) {
    return true;
  }
  return PENDING_MFA_ALLOWED_API_PATHS.has(normalizedPath);
};
