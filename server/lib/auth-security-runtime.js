const REQUIRED_DEPENDENCY_KEYS = [
  "authFailedBurstCritical",
  "authFailedBurstWarning",
  "authFailedByIpCounter",
  "buildOtpAuthUrl",
  "createEnrollmentToken",
  "emitSecurityEvent",
  "excessiveSessionsWarning",
  "generateTotpSecret",
  "getIpv4Network24",
  "getRequestIp",
  "getUserTotpSecret",
  "hashRecoveryCode",
  "listActiveSessionsForUser",
  "loadSiteSettings",
  "loadUserIdentityRecords",
  "loadUserLocalAuthRecord",
  "loadUserMfaTotpRecord",
  "writeUserLocalAuthRecord",
  "loadUserSessionIndexRecords",
  "metricsRegistry",
  "mfaEnrollmentTtlMs",
  "mfaFailedBurstWarning",
  "mfaFailedByUserCounter",
  "mfaRecoveryCodePepper",
  "newNetworkLookbackMs",
  "primaryAppOrigin",
  "sanitizeAssetUrl",
  "securityEventSeverity",
  "sessionIndexTouchMinIntervalMs",
  "sessionIndexTouchTsBySid",
  "shouldEmitSecurityRuleEvent",
  "upsertUserSessionIndexRecord",
  "verifyTotpCode",
  "writeUserMfaTotpRecord",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[auth-security-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createAuthSecurityRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    authFailedBurstCritical,
    authFailedBurstWarning,
    authFailedByIpCounter,
    buildOtpAuthUrl,
    createEnrollmentToken,
    emitSecurityEvent,
    excessiveSessionsWarning,
    generateTotpSecret,
    getIpv4Network24,
    getRequestIp,
    getUserTotpSecret,
    hashRecoveryCode,
    listActiveSessionsForUser,
    loadSiteSettings,
    loadUserIdentityRecords,
    loadUserLocalAuthRecord,
    loadUserMfaTotpRecord,
    loadUserSessionIndexRecords,
    metricsRegistry,
    mfaEnrollmentTtlMs,
    mfaFailedBurstWarning,
    mfaFailedByUserCounter,
    mfaIconUrl,
    mfaIssuer,
    mfaRecoveryCodePepper,
    newNetworkLookbackMs,
    primaryAppOrigin,
    sanitizeAssetUrl,
    securityEventSeverity,
    sessionIndexTouchMinIntervalMs,
    sessionIndexTouchTsBySid,
    shouldEmitSecurityRuleEvent,
    upsertUserSessionIndexRecord,
    verifyTotpCode,
    writeUserMfaTotpRecord,
  } = dependencies;

  const resolveRecoveryCodesRemaining = (record) => {
    const list = Array.isArray(record?.recoveryCodesHashed) ? record.recoveryCodesHashed : [];
    return list.filter((item) => typeof item === "string" && item.trim()).length;
  };

  const verifyTotpOrRecoveryCode = ({
    userId,
    codeOrRecoveryCode,
    consumeRecoveryCode = true,
  } = {}) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      return { ok: false, reason: "invalid_user" };
    }
    const code = String(codeOrRecoveryCode || "").trim();
    if (!code) {
      return { ok: false, reason: "code_required" };
    }

    const secret = getUserTotpSecret(normalizedUserId);
    if (secret && verifyTotpCode({ secret, code })) {
      return {
        ok: true,
        method: "totp",
        remainingRecoveryCodes: resolveRecoveryCodesRemaining(
          loadUserMfaTotpRecord(normalizedUserId),
        ),
      };
    }

    const record = loadUserMfaTotpRecord(normalizedUserId);
    if (!record) {
      return { ok: false, reason: "mfa_not_enabled" };
    }
    const hashes = Array.isArray(record.recoveryCodesHashed) ? record.recoveryCodesHashed : [];
    const targetHash = hashRecoveryCode({ code, pepper: mfaRecoveryCodePepper });
    if (!targetHash) {
      return { ok: false, reason: "invalid_code" };
    }
    const index = hashes.findIndex((item) => item === targetHash);
    if (index < 0) {
      return { ok: false, reason: "invalid_code" };
    }

    const remainingHashes = consumeRecoveryCode
      ? hashes.filter((item, itemIndex) => itemIndex !== index)
      : hashes;
    if (consumeRecoveryCode) {
      writeUserMfaTotpRecord(normalizedUserId, {
        ...record,
        recoveryCodesHashed: remainingHashes,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      ok: true,
      method: "recovery_code",
      remainingRecoveryCodes: remainingHashes.length,
    };
  };

  const toAbsoluteAssetUrl = (value) => {
    const normalized = sanitizeAssetUrl(value);
    if (!normalized) {
      return "";
    }
    if (normalized.startsWith("/")) {
      return `${primaryAppOrigin}${normalized}`;
    }
    return normalized;
  };

  const resolveMfaMetadata = ({ req, userId, accountName } = {}) => {
    const normalizedUserId = String(userId || "").trim();
    const sessionUser =
      req?.session?.user || req?.session?.pendingMfaUser || req?.session?.pendingMfaEnrollmentUser || null;
    const issuer = String(mfaIssuer || "Nekomata").trim() || "Nekomata";
    const accountLabel =
      String(
        accountName || sessionUser?.username || sessionUser?.name || normalizedUserId || "user",
      ).trim() || "user";
    const siteSettings = loadSiteSettings();
    const iconUrl = toAbsoluteAssetUrl(
      sessionUser?.avatarUrl || mfaIconUrl || siteSettings?.site?.faviconUrl || "",
    );
    return {
      issuer,
      accountLabel,
      iconUrl,
    };
  };

  const startTotpEnrollment = ({ req, userId, accountName, issuer, iconUrl } = {}) => {
    if (!req?.session || !userId) {
      return null;
    }
    const secret = generateTotpSecret();
    const enrollmentToken = createEnrollmentToken();
    req.session.mfaEnrollment = {
      token: enrollmentToken,
      secret,
      userId: String(userId),
      createdAt: Date.now(),
      accountName: String(accountName || userId),
      issuer: String(issuer || mfaIssuer || "Nekomata"),
      iconUrl: String(iconUrl || ""),
    };
    return {
      enrollmentToken,
      secret,
      otpauthUrl: buildOtpAuthUrl({
        issuer: String(issuer || mfaIssuer || "Nekomata"),
        accountName: String(accountName || userId),
        secret,
        iconUrl: String(iconUrl || ""),
      }),
    };
  };

  const resolveEnrollmentFromSession = ({ req, enrollmentToken, userId } = {}) => {
    const stored = req?.session?.mfaEnrollment;
    if (!stored || typeof stored !== "object") {
      return null;
    }
    if (String(stored.userId || "") !== String(userId || "")) {
      return null;
    }
    if (String(stored.token || "") !== String(enrollmentToken || "")) {
      return null;
    }
    const createdAt = Number(stored.createdAt || 0);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > mfaEnrollmentTtlMs) {
      return null;
    }
    return stored;
  };

  const clearEnrollmentFromSession = (req) => {
    if (!req?.session) {
      return;
    }
    req.session.mfaEnrollment = null;
  };

  const buildMySecuritySummary = ({ req, userId } = {}) => {
    const record = loadUserMfaTotpRecord(userId);
    const activeSessions = listActiveSessionsForUser(userId);
    const metadata = resolveMfaMetadata({ req, userId });
    const localAuthRecord = loadUserLocalAuthRecord(userId);
    const loadedIdentityRecords =
      typeof loadUserIdentityRecords === "function" ? loadUserIdentityRecords({ userId }) : [];
    const identityRecords = Array.isArray(loadedIdentityRecords) ? loadedIdentityRecords : [];
    const oauthEmailSuggested = identityRecords
      .filter((entry) => entry?.emailNormalized && !entry?.disabledAt)
      .sort((left, right) => {
        const leftVerified = left?.emailVerified === true ? 1 : 0;
        const rightVerified = right?.emailVerified === true ? 1 : 0;
        if (leftVerified !== rightVerified) {
          return rightVerified - leftVerified;
        }
        const leftTsRaw = new Date(left?.lastUsedAt || left?.updatedAt || left?.linkedAt || 0).getTime();
        const rightTsRaw = new Date(right?.lastUsedAt || right?.updatedAt || right?.linkedAt || 0).getTime();
        const leftTs = Number.isFinite(leftTsRaw) ? leftTsRaw : 0;
        const rightTs = Number.isFinite(rightTsRaw) ? rightTsRaw : 0;
        return rightTs - leftTs;
      })[0]?.emailNormalized || null;
    const localAuthEmail = localAuthRecord?.emailNormalized || null;
    const localAuthUsername = localAuthRecord?.usernameNormalized || null;
    const identities = identityRecords
      .filter((entry) => entry?.provider)
      .map((entry) => ({
        provider: String(entry.provider || "").trim(),
        linked: !entry?.disabledAt,
        emailNormalized: entry?.emailNormalized || null,
        emailVerified: entry?.emailVerified === true,
        displayName: entry?.displayName || null,
        avatarUrl: entry?.avatarUrl || null,
        linkedAt: entry?.linkedAt || null,
        lastUsedAt: entry?.lastUsedAt || null,
        disabledAt: entry?.disabledAt || null,
      }))
      .sort((left, right) => String(left.provider).localeCompare(String(right.provider)));
    return {
      totpEnabled: Boolean(record && record.enabledAt && !record.disabledAt),
      recoveryCodesRemaining: resolveRecoveryCodesRemaining(record),
      activeSessionsCount: activeSessions.length,
      issuer: metadata.issuer,
      accountLabel: metadata.accountLabel,
      iconUrl: metadata.iconUrl,
      localAuthEnabled: Boolean(localAuthRecord?.passwordHash && !localAuthRecord?.disabledAt),
      localAuthTotpPending: Boolean(
        localAuthRecord?.totpEnrollmentRequiredAt && !(record && record.enabledAt && !record.disabledAt),
      ),
      localAuthIdentifier: localAuthEmail || localAuthUsername || null,
      localAuthEmail,
      localAuthUsername,
      oauthEmailSuggested,
      identities,
    };
  };

  const updateSessionIndexFromRequest = (req, { force = false } = {}) => {
    const sid = String(req?.sessionID || "").trim();
    const userId = String(req?.session?.user?.id || "").trim();
    const pendingMfaUserId = String(req?.session?.pendingMfaUser?.id || "").trim();
    const pendingMfaEnrollmentUserId = String(req?.session?.pendingMfaEnrollmentUser?.id || "").trim();
    const isPendingMfa = Boolean(pendingMfaUserId && !userId);
    const isPendingMfaEnrollment = Boolean(pendingMfaEnrollmentUserId && !userId);
    if (!sid || (!userId && !isPendingMfa && !isPendingMfaEnrollment)) {
      return;
    }
    const nowTs = Date.now();
    const lastTouchTs = Number(sessionIndexTouchTsBySid.get(sid) || 0);
    if (
      !force &&
      Number.isFinite(lastTouchTs) &&
      nowTs - lastTouchTs < sessionIndexTouchMinIntervalMs
    ) {
      return;
    }
    sessionIndexTouchTsBySid.set(sid, nowTs);
    upsertUserSessionIndexRecord({
      sid,
      userId: userId || pendingMfaUserId || pendingMfaEnrollmentUserId,
      createdAt: req?.session?.createdAt || new Date(nowTs).toISOString(),
      lastSeenAt: new Date(nowTs).toISOString(),
      lastIp: getRequestIp(req) || "",
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 512),
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      isPendingMfa,
    });
  };

  const resolvePendingMfaEnrollmentUser = (req) => req?.session?.pendingMfaEnrollmentUser || null;

  const isPendingMfaEnrollmentRequiredForUser = (req, userId) => {
    const pendingUser = resolvePendingMfaEnrollmentUser(req);
    return String(pendingUser?.id || "") === String(userId || "").trim();
  };

  const clearPendingMfaEnrollmentFromSession = (req) => {
    if (!req?.session) {
      return;
    }
    req.session.pendingMfaEnrollmentUser = null;
  };

  const promotePendingMfaEnrollmentToAuthenticatedSession = ({ req, preserved = {} } = {}) => {
    const pendingUser = resolvePendingMfaEnrollmentUser(req);
    if (!pendingUser?.id) {
      return null;
    }
    req.session.user = pendingUser;
    req.session.pendingMfaEnrollmentUser = null;
    Object.entries(preserved).forEach(([key, value]) => {
      req.session[key] = value;
    });
    return pendingUser;
  };

  const getPendingMfaEnrollmentUserId = (req) =>
    String(resolvePendingMfaEnrollmentUser(req)?.id || "").trim() || null;

  const getPendingMfaEnrollmentRedirectTarget = (req, fallback = "/dashboard") => {
    const value = String(req?.session?.loginNext || "").trim();
    return value || fallback;
  };

  const clearPendingMfaEnrollmentRedirectTarget = (req) => {
    if (!req?.session) {
      return;
    }
    req.session.loginNext = null;
    req.session.loginAppOrigin = null;
  };

  const markMfaEnrollmentRequiredForSession = ({ req, user, loginAppOrigin = null, loginNext = null } = {}) => {
    if (!req?.session || !user?.id) {
      return null;
    }
    req.session.user = null;
    req.session.pendingMfaUser = null;
    req.session.pendingMfaEnrollmentUser = user;
    req.session.mfaVerifiedAt = null;
    req.session.loginAppOrigin = loginAppOrigin;
    req.session.loginNext = loginNext;
    return req.session.pendingMfaEnrollmentUser;
  };

  const shouldRequireTotpEnrollmentForPasswordLogin = (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      return false;
    }
    const localAuthRecord = loadUserLocalAuthRecord(normalizedUserId);
    if (!localAuthRecord?.totpEnrollmentRequiredAt) {
      return false;
    }
    return !Boolean(loadUserMfaTotpRecord(normalizedUserId)?.enabledAt);
  };

  const completeRequiredMfaEnrollmentForSession = ({ req } = {}) => {
    const pendingUser = resolvePendingMfaEnrollmentUser(req);
    if (!pendingUser?.id) {
      return null;
    }
    req.session.user = pendingUser;
    req.session.pendingMfaEnrollmentUser = null;
    req.session.mfaVerifiedAt = new Date().toISOString();
    return pendingUser;
  };

  const getPendingMfaEnrollmentState = (req) => ({
    pending: Boolean(resolvePendingMfaEnrollmentUser(req)?.id),
    user: resolvePendingMfaEnrollmentUser(req),
    redirectTarget: getPendingMfaEnrollmentRedirectTarget(req),
  });


  const maybeEmitNewNetworkLoginEvent = ({ req, userId } = {}) => {
    const network = getIpv4Network24(getRequestIp(req));
    if (!network || !userId) {
      return;
    }
    const nowTs = Date.now();
    const seen = loadUserSessionIndexRecords({ userId, includeRevoked: true }).some((item) => {
      const ts = new Date(item?.lastSeenAt || 0).getTime();
      if (!Number.isFinite(ts) || nowTs - ts > newNetworkLookbackMs) {
        return false;
      }
      return getIpv4Network24(item?.lastIp) === network;
    });
    if (seen || !shouldEmitSecurityRuleEvent("new_network_login_warning", `${userId}:${network}`)) {
      return;
    }
    emitSecurityEvent({
      req,
      type: "new_network_login_warning",
      severity: securityEventSeverity.WARNING,
      riskScore: 55,
      actorUserId: userId,
      targetUserId: userId,
      data: { network, lookbackDays: 30 },
    });
  };

  const maybeEmitExcessiveSessionsEvent = ({ req, userId } = {}) => {
    const activeCount = listActiveSessionsForUser(userId).length;
    if (
      activeCount <= excessiveSessionsWarning ||
      !shouldEmitSecurityRuleEvent("excessive_sessions_warning", userId)
    ) {
      return;
    }
    emitSecurityEvent({
      req,
      type: "excessive_sessions_warning",
      severity: securityEventSeverity.WARNING,
      riskScore: 45,
      actorUserId: userId,
      targetUserId: userId,
      data: {
        activeSessions: activeCount,
        threshold: excessiveSessionsWarning,
      },
    });
  };

  const handleAuthFailureSecuritySignals = ({ req, error = "login_failed" } = {}) => {
    const ip = getRequestIp(req);
    if (!ip) {
      return;
    }
    const warningWindowCount = authFailedByIpCounter.record({
      key: ip,
      windowMs: authFailedBurstWarning.windowMs,
    }).count;
    const criticalWindowCount = authFailedByIpCounter.count({
      key: ip,
      windowMs: authFailedBurstCritical.windowMs,
    });

    if (
      criticalWindowCount >= authFailedBurstCritical.threshold &&
      shouldEmitSecurityRuleEvent("auth_failed_burst_ip_critical", ip)
    ) {
      emitSecurityEvent({
        req,
        type: "auth_failed_burst_ip_critical",
        severity: securityEventSeverity.CRITICAL,
        riskScore: 90,
        data: {
          ip,
          attempts: criticalWindowCount,
          windowMs: authFailedBurstCritical.windowMs,
          error: String(error || "login_failed"),
        },
      });
      return;
    }

    if (
      warningWindowCount >= authFailedBurstWarning.threshold &&
      shouldEmitSecurityRuleEvent("auth_failed_burst_ip_warning", ip)
    ) {
      emitSecurityEvent({
        req,
        type: "auth_failed_burst_ip_warning",
        severity: securityEventSeverity.WARNING,
        riskScore: 65,
        data: {
          ip,
          attempts: warningWindowCount,
          windowMs: authFailedBurstWarning.windowMs,
          error: String(error || "login_failed"),
        },
      });
    }
  };

  const handleMfaFailureSecuritySignals = ({ req, userId, error = "mfa_invalid_code" } = {}) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      return;
    }
    metricsRegistry.inc("auth_mfa_verify_total", { status: "failed" });
    const count = mfaFailedByUserCounter.record({
      key: normalizedUserId,
      windowMs: mfaFailedBurstWarning.windowMs,
    }).count;
    if (
      count >= mfaFailedBurstWarning.threshold &&
      shouldEmitSecurityRuleEvent("mfa_failed_burst_user_warning", normalizedUserId)
    ) {
      emitSecurityEvent({
        req,
        type: "mfa_failed_burst_user_warning",
        severity: securityEventSeverity.WARNING,
        riskScore: 70,
        actorUserId: normalizedUserId,
        targetUserId: normalizedUserId,
        data: {
          userId: normalizedUserId,
          attempts: count,
          windowMs: mfaFailedBurstWarning.windowMs,
          error: String(error || "mfa_invalid_code"),
        },
      });
    }
  };

  return {
    buildMySecuritySummary,
    clearEnrollmentFromSession,
    clearPendingMfaEnrollmentFromSession,
    clearPendingMfaEnrollmentRedirectTarget,
    completeRequiredMfaEnrollmentForSession,
    getPendingMfaEnrollmentRedirectTarget,
    getPendingMfaEnrollmentState,
    getPendingMfaEnrollmentUserId,
    handleAuthFailureSecuritySignals,
    handleMfaFailureSecuritySignals,
    isPendingMfaEnrollmentRequiredForUser,
    markMfaEnrollmentRequiredForSession,
    maybeEmitExcessiveSessionsEvent,
    maybeEmitNewNetworkLoginEvent,
    promotePendingMfaEnrollmentToAuthenticatedSession,
    resolveEnrollmentFromSession,
    resolveMfaMetadata,
    resolvePendingMfaEnrollmentUser,
    resolveRecoveryCodesRemaining,
    shouldRequireTotpEnrollmentForPasswordLogin,
    startTotpEnrollment,
    updateSessionIndexFromRequest,
    verifyTotpOrRecoveryCode,
  };
};

export default createAuthSecurityRuntime;
