const PENDING_MFA_ALLOWED_API_PATHS = new Set([
  "/auth/mfa/verify",
  "/logout",
  "/version",
  "/contracts",
  "/contracts/v1",
  "/contracts/v1.json",
]);

const PENDING_MFA_ENROLLMENT_ALLOWED_API_PATHS = new Set([
  "/me/security/totp/enroll/start",
  "/me/security/totp/enroll/confirm",
  "/logout",
  "/version",
  "/contracts",
  "/contracts/v1",
  "/contracts/v1.json",
]);

const normalizeApiPath = (pathValue) => {
  return String(pathValue || "").split("?")[0] || "/";
};

export const resolvePendingAuthStage = (session) => {
  if (session?.pendingMfaUser?.id && !session?.user?.id) {
    return "mfa";
  }
  if (session?.pendingMfaEnrollmentUser?.id && !session?.user?.id) {
    return "mfa_enrollment";
  }
  return null;
};

export const canAccessApiDuringPendingAuth = (stage, pathValue) => {
  const normalizedPath = normalizeApiPath(pathValue);
  if (normalizedPath.startsWith("/public/")) {
    return true;
  }
  if (stage === "mfa") {
    return PENDING_MFA_ALLOWED_API_PATHS.has(normalizedPath);
  }
  if (stage === "mfa_enrollment") {
    return PENDING_MFA_ENROLLMENT_ALLOWED_API_PATHS.has(normalizedPath);
  }
  return false;
};

export const canAccessApiDuringPendingMfa = (pathValue) =>
  canAccessApiDuringPendingAuth("mfa", pathValue);

export const canAccessApiDuringPendingMfaEnrollment = (pathValue) =>
  canAccessApiDuringPendingAuth("mfa_enrollment", pathValue);

export default {
  canAccessApiDuringPendingAuth,
  canAccessApiDuringPendingMfa,
  canAccessApiDuringPendingMfaEnrollment,
  resolvePendingAuthStage,
};
