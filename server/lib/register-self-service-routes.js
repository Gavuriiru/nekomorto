import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const setNoStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

export const registerSelfServiceRoutes = ({
  app,
  appendAuditLog,
  buildMySecuritySummary,
  canManageMfa,
  clearEnrollmentFromSession,
  dataEncryptionKeyring,
  deleteUserMfaTotpRecord,
  encryptStringWithKeyring,
  generateRecoveryCodes,
  getRequestIp,
  handleMfaFailureSecuritySignals,
  hashRecoveryCode,
  isPlainObject,
  isTotpEnabledForUser,
  listActiveSessionsForUser,
  metricsRegistry,
  mfaRecoveryCodePepper,
  normalizeUserPreferences,
  requireAuth,
  resolveEnrollmentFromSession,
  resolveMfaMetadata,
  revokeSessionBySid,
  saveSessionState,
  startTotpEnrollment,
  verifyTotpCode,
  verifyTotpOrRecoveryCode,
  userPreferencesMaxBytes,
  loadUserPreferences,
  writeUserMfaTotpRecord,
  writeUserPreferences,
}) => {
  const router = Router();

  const rejectMfaRateLimited = (req, res, userId, action) => {
    metricsRegistry.inc("auth_mfa_verify_total", { status: "rate_limited" });
    appendAuditLog(req, "auth.mfa.rate_limited", "auth", {
      userId,
      action,
    });
    return res.status(429).json({ error: "rate_limited" });
  };

  const createManageMfaRateLimitMiddleware = (action) => async (req, res, next) => {
    setNoStore(res);
    const userId = String(res.locals?.authenticatedUserId || "").trim();
    if (!userId) {
      return next();
    }
    const ip = getRequestIp(req);
    if (!(await canManageMfa(ip))) {
      return rejectMfaRateLimited(req, res, userId, action);
    }
    return next();
  };
  const enforceTotpEnrollStartRateLimit = createManageMfaRateLimitMiddleware("enroll_start");
  const enforceTotpEnrollConfirmRateLimit =
    createManageMfaRateLimitMiddleware("enroll_confirm");
  const enforceTotpDisableRateLimit = createManageMfaRateLimitMiddleware("disable");
  const codeQlVisibleMfaRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = getRequestIp(req);
      return ip ? ipKeyGenerator(ip) : "anonymous";
    },
    handler: (req, res) => rejectMfaRateLimited(req, res, "anonymous", "codeql_visible"),
  });

  const requireAuthenticatedUserId = (req, res, next) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    res.locals.authenticatedUserId = userId;
    return next();
  };

  const handleTotpEnrollConfirm = async (req, res) => {
    setNoStore(res);
    const userId = res.locals.authenticatedUserId;
    const enrollmentToken = String(req.body?.enrollmentToken || req.body?.token || "").trim();
    const code = String(req.body?.code || req.body?.codeOrRecoveryCode || "")
      .trim()
      .replace(/\s+/g, "");
    if (!enrollmentToken || !code) {
      appendAuditLog(req, "auth.mfa.enroll.failed", "auth", {
        userId,
        error: "enrollment_token_and_code_required",
      });
      return res.status(400).json({ error: "enrollment_token_and_code_required" });
    }
    const enrollment = resolveEnrollmentFromSession({ req, enrollmentToken, userId });
    if (!enrollment) {
      appendAuditLog(req, "auth.mfa.enroll.failed", "auth", {
        userId,
        error: "invalid_or_expired_enrollment",
      });
      return res.status(400).json({ error: "invalid_or_expired_enrollment" });
    }
    if (!verifyTotpCode({ secret: enrollment.secret, code })) {
      handleMfaFailureSecuritySignals({
        req,
        userId,
        error: "enroll_confirm_invalid_code",
      });
      appendAuditLog(req, "auth.mfa.enroll.failed", "auth", {
        userId,
        error: "invalid_totp_code",
      });
      return res.status(401).json({ error: "invalid_totp_code" });
    }
    const recoveryCodes = generateRecoveryCodes({ count: 8 });
    const recoveryCodesHashed = recoveryCodes.map((entry) =>
      hashRecoveryCode({ code: entry, pepper: mfaRecoveryCodePepper }),
    );
    const encryptedSecret = encryptStringWithKeyring({
      keyring: dataEncryptionKeyring,
      plaintext: JSON.stringify({ secret: enrollment.secret }),
    });
    writeUserMfaTotpRecord(userId, {
      userId,
      secretEncrypted: encryptedSecret,
      secretKeyId: dataEncryptionKeyring.activeKeyId,
      enabledAt: new Date().toISOString(),
      disabledAt: null,
      recoveryCodesHashed,
    });
    clearEnrollmentFromSession(req);
    appendAuditLog(req, "auth.mfa.enroll.success", "auth", { userId });
    metricsRegistry.inc("auth_mfa_verify_total", { status: "configured" });
    return res.json({
      ok: true,
      recoveryCodes,
      recoveryCodesRemaining: recoveryCodes.length,
    });
  };

  const handleTotpDisable = async (req, res) => {
    setNoStore(res);
    const userId = res.locals.authenticatedUserId;
    if (!isTotpEnabledForUser(userId)) {
      return res.status(409).json({ error: "totp_not_enabled" });
    }
    const codeOrRecoveryCode = String(req.body?.codeOrRecoveryCode || req.body?.code || "").trim();
    const verification = verifyTotpOrRecoveryCode({
      userId,
      codeOrRecoveryCode,
      consumeRecoveryCode: true,
    });
    if (!verification.ok) {
      handleMfaFailureSecuritySignals({
        req,
        userId,
        error: verification.reason || "disable_invalid_code",
      });
      return res.status(401).json({ error: "invalid_mfa_code" });
    }
    deleteUserMfaTotpRecord(userId);
    clearEnrollmentFromSession(req);
    appendAuditLog(req, "auth.mfa.disable", "auth", { userId, method: verification.method });
    return res.json({ ok: true });
  };

  router.get("/api/me/preferences", requireAuth, (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.json({ preferences: loadUserPreferences(userId) });
  });

  router.put("/api/me/preferences", requireAuth, (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const incoming =
      isPlainObject(req.body) && isPlainObject(req.body.preferences)
        ? req.body.preferences
        : req.body;
    const normalized = normalizeUserPreferences(incoming);
    const encoded = Buffer.byteLength(JSON.stringify(normalized), "utf8");
    if (encoded > userPreferencesMaxBytes) {
      return res.status(413).json({ error: "payload_too_large" });
    }
    const saved = writeUserPreferences(userId, normalized);
    appendAuditLog(req, "users.preferences.update", "users", { userId });
    return res.json({ ok: true, preferences: saved });
  });

  router.get("/api/me/security", requireAuth, (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.json(buildMySecuritySummary({ req, userId }));
  });

  router.post(
    "/api/me/security/totp/enroll/start",
    codeQlVisibleMfaRateLimit,
    requireAuth,
    requireAuthenticatedUserId,
    enforceTotpEnrollStartRateLimit,
    async (req, res) => {
      setNoStore(res);
      const userId = String(res.locals.authenticatedUserId || "").trim();
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      if (isTotpEnabledForUser(userId)) {
        return res.status(409).json({ error: "totp_already_enabled" });
      }
      const metadata = resolveMfaMetadata({
        req,
        userId,
        accountName: req.session?.user?.username || req.session?.user?.name || userId,
      });
      const enrollment = startTotpEnrollment({
        req,
        userId,
        accountName: metadata.accountLabel,
        issuer: metadata.issuer,
        iconUrl: metadata.iconUrl,
      });
      if (!enrollment) {
        return res.status(500).json({ error: "enrollment_unavailable" });
      }
      try {
        await saveSessionState(req);
      } catch {
        clearEnrollmentFromSession(req);
        appendAuditLog(req, "auth.mfa.enroll.failed", "auth", {
          userId,
          error: "enrollment_persist_failed",
        });
        return res.status(500).json({ error: "enrollment_persist_failed" });
      }
      appendAuditLog(req, "auth.mfa.enroll.start", "auth", { userId });
      return res.json({
        enrollmentToken: enrollment.enrollmentToken,
        otpauthUrl: enrollment.otpauthUrl,
        manualSecret: enrollment.secret,
        issuer: metadata.issuer,
        accountLabel: metadata.accountLabel,
        iconUrl: metadata.iconUrl,
      });
    },
  );

  router.post(
    "/api/me/security/totp/enroll/confirm",
    codeQlVisibleMfaRateLimit,
    requireAuth,
    requireAuthenticatedUserId,
    enforceTotpEnrollConfirmRateLimit,
    handleTotpEnrollConfirm,
  );

  router.post(
    "/api/me/security/totp/disable",
    codeQlVisibleMfaRateLimit,
    requireAuth,
    requireAuthenticatedUserId,
    enforceTotpDisableRateLimit,
    handleTotpDisable,
  );

  router.get("/api/me/sessions", requireAuth, (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const currentSid = String(req.sessionID || "");
    const sessions = listActiveSessionsForUser(userId).map((entry) => ({
      sid: entry.sid,
      createdAt: entry.createdAt || null,
      lastSeenAt: entry.lastSeenAt || null,
      lastIp: entry.lastIp || "",
      userAgent: entry.userAgent || "",
      current: String(entry.sid || "") === currentSid,
      isCurrent: String(entry.sid || "") === currentSid,
      revokedAt: entry.revokedAt || null,
      isPendingMfa: Boolean(entry.isPendingMfa),
    }));
    metricsRegistry.setGauge("active_sessions_total", {}, sessions.length);
    return res.json({ sessions });
  });

  router.delete("/api/me/sessions/others", requireAuth, async (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    const currentSid = String(req.sessionID || "");
    const sessions = listActiveSessionsForUser(userId).filter(
      (entry) => String(entry.sid || "") !== currentSid,
    );
    await Promise.all(
      sessions.map((entry) =>
        revokeSessionBySid({
          sid: entry.sid,
          revokedBy: userId,
          revokeReason: "self_revoke_others",
        }),
      ),
    );
    appendAuditLog(req, "auth.sessions.revoke_others", "auth", {
      userId,
      count: sessions.length,
    });
    return res.json({ ok: true, revokedCount: sessions.length });
  });

  router.delete("/api/me/sessions/:sid", requireAuth, async (req, res) => {
    setNoStore(res);
    const userId = String(req.session?.user?.id || "").trim();
    const targetSid = String(req.params.sid || "").trim();
    const currentSid = String(req.sessionID || "");
    if (!targetSid) {
      return res.status(400).json({ error: "invalid_sid" });
    }
    if (targetSid === currentSid) {
      return res.status(400).json({ error: "cannot_revoke_current_session" });
    }
    const target = listActiveSessionsForUser(userId).find(
      (entry) => String(entry.sid || "") === targetSid,
    );
    if (!target) {
      return res.status(404).json({ error: "session_not_found" });
    }
    await revokeSessionBySid({
      sid: targetSid,
      revokedBy: userId,
      revokeReason: "self_revoke_single",
    });
    appendAuditLog(req, "auth.sessions.revoke_single", "auth", {
      userId,
      sid: targetSid,
    });
    return res.json({ ok: true });
  });

  app.use(router);
};
