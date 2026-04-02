export const registerUserBootstrapOwnerRoutes = ({
  BOOTSTRAP_TOKEN,
  app,
  appendAuditLog,
  canBootstrap,
  ensureOwnerUser,
  enforceUserAccessInvariants,
  loadOwnerIds,
  loadUsers,
  normalizeUsers,
  requireAuth,
  syncAllowedUsers,
  writeOwnerIds,
  writeUsers,
} = {}) => {
  app.post("/api/bootstrap-owner", requireAuth, async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canBootstrap(ip))) {
      appendAuditLog(req, "auth.bootstrap.rate_limited", "owners", {});
      return res.status(429).json({ error: "rate_limited" });
    }
    if (!BOOTSTRAP_TOKEN) {
      appendAuditLog(req, "auth.bootstrap.disabled", "owners", {});
      return res.status(403).json({ error: "bootstrap_disabled" });
    }

    const currentOwners = loadOwnerIds();
    if (currentOwners.length) {
      appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "owner_exists" });
      return res.status(409).json({ error: "owner_exists" });
    }

    const token = String(req.body?.token || req.headers["x-bootstrap-token"] || "");
    if (!token || token !== BOOTSTRAP_TOKEN) {
      appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "invalid_token" });
      return res.status(403).json({ error: "invalid_token" });
    }

    const sessionUser = req.session?.user;
    if (!sessionUser?.id) {
      appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "unauthorized" });
      return res.status(401).json({ error: "unauthorized" });
    }

    writeOwnerIds([sessionUser.id]);
    ensureOwnerUser(sessionUser);
    const users = enforceUserAccessInvariants(normalizeUsers(loadUsers()));
    writeUsers(users);
    syncAllowedUsers(users);
    appendAuditLog(req, "auth.bootstrap.success", "owners", { ownerId: sessionUser.id });
    const ownerIds = loadOwnerIds().map((id) => String(id));
    return res.json({ ok: true, ownerIds, primaryOwnerId: ownerIds[0] || null });
  });
};

export default registerUserBootstrapOwnerRoutes;
