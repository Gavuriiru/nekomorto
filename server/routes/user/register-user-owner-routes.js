import { SecurityEventSeverity as DefaultSecurityEventSeverity } from "../../lib/security-events.js";

export const registerUserOwnerRoutes = ({
  AccessRole,
  SecurityEventSeverity,
  app,
  appendAuditLog,
  defaultPermissionsForRole,
  emitSecurityEvent,
  enforceUserAccessInvariants,
  getPrimaryOwnerId,
  loadOwnerIds,
  loadUsers,
  normalizeUsers,
  requirePrimaryOwner,
  syncAllowedUsers,
  userWithAccessForResponse,
  applyOwnerRole,
  writeOwnerIds,
  writeUsers,
} = {}) => {
  const securityEventSeverity = {
    ...DefaultSecurityEventSeverity,
    ...(SecurityEventSeverity && typeof SecurityEventSeverity === "object"
      ? SecurityEventSeverity
      : {}),
  };

  app.get("/api/owners", requirePrimaryOwner, (req, res) => {
    appendAuditLog(req, "owners.read", "owners", {});
    const ownerIds = loadOwnerIds().map((id) => String(id));
    return res.json({ ownerIds, primaryOwnerId: ownerIds[0] || null });
  });

  app.put("/api/owners", requirePrimaryOwner, (req, res) => {
    const ownerIds = req.body?.ownerIds;
    if (!Array.isArray(ownerIds)) {
      return res.status(400).json({ error: "owner_ids_required" });
    }

    const previousOwnerIds = loadOwnerIds().map((id) => String(id));
    const primaryOwnerId = getPrimaryOwnerId();
    const nextIds = Array.isArray(ownerIds) ? ownerIds.map((id) => String(id)) : [];
    const unique = Array.from(new Set(nextIds.filter(Boolean)));
    if (primaryOwnerId) {
      const normalizedPrimary = String(primaryOwnerId);
      const filtered = unique.filter((id) => id !== normalizedPrimary);
      unique.length = 0;
      unique.push(normalizedPrimary, ...filtered);
    }

    const users = normalizeUsers(loadUsers());
    const activeUserIds = new Set(
      users.filter((user) => user.status === "active").map((user) => user.id),
    );
    const unknownOrInactiveIds = unique.filter((id) => !activeUserIds.has(id));
    if (unknownOrInactiveIds.length > 0) {
      return res
        .status(400)
        .json({ error: "owner_ids_must_be_active_users", ids: unknownOrInactiveIds });
    }

    writeOwnerIds(unique);
    const promotedOwnerIds = unique.filter((id) => !previousOwnerIds.includes(id));
    const usersWithPromotedDefaults = users.map((user) => {
      if (!promotedOwnerIds.includes(user.id)) {
        return user;
      }
      return {
        ...user,
        status: "active",
        accessRole: AccessRole.OWNER_SECONDARY,
        permissions: [...defaultPermissionsForRole(AccessRole.OWNER_SECONDARY)],
      };
    });
    const normalizedUsers = enforceUserAccessInvariants(usersWithPromotedDefaults);
    writeUsers(normalizedUsers);
    syncAllowedUsers(normalizedUsers);
    appendAuditLog(req, "owners.update", "owners", {
      count: unique.length,
      before: previousOwnerIds,
      after: unique,
    });
    return res.json({ ownerIds: loadOwnerIds(), primaryOwnerId: loadOwnerIds()[0] || null });
  });

  app.post("/api/owners/transfer-primary", requirePrimaryOwner, (req, res) => {
    const targetId = String(req.body?.targetId || "").trim();
    const confirmTargetId = String(req.body?.confirmTargetId || "").trim();
    const confirmTransfer = req.body?.confirmTransfer === true;
    if (!targetId) {
      return res.status(400).json({ error: "target_id_required" });
    }
    if (!confirmTransfer || confirmTargetId !== targetId) {
      return res.status(400).json({ error: "transfer_confirmation_required" });
    }

    const ownerIds = loadOwnerIds().map((id) => String(id));
    const previousPrimaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
    if (!ownerIds.includes(targetId)) {
      return res.status(404).json({ error: "target_owner_not_found" });
    }

    const users = normalizeUsers(loadUsers());
    const targetUser = users.find((user) => user.id === targetId);
    if (!targetUser || targetUser.status !== "active") {
      return res.status(400).json({ error: "target_owner_must_be_active" });
    }
    if (previousPrimaryOwnerId && targetId === previousPrimaryOwnerId) {
      return res.json({
        ok: true,
        ownerIds,
        primaryOwnerId: previousPrimaryOwnerId,
      });
    }

    const nextOwnerIds = [targetId, ...ownerIds.filter((id) => id !== targetId)];
    writeOwnerIds(nextOwnerIds);
    const normalizedUsers = enforceUserAccessInvariants(users);
    writeUsers(normalizedUsers);
    syncAllowedUsers(normalizedUsers);
    appendAuditLog(req, "owners.transfer_primary", "owners", {
      targetId,
      fromPrimaryId: previousPrimaryOwnerId,
      toPrimaryId: targetId,
      before: ownerIds,
      after: nextOwnerIds,
      changes: {
        primaryOwnerId: {
          from: previousPrimaryOwnerId,
          to: targetId,
        },
      },
    });
    emitSecurityEvent({
      req,
      type: "owner_transfer_critical",
      severity: securityEventSeverity.CRITICAL,
      riskScore: 95,
      actorUserId: req.session?.user?.id || null,
      targetUserId: targetId,
      data: {
        fromPrimaryId: previousPrimaryOwnerId,
        toPrimaryId: targetId,
      },
    });
    return res.json({
      ok: true,
      ownerIds: nextOwnerIds,
      primaryOwnerId: targetId,
    });
  });
};

export default registerUserOwnerRoutes;
