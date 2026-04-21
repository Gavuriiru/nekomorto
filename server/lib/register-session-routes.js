import { Router } from "express";

const setNoStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

const requireUserSessionOrPendingAuth = (req, res, next) => {
  if (req.session?.user || req.session?.pendingMfaUser?.id || req.session?.pendingMfaEnrollmentUser?.id) {
    return next();
  }
  setNoStore(res);
  return res.status(401).json({ error: "unauthorized" });
};

export const registerSessionRoutes = ({
  app,
  apiContractVersion,
  buildApiContractV1Payload,
  buildRuntimeMetadata,
  buildUserPayload,
  proxyDiscordAvatarRequest,
}) => {
  const router = Router();

  router.get("/api/me", requireUserSessionOrPendingAuth, (req, res) => {
    setNoStore(res);
    if (!req.session?.user && req.session?.pendingMfaUser?.id) {
      return res.status(401).json({
        error: "mfa_required",
        pendingMfa: true,
        user: {
          id: req.session.pendingMfaUser.id,
          name: req.session.pendingMfaUser.name || "",
          username: req.session.pendingMfaUser.username || "",
          avatarUrl: req.session.pendingMfaUser.avatarUrl || null,
        },
      });
    }
    if (!req.session?.user && req.session?.pendingMfaEnrollmentUser?.id) {
      return res.status(401).json({
        error: "mfa_enrollment_required",
        pendingMfaEnrollment: true,
        user: {
          id: req.session.pendingMfaEnrollmentUser.id,
          name: req.session.pendingMfaEnrollmentUser.name || "",
          username: req.session.pendingMfaEnrollmentUser.username || "",
          avatarUrl: req.session.pendingMfaEnrollmentUser.avatarUrl || null,
        },
      });
    }

    return res.json(buildUserPayload(req.session.user));
  });

  router.get("/api/public/me", (req, res) => {
    setNoStore(res);
    if (!req.session?.user) {
      return res.json({
        user: null,
        pendingMfa: Boolean(req.session?.pendingMfaUser?.id),
        pendingMfaEnrollment: Boolean(req.session?.pendingMfaEnrollmentUser?.id),
      });
    }

    return res.json({ user: buildUserPayload(req.session.user) });
  });

  router.get("/api/public/discord-avatar/:userId/:avatarFile", async (req, res) => {
    const result = await proxyDiscordAvatarRequest({
      userId: req.params.userId,
      avatarFile: req.params.avatarFile,
      size: req.query.size,
    });

    if (!result.ok) {
      setNoStore(res);
      return res.status(result.status).end();
    }

    res.setHeader("Cache-Control", result.cacheControl);
    res.setHeader("Content-Length", String(result.body.length));
    return res.status(200).type(result.contentType).send(result.body);
  });

  router.get("/api/version", (_req, res) => {
    setNoStore(res);
    return res.json({
      apiVersion: apiContractVersion,
      contractUrl: `/api/contracts/${apiContractVersion}.json`,
      build: buildRuntimeMetadata(),
    });
  });

  router.get("/api/contracts", (_req, res) => {
    setNoStore(res);
    return res.json({
      versions: [apiContractVersion],
      latest: apiContractVersion,
      links: {
        [apiContractVersion]: `/api/contracts/${apiContractVersion}.json`,
      },
    });
  });

  router.get(["/api/contracts/v1", "/api/contracts/v1.json"], (_req, res) => {
    setNoStore(res);
    return res.json(buildApiContractV1Payload());
  });

  app.use(router);
};
