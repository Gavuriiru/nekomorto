const REQUIRED_DEPENDENCY_KEYS = ["isProduction", "metricsRegistry", "rateLimiter"];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[rate-limit-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createRateLimitRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const { isProduction, metricsRegistry, rateLimiter } = dependencies;

  const consumeIpRateLimit = async ({ bucket, ip, maxPerWindow, windowMs = 60 * 1000 }) => {
    if (!ip) {
      return true;
    }
    try {
      const result = await rateLimiter.consume({
        bucket,
        key: ip,
        limit: maxPerWindow,
        windowMs,
      });
      if (!result?.allowed) {
        metricsRegistry.inc("rate_limit_reject_total", {
          bucket: String(bucket || "default"),
        });
      }
      return Boolean(result?.allowed);
    } catch {
      return true;
    }
  };

  const canSubmitComment = async (ip) =>
    consumeIpRateLimit({
      bucket: "comment_submit",
      ip,
      maxPerWindow: 3,
    });

  const canAttemptAuth = async (ip) =>
    consumeIpRateLimit({
      bucket: "auth_attempt",
      ip,
      maxPerWindow: isProduction ? 20 : 120,
    });

  const canVerifyMfa = async (ip) =>
    consumeIpRateLimit({
      bucket: "mfa_verify",
      ip,
      maxPerWindow: isProduction ? 10 : 60,
    });

  const canManageMfa = async (ip) =>
    consumeIpRateLimit({
      bucket: "mfa_manage",
      ip,
      maxPerWindow: isProduction ? 10 : 60,
    });

  const canUploadImage = async (ip) =>
    consumeIpRateLimit({
      bucket: "upload_image",
      ip,
      maxPerWindow: isProduction ? 20 : 120,
    });

  const canBootstrap = async (ip) =>
    consumeIpRateLimit({
      bucket: "bootstrap_owner",
      ip,
      maxPerWindow: isProduction ? 5 : 60,
    });

  const canRegisterView = async (ip) =>
    consumeIpRateLimit({
      bucket: "register_view",
      ip,
      maxPerWindow: isProduction ? 60 : 300,
    });

  const canRegisterPollVote = async (ip) =>
    consumeIpRateLimit({
      bucket: "poll_vote",
      ip,
      maxPerWindow: isProduction ? 20 : 120,
    });

  const canReadPublicAsset = async (ip) =>
    consumeIpRateLimit({
      bucket: "public_asset_read",
      ip,
      maxPerWindow: isProduction ? 600 : 5000,
    });

  return {
    canAttemptAuth,
    canBootstrap,
    canManageMfa,
    canRegisterPollVote,
    canRegisterView,
    canReadPublicAsset,
    canSubmitComment,
    canUploadImage,
    canVerifyMfa,
    consumeIpRateLimit,
  };
};

export default createRateLimitRuntime;
