import crypto from "crypto";
import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const registerAuthRoutes = ({
  app,
  appendAuditLog,
  buildAuthRedirectUrl,
  canAttemptAuth,
  canVerifyMfa,
  createDiscordAvatarUrl,
  discordApi,
  discordClientId,
  discordClientSecret,
  ensureOwnerUser,
  establishAuthenticatedSession,
  findUserIdentityRecord,
  findUserIdentityRecordsByEmail,
  getRequestIp,
  googleClientId,
  googleClientSecret,
  googleScopes,
  googleTokenApi,
  googleUserinfoApi,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  isAllowedOrigin,
  isTotpEnabledForUser,
  loadAllowedUsers,
  loadOwnerIds,
  loadUserIdentityRecords,
  loadUsers,
  metricsRegistry,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  primaryAppOrigin,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri,
  resolveGoogleRedirectUri,
  revokeSessionBySid,
  revokeUserSessionIndexRecord,
  saveSessionState,
  scopes,
  sessionCookieConfig,
  sessionIndexTouchTsBySid,
  syncPersistedDiscordAvatarForLogin,
  updateSessionIndexFromRequest,
  upsertUserIdentityRecord,
  verifyTotpOrRecoveryCode,
  writeAllowedUsers,
  writeOwnerIds,
  writeUserIdentityRecords,
  writeUsers,
}) => {
  const router = Router();

  const resolveLoginAppOrigin = (req) =>
    resolveAuthAppOrigin({
      req,
      sessionOrigin: req.session?.loginAppOrigin,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });

  const resolveStoredUsers = () => (Array.isArray(loadUsers?.()) ? loadUsers() : []);
  const resolveAllowedUsersList = () =>
    Array.isArray(loadAllowedUsers?.()) ? loadAllowedUsers().map((entry) => String(entry || "").trim()) : [];
  const resolveOwnerIdsList = () =>
    Array.isArray(loadOwnerIds?.()) ? loadOwnerIds().map((entry) => String(entry || "").trim()) : [];

  const getUserPrivilegeVector = (user) => {
    const userId = String(user?.id || "").trim();
    const ownerIds = resolveOwnerIdsList();
    const identityCount = Array.isArray(loadUserIdentityRecords?.({ userId }))
      ? loadUserIdentityRecords({ userId }).filter((entry) => !entry?.disabledAt).length
      : 0;
    return {
      userId,
      isPrimaryOwner: Boolean(userId && ownerIds[0] === userId),
      isSecondaryOwner: Boolean(userId && ownerIds.includes(userId) && ownerIds[0] !== userId),
      isAdmin: String(user?.accessRole || "").trim().toLowerCase() === "admin",
      hasTotp: typeof isTotpEnabledForUser === "function" ? isTotpEnabledForUser(userId) : false,
      identityCount,
      createdAtTs: Number.isFinite(new Date(user?.createdAt || 0).getTime())
        ? new Date(user?.createdAt || 0).getTime()
        : Number.MAX_SAFE_INTEGER,
    };
  };

  const comparePrivilegeVectors = (left, right) => {
    const fields = [
      [left.isPrimaryOwner, right.isPrimaryOwner],
      [left.isSecondaryOwner, right.isSecondaryOwner],
      [left.isAdmin, right.isAdmin],
      [left.hasTotp, right.hasTotp],
    ];
    for (const [leftValue, rightValue] of fields) {
      if (leftValue === rightValue) {
        continue;
      }
      return leftValue ? -1 : 1;
    }
    if (left.identityCount !== right.identityCount) {
      return right.identityCount - left.identityCount;
    }
    if (left.createdAtTs !== right.createdAtTs) {
      return left.createdAtTs - right.createdAtTs;
    }
    return String(left.userId).localeCompare(String(right.userId));
  };

  const buildIdentityRecord = ({
    existingRecord = null,
    userId,
    provider,
    providerSubject,
    emailNormalized = null,
    emailVerified = null,
    displayName = null,
    avatarUrl = null,
    data = {},
  } = {}) => ({
    id: existingRecord?.id || `${provider}:${providerSubject}`,
    userId,
    provider,
    providerSubject,
    emailNormalized: emailNormalized || existingRecord?.emailNormalized || null,
    emailVerified:
      typeof emailVerified === "boolean" ? emailVerified : existingRecord?.emailVerified ?? null,
    displayName: displayName || existingRecord?.displayName || null,
    avatarUrl: avatarUrl || existingRecord?.avatarUrl || null,
    linkedAt: existingRecord?.linkedAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    disabledAt: existingRecord?.disabledAt || null,
    data: {
      ...((existingRecord?.data && typeof existingRecord.data === "object")
        ? existingRecord.data
        : {}),
      ...((data && typeof data === "object") ? data : {}),
    },
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const normalizeComparableEmail = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const resolvePreprovisionedUserForEmail = (emailNormalized) => {
    const normalizedEmail = normalizeComparableEmail(emailNormalized);
    if (!normalizedEmail) {
      return { blockedReason: "preprovision_required", userId: null };
    }
    const users = resolveStoredUsers();
    const matches = users.filter((entry) => normalizeComparableEmail(entry?.email) === normalizedEmail);
    if (!matches.length) {
      return { blockedReason: "preprovision_required", userId: null };
    }
    if (matches.length > 1) {
      return { blockedReason: "ambiguous_candidate", userId: null };
    }
    const userId = String(matches[0]?.id || "").trim();
    if (!userId) {
      return { blockedReason: "preprovision_required", userId: null };
    }
    const allowedUsers = resolveAllowedUsersList();
    if (allowedUsers.length && !allowedUsers.includes(userId)) {
      return { blockedReason: "preprovision_required", userId: null };
    }
    return { blockedReason: null, userId };
  };

  const resolveCanonicalUserForVerifiedEmail = ({ emailNormalized, provider }) => {
    const normalizedEmail = String(emailNormalized || "").trim().toLowerCase();
    const normalizedProvider = String(provider || "").trim();
    if (!normalizedEmail || !normalizedProvider) {
      return { blockedReason: "no_candidate", canonicalUserId: null, absorbedUserIds: [] };
    }
    const preprovisioned = resolvePreprovisionedUserForEmail(normalizedEmail);
    if (!preprovisioned.userId) {
      return {
        blockedReason: preprovisioned.blockedReason || "preprovision_required",
        canonicalUserId: null,
        absorbedUserIds: [],
      };
    }
    const identityMatches = Array.isArray(findUserIdentityRecordsByEmail?.(normalizedEmail, { includeDisabled: false }))
      ? findUserIdentityRecordsByEmail(normalizedEmail, { includeDisabled: false })
      : [];
    const conflictingSameProvider = identityMatches.filter(
      (entry) => String(entry?.provider || "").trim() === normalizedProvider,
    );
    if (conflictingSameProvider.length > 0) {
      return { blockedReason: "same_provider_conflict", canonicalUserId: null, absorbedUserIds: [] };
    }
    const candidateUserIds = new Set(
      identityMatches.map((entry) => String(entry?.userId || "").trim()).filter(Boolean),
    );
    const candidateIds = [...candidateUserIds];
    if (!candidateIds.length) {
      return {
        blockedReason: null,
        canonicalUserId: preprovisioned.userId,
        absorbedUserIds: [],
      };
    }
    if (!candidateIds.includes(preprovisioned.userId)) {
      return { blockedReason: "ambiguous_candidate", canonicalUserId: null, absorbedUserIds: [] };
    }
    const users = resolveStoredUsers();
    const candidates = candidateIds
      .map((userId) => users.find((entry) => String(entry?.id || "") === userId) || { id: userId })
      .map((user) => ({ user, vector: getUserPrivilegeVector(user) }))
      .sort((left, right) => comparePrivilegeVectors(left.vector, right.vector));
    if (!candidates.length) {
      return { blockedReason: "no_candidate", canonicalUserId: null, absorbedUserIds: [] };
    }
    if (candidates.some(({ user }) => normalizeComparableEmail(user?.email) !== normalizedEmail)) {
      return { blockedReason: "ambiguous_candidate", canonicalUserId: null, absorbedUserIds: [] };
    }
    const canonicalUserId = preprovisioned.userId;
    return {
      blockedReason: null,
      canonicalUserId,
      absorbedUserIds: candidateIds.filter((userId) => userId !== canonicalUserId),
    };
  };

  const buildAuthenticatedUserFromStoredUser = ({
    storedUser,
    email,
    avatarUrl,
    preferredName,
    preferredUsername,
  }) => ({
    id: String(storedUser?.id || ""),
    name: String(preferredName || storedUser?.name || storedUser?.username || storedUser?.id || ""),
    username: String(
      preferredUsername || storedUser?.username || storedUser?.name || storedUser?.id || "",
    ),
    email: email || storedUser?.email || null,
    avatarUrl: avatarUrl || storedUser?.avatarUrl || null,
  });

  const loadStoredUserById = (userId) =>
    resolveStoredUsers().find((entry) => String(entry?.id || "") === String(userId || "")) || null;

  const buildMergeAwareAuthenticatedUser = ({
    userId,
    email,
    avatarUrl,
    preferredName,
    preferredUsername,
  }) => {
    const storedUser = loadStoredUserById(userId);
    if (!storedUser?.id) {
      return null;
    }
    return buildAuthenticatedUserFromStoredUser({
      storedUser,
      email,
      avatarUrl,
      preferredName,
      preferredUsername,
    });
  };

  const clearOAuthSessionState = (req) => {
    if (!req.session) {
      return;
    }
    req.session.oauthState = null;
    req.session.googleOauthState = null;
    req.session.discordRedirectUri = null;
    req.session.googleRedirectUri = null;
    req.session.oauthIntent = null;
  };

  const clearLinkIntentState = (req) => {
    if (!req.session) {
      return;
    }
    req.session.oauthIntent = null;
    req.session.oauthLinkedProvider = null;
    req.session.oauthLinkError = null;
  };

  const markLinkSuccessInSession = (req, provider) => {
    if (!req.session) {
      return;
    }
    req.session.oauthLinkedProvider = String(provider || "").trim();
    req.session.oauthLinkError = null;
  };

  const markLinkErrorInSession = (req, error) => {
    if (!req.session) {
      return;
    }
    req.session.oauthLinkError = String(error || "").trim() || null;
  };

  const consumeLinkIntent = (req) =>
    String(req.session?.oauthIntent || "").trim().toLowerCase() || "login";

  const buildLinkedDashboardRedirect = ({ req, loginAppOrigin }) =>
    buildAuthRedirectUrl({
      appOrigin: loginAppOrigin,
      path: "/dashboard/usuarios",
      searchParams: {
        edit: "me",
        linked: String(req.session?.oauthLinkedProvider || "").trim() || undefined,
        error: String(req.session?.oauthLinkError || "").trim() || undefined,
      },
    });

  const mergeUsersIntoCanonical = async ({ canonicalUserId, absorbedUserIds } = {}) => {
    const normalizedCanonicalUserId = String(canonicalUserId || "").trim();
    const normalizedAbsorbedUserIds = Array.isArray(absorbedUserIds)
      ? absorbedUserIds.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    if (!normalizedCanonicalUserId || !normalizedAbsorbedUserIds.length) {
      return { ok: true, absorbedUserIds: [] };
    }
    const allIdentityRecords = Array.isArray(loadUserIdentityRecords?.({ includeDisabled: true }))
      ? loadUserIdentityRecords({ includeDisabled: true })
      : [];
    const identitiesToMerge = allIdentityRecords.filter((entry) =>
      normalizedAbsorbedUserIds.includes(String(entry?.userId || "")),
    );
    const canonicalIdentityRecords = allIdentityRecords.filter(
      (entry) => String(entry?.userId || "") === normalizedCanonicalUserId,
    );
    for (const identity of identitiesToMerge) {
      const conflictingProvider = canonicalIdentityRecords.find(
        (entry) =>
          String(entry?.provider || "") === String(identity?.provider || "") &&
          String(entry?.providerSubject || "") !== String(identity?.providerSubject || ""),
      );
      if (conflictingProvider) {
        return { ok: false, reason: "identity_provider_conflict" };
      }
    }
    const nextIdentityRecords = [];
    const seenIdentityKeys = new Set();
    allIdentityRecords.forEach((entry) => {
      const userId = normalizedAbsorbedUserIds.includes(String(entry?.userId || ""))
        ? normalizedCanonicalUserId
        : String(entry?.userId || "");
      const provider = String(entry?.provider || "");
      const providerSubject = String(entry?.providerSubject || "");
      const dedupeKey = `${userId}:${provider}:${providerSubject}`;
      if (seenIdentityKeys.has(dedupeKey)) {
        return;
      }
      seenIdentityKeys.add(dedupeKey);
      nextIdentityRecords.push({
        ...entry,
        userId,
        updatedAt: new Date().toISOString(),
      });
    });
    if (typeof writeUserIdentityRecords === "function") {
      writeUserIdentityRecords(nextIdentityRecords);
    }
    const users = resolveStoredUsers();
    const nextUsers = users
      .filter((entry) => !normalizedAbsorbedUserIds.includes(String(entry?.id || "")))
      .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))
      .map((entry, index) => ({ ...entry, order: index }));
    writeUsers?.(nextUsers);
    const currentAllowedUsers = resolveAllowedUsersList();
    const nextAllowedUsers = Array.from(
      new Set(
        currentAllowedUsers
          .filter((entry) => !normalizedAbsorbedUserIds.includes(String(entry || "")))
          .concat(normalizedCanonicalUserId),
      ),
    );
    writeAllowedUsers?.(nextAllowedUsers);
    const currentOwnerIds = resolveOwnerIdsList();
    const nextOwnerIds = currentOwnerIds.filter(
      (entry) => !normalizedAbsorbedUserIds.includes(String(entry || "")),
    );
    writeOwnerIds?.(nextOwnerIds);
    const absorbedSessionRecords = Array.isArray(loadUserSessionIndexRecords?.({ includeRevoked: false }))
      ? loadUserSessionIndexRecords({ includeRevoked: false }).filter((entry) =>
          normalizedAbsorbedUserIds.includes(String(entry?.userId || "")),
        )
      : [];
    await Promise.all(
      absorbedSessionRecords.map((entry) =>
        revokeSessionBySid?.({
          sid: entry.sid,
          revokedBy: normalizedCanonicalUserId,
          revokeReason: "account_merge",
        }),
      ),
    );
    return { ok: true, absorbedUserIds: normalizedAbsorbedUserIds };
  };

  const finalizeProviderLinkOrMerge = async ({
    req,
    provider,
    providerSubject,
    emailNormalized,
    emailVerified,
    displayName,
    avatarUrl,
    data,
  }) => {
    const intent = consumeLinkIntent(req);
    const currentSessionUserId = String(req.session?.user?.id || "").trim();
    const existingIdentity =
      typeof findUserIdentityRecord === "function"
        ? findUserIdentityRecord(provider, providerSubject)
        : null;
    if (intent === "link") {
      if (!currentSessionUserId) {
        return { error: "link_requires_authenticated_session", userId: null, absorbedUserIds: [] };
      }
      if (existingIdentity?.userId && String(existingIdentity.userId) !== currentSessionUserId) {
        markLinkErrorInSession(req, "identity_already_linked");
        return { error: "identity_already_linked", userId: null, absorbedUserIds: [] };
      }
      upsertUserIdentityRecord?.(
        buildIdentityRecord({
          existingRecord: existingIdentity,
          userId: currentSessionUserId,
          provider,
          providerSubject,
          emailNormalized,
          emailVerified,
          displayName,
          avatarUrl,
          data,
        }),
      );
      return { error: null, userId: currentSessionUserId, absorbedUserIds: [], matchedBy: "manual_link" };
    }
    if (existingIdentity?.userId && !existingIdentity.disabledAt) {
      upsertUserIdentityRecord?.(
        buildIdentityRecord({
          existingRecord: existingIdentity,
          userId: existingIdentity.userId,
          provider,
          providerSubject,
          emailNormalized,
          emailVerified,
          displayName,
          avatarUrl,
          data,
        }),
      );
      return { error: null, userId: String(existingIdentity.userId), absorbedUserIds: [] };
    }
    if (emailVerified !== true || !emailNormalized) {
      return { error: "email_not_verified", userId: null, absorbedUserIds: [] };
    }
    const resolved = resolveCanonicalUserForVerifiedEmail({ emailNormalized, provider });
    if (!resolved.canonicalUserId) {
      return {
        error: resolved.blockedReason || "preprovision_required",
        userId: null,
        absorbedUserIds: [],
      };
    }
    const mergeResult = await mergeUsersIntoCanonical({
      canonicalUserId: resolved.canonicalUserId,
      absorbedUserIds: resolved.absorbedUserIds,
    });
    if (!mergeResult.ok) {
      return { error: mergeResult.reason || "merge_failed", userId: null, absorbedUserIds: [] };
    }
    upsertUserIdentityRecord?.(
      buildIdentityRecord({
        existingRecord: existingIdentity,
        userId: resolved.canonicalUserId,
        provider,
        providerSubject,
        emailNormalized,
        emailVerified,
        displayName,
        avatarUrl,
        data,
      }),
    );
    return {
      error: null,
      userId: resolved.canonicalUserId,
      absorbedUserIds: resolved.absorbedUserIds,
      matchedBy: "verified_email",
    };
  };

  const safeDestroySession = (req) => {
    if (req.session) {
      req.session.destroy(() => undefined);
    }
  };

  const createCodeQlVisibleRateLimitKey = (req) => {
    const ip = getRequestIp(req);
    return ip ? ipKeyGenerator(ip) : "anonymous";
  };

  const codeQlVisibleAuthAttemptRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: createCodeQlVisibleRateLimitKey,
    handler: (req, res) => {
      const loginAppOrigin = resolveLoginAppOrigin(req);
      metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.login.rate_limited", "auth", {});
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "rate_limited" },
        }),
      );
    },
  });

  const codeQlVisibleDiscordAuthRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: createCodeQlVisibleRateLimitKey,
    handler: (req, res) => {
      metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.discord.rate_limited", "auth", {});
      return res.status(429).json({ error: "rate_limited" });
    },
  });

  const codeQlVisiblePendingMfaVerifyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: createCodeQlVisibleRateLimitKey,
    handler: (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      metricsRegistry.inc("auth_mfa_verify_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.mfa.rate_limited", "auth", {
        userId: null,
        action: "verify",
      });
      return res.status(429).json({ error: "rate_limited" });
    },
  });

  const enforceDiscordAuthAttemptRateLimit = async (req, res, next) => {
    const ip = getRequestIp(req);
    if (!(await canAttemptAuth(ip))) {
      metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.discord.rate_limited", "auth", {});
      return res.status(429).json({ error: "rate_limited" });
    }
    return next();
  };

  const requireOAuthCallbackParams = (req, _res, next) => {
    const hasOAuthCallbackParams = Boolean(
      (typeof req.query?.code === "string" && req.query.code.trim()) ||
        (typeof req.query?.state === "string" && req.query.state.trim()),
    );
    if (!hasOAuthCallbackParams) {
      return next("route");
    }
    return next();
  };

  const enforceLoginCallbackAuthAttemptRateLimit = async (req, res, next) => {
    const ip = getRequestIp(req);
    if (!(await canAttemptAuth(ip))) {
      const loginAppOrigin = resolveLoginAppOrigin(req);
      metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.login.rate_limited", "auth", {});
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "rate_limited" },
        }),
      );
    }
    return next();
  };

  const enforcePendingMfaVerifyRateLimit = async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const pendingUser = res.locals.pendingMfaUser || null;
    const ip = getRequestIp(req);
    if (!(await canVerifyMfa(ip))) {
      metricsRegistry.inc("auth_mfa_verify_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.mfa.rate_limited", "auth", {
        userId: pendingUser?.id || null,
        action: "verify",
      });
      return res.status(429).json({ error: "rate_limited" });
    }
    return next();
  };

  const attachPendingMfaUser = (req, res, next) => {
    const pendingUser = req.session?.pendingMfaUser || null;
    if (pendingUser?.id) {
      res.locals.pendingMfaUser = pendingUser;
      return next();
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({ error: "mfa_not_pending" });
  };

  const finalizeAuthenticatedLogin = async ({
    req,
    res,
    user,
    loginAppOrigin,
    nextPath,
    mfaAuditAction = "auth.login.mfa_required",
    successAuditAction = "auth.login.success",
    responseMode = "redirect",
  }) => {
    const requiresMfa = isTotpEnabledForUser(user.id);

    if (requiresMfa && req.session) {
      req.session.pendingMfaUser = user;
      req.session.user = null;
      req.session.mfaVerifiedAt = null;
      try {
        await saveSessionState(req);
      } catch {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "session_persist_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "session_persist_failed" });
        return false;
      }
      updateSessionIndexFromRequest(req, { force: true });
      appendAuditLog(req, mfaAuditAction, "auth", { userId: user.id });
      metricsRegistry.inc("auth_login_total", { status: "mfa_required" });
      const redirect = buildAuthRedirectUrl({
        appOrigin: loginAppOrigin,
        path: "/login",
        searchParams: {
          mfa: "required",
          next: nextPath || undefined,
        },
      });
      if (responseMode === "json") {
        res.status(200).json({ ok: true, mfaRequired: true, redirect });
        return true;
      }
      res.redirect(redirect);
      return true;
    }


    if (req.session) {
      req.session.loginNext = null;
      req.session.loginAppOrigin = null;
      req.session.mfaVerifiedAt = new Date().toISOString();
    }
    try {
      await saveSessionState(req);
    } catch {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "session_persist_failed" });
      appendAuditLog(req, "auth.login.failed", "auth", { error: "session_persist_failed" });
      return false;
    }
    updateSessionIndexFromRequest(req, { force: true });
    maybeEmitNewNetworkLoginEvent({ req, userId: user.id });
    maybeEmitExcessiveSessionsEvent({ req, userId: user.id });
    appendAuditLog(req, successAuditAction, "auth", { userId: user.id });
    metricsRegistry.inc("auth_login_total", { status: "success" });
    const redirect = buildAuthRedirectUrl({
      appOrigin: loginAppOrigin,
      path: nextPath || "/dashboard",
    });
    if (responseMode === "json") {
      res.status(200).json({ ok: true, redirect });
      return true;
    }
    res.redirect(redirect);
    return true;
  };

  const handleDiscordAuthStart = async (req, res) => {
    const loginAppOrigin = resolveAuthAppOrigin({
      req,
      sessionOrigin: null,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });

    const state = crypto.randomBytes(16).toString("hex");
    const loginNext =
      typeof req.query.next === "string" && req.query.next.trim() ? req.query.next : null;
    const oauthIntent =
      typeof req.query.intent === "string" && req.query.intent.trim() ? req.query.intent.trim() : "login";
    const redirectUri = resolveDiscordRedirectUri(req);
    if (req.session) {
      req.session.oauthState = state;
      req.session.loginNext = loginNext;
      req.session.discordRedirectUri = redirectUri;
      req.session.loginAppOrigin = loginAppOrigin;
      req.session.oauthIntent = oauthIntent;
    }
    try {
      await saveSessionState(req);
    } catch {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      appendAuditLog(req, "auth.login.failed", "auth", { error: "session_persist_failed" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "server_error" },
        }),
      );
    }

    const params = new URLSearchParams({
      client_id: discordClientId || "",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      prompt: "consent",
    });

    return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  };

  const handleGoogleAuthStart = async (req, res) => {
    const loginAppOrigin = resolveAuthAppOrigin({
      req,
      sessionOrigin: null,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });

    const state = crypto.randomBytes(16).toString("hex");
    const loginNext =
      typeof req.query.next === "string" && req.query.next.trim() ? req.query.next : null;
    const oauthIntent =
      typeof req.query.intent === "string" && req.query.intent.trim() ? req.query.intent.trim() : "login";
    const redirectUri = resolveGoogleRedirectUri(req);
    if (req.session) {
      req.session.googleOauthState = state;
      req.session.loginNext = loginNext;
      req.session.googleRedirectUri = redirectUri;
      req.session.loginAppOrigin = loginAppOrigin;
      req.session.oauthIntent = oauthIntent;
    }
    try {
      await saveSessionState(req);
    } catch {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      appendAuditLog(req, "auth.google.failed", "auth", { error: "session_persist_failed" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "server_error" },
        }),
      );
    }

    const params = new URLSearchParams({
      client_id: googleClientId || "",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: Array.isArray(googleScopes) ? googleScopes.join(" ") : "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  };

  const prepareLoginCallbackContext = (req, res, next) => {
    const loginAppOrigin = resolveLoginAppOrigin(req);
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "missing_code" });
      appendAuditLog(req, "auth.login.failed", "auth", { error: "missing_code" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "missing_code" },
        }),
      );
    }

    if (!state || typeof state !== "string" || state !== req.session?.oauthState) {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "state_mismatch" });
      appendAuditLog(req, "auth.login.failed", "auth", { error: "state_mismatch" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "state_mismatch" },
        }),
      );
    }

    if (req.session) {
      req.session.oauthState = null;
    }
    res.locals.oauthLoginCallback = {
      code,
      loginAppOrigin,
    };
    return next();
  };

  const handleLoginOAuthCallback = async (req, res) => {
    const { code, loginAppOrigin } = res.locals.oauthLoginCallback || {};
    try {
      const redirectToLoginServerError = () =>
        res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "server_error" },
          }),
        );
      const redirectUri = req.session?.discordRedirectUri || resolveDiscordRedirectUri(req);
      if (req.session) {
        req.session.discordRedirectUri = null;
      }

      const tokenResponse = await fetch(`${discordApi}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: discordClientId || "",
          client_secret: discordClientSecret || "",
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          scope: scopes.join(" "),
        }),
      });

      if (!tokenResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        let discordErrorText = "unknown";
        try {
          discordErrorText = await tokenResponse.text();
        } catch {}
        appendAuditLog(req, "auth.login.failed", "auth", {
          error: "token_exchange_failed",
          discordError: discordErrorText,
          redirectUri: redirectUri,
        });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "token_exchange_failed" },
          }),
        );
      }

      const tokenData = await tokenResponse.json();

      const userResponse = await fetch(`${discordApi}/users/@me`, {
        headers: {
          authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "user_fetch_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "user_fetch_failed" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "user_fetch_failed" },
          }),
        );
      }

      const discordUser = await userResponse.json();
      const discordSubject = String(discordUser?.id || "").trim();
      const discordEmail = String(discordUser?.email || "").trim().toLowerCase();
      const discordEmailVerified = discordUser?.verified === true;
      const discordAvatarUrl = createDiscordAvatarUrl(discordUser);
      const resolvedIdentity = await finalizeProviderLinkOrMerge({
        req,
        provider: "discord",
        providerSubject: discordSubject,
        emailNormalized: discordEmail || null,
        emailVerified: discordEmailVerified,
        displayName: discordUser?.global_name
          ? String(discordUser.global_name)
          : discordUser?.username
            ? String(discordUser.username)
            : null,
        avatarUrl: discordAvatarUrl || null,
        data: {
          email: discordEmail || null,
          username: discordUser?.username ? String(discordUser.username) : null,
          globalName: discordUser?.global_name ? String(discordUser.global_name) : null,
        },
      });

      if (resolvedIdentity.error || !resolvedIdentity.userId) {
        safeDestroySession(req);
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: resolvedIdentity.error || "unauthorized" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: resolvedIdentity.error || "unauthorized" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }

      const allowedUsers = resolveAllowedUsersList();
      if (allowedUsers.length && !allowedUsers.includes(String(resolvedIdentity.userId))) {
        safeDestroySession(req);
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "unauthorized" });
        appendAuditLog(req, "auth.login.failed", "auth", {
          userId: String(resolvedIdentity.userId),
          error: "unauthorized",
        });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }

      const nextPath = String(req.session?.loginNext || "").trim();
      const authenticatedUser = buildMergeAwareAuthenticatedUser({
        userId: resolvedIdentity.userId,
        email: discordEmail || null,
        avatarUrl: discordAvatarUrl || null,
        preferredName: discordUser?.global_name || discordUser?.username || null,
        preferredUsername: discordUser?.username || null,
      });
      if (!authenticatedUser?.id) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "user_not_found" });
        appendAuditLog(req, "auth.login.failed", "auth", {
          userId: String(resolvedIdentity.userId),
          error: "user_not_found",
        });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }
      syncPersistedDiscordAvatarForLogin({
        userId: authenticatedUser.id,
        discordAvatarUrl: authenticatedUser.avatarUrl,
      });
      ensureOwnerUser(authenticatedUser);

      if (consumeLinkIntent(req) === "link") {
        markLinkSuccessInSession(req, "discord");
        clearOAuthSessionState(req);
        clearLinkIntentState(req);
        try {
          await saveSessionState(req);
        } catch {
          return redirectToLoginServerError();
        }
        return res.redirect(buildLinkedDashboardRedirect({ req, loginAppOrigin }));
      }

      try {
        await establishAuthenticatedSession({
          req,
          user: authenticatedUser,
          preserved: {
            loginAppOrigin,
            loginNext: nextPath || null,
          },
        });
      } catch {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "session_regenerate_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "session_regenerate_failed" });
        return redirectToLoginServerError();
      }
      clearOAuthSessionState(req);
      await revokeMergedUserSessions({
        absorbedUserIds: resolvedIdentity.absorbedUserIds,
        actorUserId: authenticatedUser.id,
      });

      const finalized = await finalizeAuthenticatedLogin({
        req,
        res,
        user: authenticatedUser,
        loginAppOrigin,
        nextPath,
      });
      if (!finalized) {
        return redirectToLoginServerError();
      }
      return;
    } catch {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "server_error" });
      appendAuditLog(req, "auth.login.failed", "auth", { error: "server_error" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "server_error" },
        }),
      );
    }
  };

  const handleGoogleAuthCallback = async (req, res) => {
    const loginAppOrigin = resolveLoginAppOrigin(req);
    const code = typeof req.query?.code === "string" ? req.query.code : "";
    const state = typeof req.query?.state === "string" ? req.query.state : "";

    if (!code) {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "missing_code" });
      appendAuditLog(req, "auth.google.failed", "auth", { error: "missing_code" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "missing_code" },
        }),
      );
    }

    if (!state || state !== req.session?.googleOauthState) {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "state_mismatch" });
      appendAuditLog(req, "auth.google.failed", "auth", { error: "state_mismatch" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "state_mismatch" },
        }),
      );
    }

    const redirectUri = req.session?.googleRedirectUri || resolveGoogleRedirectUri(req);
    if (req.session) {
      req.session.googleOauthState = null;
      req.session.googleRedirectUri = null;
    }

    try {
      const tokenResponse = await fetch(String(googleTokenApi || "https://oauth2.googleapis.com/token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: googleClientId || "",
          client_secret: googleClientSecret || "",
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        appendAuditLog(req, "auth.google.failed", "auth", { error: "token_exchange_failed" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "token_exchange_failed" },
          }),
        );
      }

      const tokenData = await tokenResponse.json();
      const userResponse = await fetch(
        String(googleUserinfoApi || "https://openidconnect.googleapis.com/v1/userinfo"),
        {
          headers: {
            authorization: `Bearer ${String(tokenData?.access_token || "")}`,
          },
        },
      );

      if (!userResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "user_fetch_failed" });
        appendAuditLog(req, "auth.google.failed", "auth", { error: "user_fetch_failed" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "user_fetch_failed" },
          }),
        );
      }

      const googleUser = await userResponse.json();
      const googleSubject = String(googleUser?.sub || "").trim();
      const googleEmail = String(googleUser?.email || "").trim().toLowerCase();
      const googleEmailVerified = googleUser?.email_verified === true;
      const googleAvatarUrl = googleUser?.picture ? String(googleUser.picture) : null;

      const resolvedIdentity = await finalizeProviderLinkOrMerge({
        req,
        provider: "google",
        providerSubject: googleSubject,
        emailNormalized: googleEmail || null,
        emailVerified: googleEmailVerified,
        displayName: googleUser?.name ? String(googleUser.name) : null,
        avatarUrl: googleAvatarUrl,
        data: {
          email: googleEmail || null,
          picture: googleAvatarUrl,
        },
      });

      if (resolvedIdentity.error || !resolvedIdentity.userId) {
        safeDestroySession(req);
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: resolvedIdentity.error || "unauthorized" });
        appendAuditLog(req, "auth.google.failed", "auth", { error: resolvedIdentity.error || "unauthorized" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }

      const allowedUsers = resolveAllowedUsersList();
      if (allowedUsers.length && !allowedUsers.includes(String(resolvedIdentity.userId))) {
        safeDestroySession(req);
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "unauthorized" });
        appendAuditLog(req, "auth.google.failed", "auth", {
          userId: String(resolvedIdentity.userId),
          error: "unauthorized",
        });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }

      const nextPath = String(req.session?.loginNext || "").trim();
      const authenticatedUser = buildMergeAwareAuthenticatedUser({
        userId: resolvedIdentity.userId,
        email: googleEmail || null,
        avatarUrl: googleAvatarUrl,
        preferredName: googleUser?.name || null,
        preferredUsername: null,
      });
      if (!authenticatedUser?.id) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "user_not_found" });
        appendAuditLog(req, "auth.google.failed", "auth", {
          userId: String(resolvedIdentity.userId),
          error: "user_not_found",
        });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: resolvedIdentity.error || "unauthorized" },
          }),
        );
      }

      if (consumeLinkIntent(req) === "link") {
        markLinkSuccessInSession(req, "google");
        clearOAuthSessionState(req);
        clearLinkIntentState(req);
        try {
          await saveSessionState(req);
        } catch {
          return res.redirect(
            buildAuthRedirectUrl({
              appOrigin: loginAppOrigin,
              path: "/login",
              searchParams: { error: "server_error" },
            }),
          );
        }
        return res.redirect(buildLinkedDashboardRedirect({ req, loginAppOrigin }));
      }

      ensureOwnerUser(authenticatedUser);
      await establishAuthenticatedSession({
        req,
        user: authenticatedUser,
        preserved: {
          loginAppOrigin,
          loginNext: nextPath || null,
        },
      });
      clearOAuthSessionState(req);
      await revokeMergedUserSessions({
        absorbedUserIds: resolvedIdentity.absorbedUserIds,
        actorUserId: authenticatedUser.id,
      });

      const finalized = await finalizeAuthenticatedLogin({
        req,
        res,
        user: authenticatedUser,
        loginAppOrigin,
        nextPath,
        mfaAuditAction: "auth.google.mfa_required",
        successAuditAction: "auth.google.success",
      });
      if (!finalized) {
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "server_error" },
          }),
        );
      }
      return undefined;
    } catch {
      metricsRegistry.inc("auth_login_total", { status: "failed" });
      handleAuthFailureSecuritySignals({ req, error: "server_error" });
      appendAuditLog(req, "auth.google.failed", "auth", { error: "server_error" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: "/login",
          searchParams: { error: "server_error" },
        }),
      );
    }
  };

  const handlePendingMfaVerification = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const pendingUser = res.locals.pendingMfaUser;

    const codeOrRecoveryCode = String(req.body?.codeOrRecoveryCode || req.body?.code || "").trim();
    if (!codeOrRecoveryCode) {
      return res.status(400).json({ error: "code_required" });
    }

    const verification = verifyTotpOrRecoveryCode({
      userId: pendingUser.id,
      codeOrRecoveryCode,
      consumeRecoveryCode: true,
    });
    if (!verification.ok) {
      handleMfaFailureSecuritySignals({
        req,
        userId: pendingUser.id,
        error: verification.reason || "invalid_code",
      });
      appendAuditLog(req, "auth.mfa.failed", "auth", {
        userId: pendingUser.id,
        error: verification.reason || "invalid_code",
      });
      return res.status(401).json({ error: "invalid_mfa_code" });
    }

    const nextPath = String(req.session?.loginNext || "").trim();
    const loginAppOrigin = resolveAuthAppOrigin({
      req,
      sessionOrigin: req.session?.loginAppOrigin,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });
    try {
      await establishAuthenticatedSession({
        req,
        user: pendingUser,
        preserved: {
          loginNext: null,
          loginAppOrigin: null,
          mfaVerifiedAt: new Date().toISOString(),
        },
      });
    } catch {
      return res.status(500).json({ error: "session_regenerate_failed" });
    }
    if (req.session) {
      req.session.pendingMfaUser = null;
    }
    try {
      await saveSessionState(req);
    } catch {
      return res.status(500).json({ error: "session_regenerate_failed" });
    }
    updateSessionIndexFromRequest(req, { force: true });
    maybeEmitNewNetworkLoginEvent({ req, userId: pendingUser.id });
    maybeEmitExcessiveSessionsEvent({ req, userId: pendingUser.id });
    metricsRegistry.inc("auth_mfa_verify_total", { status: "success" });
    appendAuditLog(req, "auth.mfa.success", "auth", {
      userId: pendingUser.id,
      method: verification.method,
    });
    return res.json({
      ok: true,
      method: verification.method,
      recoveryCodesRemaining: verification.remainingRecoveryCodes ?? 0,
      redirect: buildAuthRedirectUrl({
        appOrigin: loginAppOrigin,
        path: nextPath || "/dashboard",
      }),
    });
  };

  router.get(
    "/auth/discord",
    codeQlVisibleDiscordAuthRateLimit,
    enforceDiscordAuthAttemptRateLimit,
    handleDiscordAuthStart,
  );
  router.get(
    "/auth/google",
    codeQlVisibleDiscordAuthRateLimit,
    enforceDiscordAuthAttemptRateLimit,
    handleGoogleAuthStart,
  );
  router.get(
    "/login",
    requireOAuthCallbackParams,
    codeQlVisibleAuthAttemptRateLimit,
    enforceLoginCallbackAuthAttemptRateLimit,
    prepareLoginCallbackContext,
    handleLoginOAuthCallback,
  );
  router.get(
    "/auth/google/callback",
    codeQlVisibleAuthAttemptRateLimit,
    enforceLoginCallbackAuthAttemptRateLimit,
    handleGoogleAuthCallback,
  );
  router.post(
    "/api/auth/mfa/verify",
    codeQlVisiblePendingMfaVerifyRateLimit,
    attachPendingMfaUser,
    enforcePendingMfaVerifyRateLimit,
    handlePendingMfaVerification,
  );
  router.post(
    "/auth/password/login",
    codeQlVisibleAuthAttemptRateLimit,
    async (req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      const ip = getRequestIp(req);
      if (!(await canAttemptAuth(ip))) {
        metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
        appendAuditLog(req, "auth.password.rate_limited", "auth", {});
        return res.status(429).json({ error: "rate_limited" });
      }
      return next();
    },
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      metricsRegistry.inc("auth_login_total", { status: "disabled" });
      appendAuditLog(req, "auth.password.disabled", "auth", {});
      return res.status(410).json({ error: "password_login_disabled" });
    },
  );

  router.post("/api/logout", (req, res) => {
    const currentSid = String(req.sessionID || "").trim();
    const actorId = String(req.session?.user?.id || req.session?.pendingMfaUser?.id || "").trim();
    appendAuditLog(req, "auth.logout", "auth", {});
    if (currentSid) {
      revokeUserSessionIndexRecord(currentSid, {
        revokedBy: actorId || null,
        revokeReason: "logout",
      });
      sessionIndexTouchTsBySid.delete(currentSid);
    }
    req.session?.destroy(() => undefined);
    const {
      maxAge: _maxAge,
      expires: _expires,
      ...clearCookieOptions
    } = sessionCookieConfig.cookie;
    res.clearCookie(sessionCookieConfig.name, clearCookieOptions);
    return res.json({ ok: true });
  });

  app.use(router);
};
