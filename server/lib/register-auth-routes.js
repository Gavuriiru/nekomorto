import crypto from "crypto";
import { Router } from "express";

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
  getRequestIp,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  isAllowedOrigin,
  isTotpEnabledForUser,
  loadAllowedUsers,
  metricsRegistry,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  primaryAppOrigin,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri,
  revokeUserSessionIndexRecord,
  saveSessionState,
  scopes,
  sessionCookieConfig,
  sessionIndexTouchTsBySid,
  syncPersistedDiscordAvatarForLogin,
  updateSessionIndexFromRequest,
  verifyTotpOrRecoveryCode,
}) => {
  const router = Router();
  const requirePendingMfaSession = (req, res, next) => {
    if (req.session?.pendingMfaUser?.id) {
      return next();
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({ error: "mfa_not_pending" });
  };

  router.get("/auth/discord", async (req, res) => {
    const ip = getRequestIp(req);
    if (!(await canAttemptAuth(ip))) {
      metricsRegistry.inc("auth_login_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.discord.rate_limited", "auth", {});
      return res.status(429).json({ error: "rate_limited" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const loginAppOrigin = resolveAuthAppOrigin({
      req,
      sessionOrigin: null,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });
    const loginNext =
      typeof req.query.next === "string" && req.query.next.trim() ? req.query.next : null;
    const redirectUri = resolveDiscordRedirectUri(req);
    if (req.session) {
      req.session.oauthState = state;
      req.session.loginNext = loginNext;
      req.session.discordRedirectUri = redirectUri;
      req.session.loginAppOrigin = loginAppOrigin;
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
  });

  router.get("/login", async (req, res, next) => {
    const hasOAuthCallbackParams = Boolean(
      (typeof req.query?.code === "string" && req.query.code.trim()) ||
        (typeof req.query?.state === "string" && req.query.state.trim()),
    );
    if (!hasOAuthCallbackParams) {
      return next();
    }

    const loginAppOrigin = resolveAuthAppOrigin({
      req,
      sessionOrigin: req.session?.loginAppOrigin,
      primaryAppOrigin,
      isAllowedOriginFn: isAllowedOrigin,
    });

    const ip = getRequestIp(req);
    if (!(await canAttemptAuth(ip))) {
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
        let discordErrorText = 'unknown';
        try { discordErrorText = await tokenResponse.text(); } catch(e){}
        appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed", discordError: discordErrorText, redirectUri: redirectUri });
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
      const allowedUsers = loadAllowedUsers();
      const isAllowed = allowedUsers.includes(discordUser.id);

      if (!isAllowed) {
        if (req.session) {
          req.session.destroy(() => undefined);
        }
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "unauthorized" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "unauthorized" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: { error: "unauthorized" },
          }),
        );
      }

      const nextPath = String(req.session?.loginNext || "").trim();
      const authenticatedUser = {
        id: discordUser.id,
        name: discordUser.global_name || discordUser.username,
        username: discordUser.username,
        email: discordUser.email || null,
        avatarUrl: createDiscordAvatarUrl(discordUser),
      };
      syncPersistedDiscordAvatarForLogin({
        userId: authenticatedUser.id,
        discordAvatarUrl: authenticatedUser.avatarUrl,
      });
      ensureOwnerUser(authenticatedUser);
      const requiresMfa = isTotpEnabledForUser(authenticatedUser.id);
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
      if (req.session) {
        req.session.oauthState = null;
        req.session.discordRedirectUri = null;
      }

      if (requiresMfa && req.session) {
        req.session.pendingMfaUser = authenticatedUser;
        req.session.user = null;
        req.session.mfaVerifiedAt = null;
        try {
          await saveSessionState(req);
        } catch {
          metricsRegistry.inc("auth_login_total", { status: "failed" });
          handleAuthFailureSecuritySignals({ req, error: "session_persist_failed" });
          appendAuditLog(req, "auth.login.failed", "auth", { error: "session_persist_failed" });
          return redirectToLoginServerError();
        }
        updateSessionIndexFromRequest(req, { force: true });
        appendAuditLog(req, "auth.login.mfa_required", "auth", { userId: discordUser.id });
        metricsRegistry.inc("auth_login_total", { status: "mfa_required" });
        return res.redirect(
          buildAuthRedirectUrl({
            appOrigin: loginAppOrigin,
            path: "/login",
            searchParams: {
              mfa: "required",
              next: nextPath || undefined,
            },
          }),
        );
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
        return redirectToLoginServerError();
      }
      updateSessionIndexFromRequest(req, { force: true });
      maybeEmitNewNetworkLoginEvent({ req, userId: authenticatedUser.id });
      maybeEmitExcessiveSessionsEvent({ req, userId: authenticatedUser.id });
      appendAuditLog(req, "auth.login.success", "auth", { userId: discordUser.id });
      metricsRegistry.inc("auth_login_total", { status: "success" });
      return res.redirect(
        buildAuthRedirectUrl({
          appOrigin: loginAppOrigin,
          path: nextPath || "/dashboard",
        }),
      );
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
  });

  router.post("/api/auth/mfa/verify", requirePendingMfaSession, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const pendingUser = req.session?.pendingMfaUser || null;
    const ip = getRequestIp(req);
    if (!(await canVerifyMfa(ip))) {
      metricsRegistry.inc("auth_mfa_verify_total", { status: "rate_limited" });
      appendAuditLog(req, "auth.mfa.rate_limited", "auth", {
        userId: pendingUser?.id || null,
        action: "verify",
      });
      return res.status(429).json({ error: "rate_limited" });
    }

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
  });

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
    const { maxAge: _maxAge, expires: _expires, ...clearCookieOptions } = sessionCookieConfig.cookie;
    res.clearCookie(sessionCookieConfig.name, clearCookieOptions);
    return res.json({ ok: true });
  });

  app.use(router);
};
