import {
  buildReorderedUsers,
  buildSelfResponseUser,
  diffUserFields,
  rebuildUsersAfterDeletion,
  toUserApiResponse,
} from "./shared.js";

export const registerUserManagementRoutes = ({
  AccessRole,
  BASIC_PROFILE_FIELDS,
  PermissionId,
  SecurityEventSeverity,
  app,
  appendAuditLog,
  applyOwnerRole,
  buildUserProfileRevisionToken,
  can,
  defaultPermissionsForRole,
  emitSecurityEvent,
  ensureNoEditConflict,
  getPrimaryOwnerId,
  getUserAccessContextById,
  isAdminUser,
  isBasicProfileField,
  isOwner,
  isPrimaryOwner,
  isRbacV2Enabled,
  loadOwnerIds,
  loadUploads,
  loadUsers,
  normalizeAccessRole,
  normalizeAvatarDisplay,
  normalizeUsers,
  parseEditRevisionOptions,
  persistCurrentUsers,
  pickBasicProfilePatch,
  removeOwnerRoleLabel,
  requireAuth,
  resolveDiscordAvatarFallbackUrl,
  sanitizeFavoriteWorksByCategory,
  sanitizePermissionsForStorage,
  sanitizeSocials,
  shouldEmitSecurityRuleEvent,
  syncSessionUserDisplayProfile,
  userWithAccessForResponse,
  withEffectiveAvatarUrl,
  withUserProfileRevision,
  writeOwnerIds,
} = {}) => {
  app.post("/api/users", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    const {
      id,
      name,
      phrase,
      bio,
      avatarUrl,
      avatarDisplay,
      socials,
      favoriteWorks,
      status,
      permissions,
      roles,
      accessRole,
    } = req.body || {};

    if (!id || !name) {
      return res.status(400).json({ error: "id_and_name_required" });
    }

    if (!isRbacV2Enabled) {
      if (!isOwner(sessionUser?.id)) {
        return res.status(403).json({ error: "forbidden" });
      }

      let users = normalizeUsers(loadUsers());
      if (users.some((user) => user.id === String(id))) {
        return res.status(409).json({ error: "user_exists" });
      }

      const newUser = {
        id: String(id),
        name,
        phrase: phrase || "",
        bio: bio || "",
        avatarUrl: avatarUrl || null,
        avatarDisplay: normalizeAvatarDisplay(avatarDisplay),
        socials: sanitizeSocials(socials),
        favoriteWorks: sanitizeFavoriteWorksByCategory(favoriteWorks),
        status: status === "retired" ? "retired" : "active",
        permissions: Array.isArray(permissions) ? permissions : [],
        roles: Array.isArray(roles) ? roles.filter(Boolean) : [],
        order: users.length,
      };

      users.push(newUser);
      persistCurrentUsers({ users, isLegacy: true });
      appendAuditLog(req, "users.create", "users", { id: newUser.id });
      return res.status(201).json({ user: withUserProfileRevision(newUser, loadUploads()) });
    }

    const actorContext = getUserAccessContextById(sessionUser?.id);
    const canCreateUsers =
      (actorContext.accessRole === AccessRole.OWNER_PRIMARY ||
        actorContext.accessRole === AccessRole.OWNER_SECONDARY) &&
      can({ grants: actorContext.grants, permissionId: PermissionId.USUARIOS_ACESSO });
    if (!canCreateUsers) {
      return res.status(403).json({ error: "forbidden" });
    }

    let users = normalizeUsers(loadUsers());
    const targetId = String(id);
    if (users.some((user) => user.id === targetId)) {
      return res.status(409).json({ error: "user_exists" });
    }

    const normalizedAccessRole = normalizeAccessRole(accessRole, AccessRole.NORMAL);
    if (
      normalizedAccessRole === AccessRole.OWNER_PRIMARY ||
      normalizedAccessRole === AccessRole.OWNER_SECONDARY
    ) {
      return res.status(403).json({ error: "owner_role_requires_owner_governance" });
    }

    const nextAccessRole =
      normalizedAccessRole === AccessRole.ADMIN ? AccessRole.ADMIN : AccessRole.NORMAL;
    const sanitizedPermissions = Array.isArray(permissions)
      ? sanitizePermissionsForStorage(permissions, {
          acceptLegacyStar: false,
          keepUnknown: true,
        })
      : [...defaultPermissionsForRole(nextAccessRole)];

    const newUser = {
      id: targetId,
      name: String(name || "Sem nome"),
      phrase: phrase || "",
      bio: bio || "",
      avatarUrl: avatarUrl || null,
      avatarDisplay: normalizeAvatarDisplay(avatarDisplay),
      socials: sanitizeSocials(socials),
      favoriteWorks: sanitizeFavoriteWorksByCategory(favoriteWorks),
      status: status === "retired" ? "retired" : "active",
      permissions: sanitizedPermissions,
      roles: removeOwnerRoleLabel(Array.isArray(roles) ? roles.filter(Boolean) : []),
      accessRole: nextAccessRole,
      order: users.length,
    };

    users.push(newUser);
    users = persistCurrentUsers({ users });

    const ownerIds = loadOwnerIds().map((entry) => String(entry));
    const createdUser = users.find((user) => user.id === targetId) || newUser;
    const responseUser = toUserApiResponse({
      applyOwnerRole,
      ownerIds,
      user: createdUser,
      userWithAccessForResponse,
    });
    appendAuditLog(req, "users.create", "users", {
      id: createdUser.id,
      after: responseUser,
    });
    return res.status(201).json({
      user: withUserProfileRevision(responseUser, loadUploads()),
    });
  });

  app.put("/api/users/reorder", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    const { orderedIds, retiredIds } = req.body || {};
    if (!Array.isArray(orderedIds) && !Array.isArray(retiredIds)) {
      return res.status(400).json({ error: "orderedIds_required" });
    }

    if (!isRbacV2Enabled) {
      if (!isAdminUser(sessionUser)) {
        return res.status(403).json({ error: "forbidden" });
      }

      let users = normalizeUsers(loadUsers());
      users = buildReorderedUsers({ users, orderedIds, retiredIds });
      persistCurrentUsers({ users, isLegacy: true });
      appendAuditLog(req, "users.reorder", "users", {});
      return res.json({ ok: true });
    }

    const actorContext = getUserAccessContextById(sessionUser?.id);
    const canReorderUsers =
      (actorContext.accessRole === AccessRole.OWNER_PRIMARY ||
        actorContext.accessRole === AccessRole.OWNER_SECONDARY) &&
      can({ grants: actorContext.grants, permissionId: PermissionId.USUARIOS_ACESSO });
    if (!canReorderUsers) {
      return res.status(403).json({ error: "forbidden" });
    }

    let users = normalizeUsers(loadUsers());
    users = buildReorderedUsers({ users, orderedIds, retiredIds });

    if (actorContext.accessRole === AccessRole.OWNER_SECONDARY) {
      const ownerIds = new Set(loadOwnerIds().map((id) => String(id)));
      const previousOrderById = new Map(
        normalizeUsers(loadUsers()).map((user) => [user.id, user.order]),
      );
      const changedOwnerOrder = users.some((user) => {
        if (!ownerIds.has(user.id)) {
          return false;
        }
        return user.order !== previousOrderById.get(user.id);
      });
      if (changedOwnerOrder) {
        return res.status(403).json({ error: "owner_reorder_forbidden" });
      }
    }

    persistCurrentUsers({ users });
    appendAuditLog(req, "users.reorder", "users", {});
    return res.json({ ok: true });
  });

  app.put("/api/users/:id", (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const options = parseEditRevisionOptions(req.body);
    const targetId = String(req.params.id);
    let users = normalizeUsers(loadUsers());
    const index = users.findIndex((user) => user.id === targetId);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }

    const sessionUser = req.session.user;
    const update = req.body || {};
    const existing = users[index];
    const ownerIds = loadOwnerIds().map((id) => String(id));
    const currentUserSnapshot = toUserApiResponse({
      applyOwnerRole,
      ownerIds,
      user: existing,
      userWithAccessForResponse,
    });
    const responseUploads = loadUploads();
    const currentRevision = buildUserProfileRevisionToken(currentUserSnapshot, responseUploads);

    if (!isRbacV2Enabled) {
      const isOwnerRequest = isOwner(sessionUser.id);
      const canManageBadges = isAdminUser(sessionUser);

      if (!isOwnerRequest && !canManageBadges) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (!isOwnerRequest && canManageBadges) {
        const onlyRoles = Object.keys(update).length === 1 && Array.isArray(update.roles);
        if (!onlyRoles) {
          return res.status(403).json({ error: "roles_only" });
        }
      }

      const noConflict = ensureNoEditConflict({
        req,
        res,
        resourceType: "user",
        resourceId: targetId,
        current: currentUserSnapshot,
        currentRevision,
        options,
      });
      if (!noConflict) {
        return noConflict;
      }

      const updated = {
        ...existing,
        name: update.name ?? existing.name,
        phrase: update.phrase ?? existing.phrase,
        bio: update.bio ?? existing.bio,
        avatarUrl: update.avatarUrl ?? existing.avatarUrl,
        avatarDisplay:
          update.avatarDisplay !== undefined
            ? normalizeAvatarDisplay(update.avatarDisplay)
            : normalizeAvatarDisplay(existing.avatarDisplay),
        socials: Array.isArray(update.socials) ? sanitizeSocials(update.socials) : existing.socials,
        favoriteWorks: Object.prototype.hasOwnProperty.call(update, "favoriteWorks")
          ? sanitizeFavoriteWorksByCategory(update.favoriteWorks)
          : existing.favoriteWorks,
        status: update.status === "retired" ? "retired" : "active",
        permissions: Array.isArray(update.permissions) ? update.permissions : existing.permissions,
        roles: Array.isArray(update.roles) ? update.roles : existing.roles,
      };

      users[index] = updated;
      persistCurrentUsers({ users, isLegacy: true });

      const permissionsChanged =
        JSON.stringify(existing.permissions || []) !== JSON.stringify(updated.permissions || []);
      if (
        permissionsChanged &&
        shouldEmitSecurityRuleEvent(
          "privilege_escalation_warning",
          `${sessionUser.id}:${targetId}`,
        )
      ) {
        emitSecurityEvent({
          req,
          type: "privilege_escalation_warning",
          severity: SecurityEventSeverity.WARNING,
          riskScore: 75,
          actorUserId: sessionUser.id,
          targetUserId: targetId,
          data: {
            mode: "legacy",
            permissionsBefore: existing.permissions || [],
            permissionsAfter: updated.permissions || [],
          },
        });
      }

      appendAuditLog(req, "users.update", "users", { id: targetId });
      const responseUser = applyOwnerRole(updated);
      if (targetId === String(sessionUser?.id || "")) {
        syncSessionUserDisplayProfile(req, responseUser, responseUploads);
      }
      return res.json({
        user: buildSelfResponseUser({
          req,
          resolveDiscordAvatarFallbackUrl,
          responseUploads,
          targetId,
          user: responseUser,
          withEffectiveAvatarUrl,
          withUserProfileRevision,
        }),
      });
    }

    const actorContext = getUserAccessContextById(sessionUser.id, users);
    const targetContext = getUserAccessContextById(targetId, users);
    const updateKeys = Object.keys(update);
    const actorIsPrimary = actorContext.accessRole === AccessRole.OWNER_PRIMARY;
    const actorIsSecondary = actorContext.accessRole === AccessRole.OWNER_SECONDARY;
    const actorIsAdmin = actorContext.accessRole === AccessRole.ADMIN;
    const actorCanUsersBasic = can({
      grants: actorContext.grants,
      permissionId: PermissionId.USUARIOS_BASICO,
    });
    const actorCanUsersAccess = can({
      grants: actorContext.grants,
      permissionId: PermissionId.USUARIOS_ACESSO,
    });
    const touchesBasicFields = updateKeys.some((field) => isBasicProfileField(field));
    const touchesAccessFields = updateKeys.some((field) => !isBasicProfileField(field));

    if (!actorIsPrimary && !actorIsSecondary && !actorIsAdmin) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (targetContext.isOwner && !actorIsPrimary) {
      return res.status(403).json({ error: "owner_update_forbidden" });
    }
    if (actorIsAdmin) {
      if (!actorCanUsersBasic) {
        return res.status(403).json({ error: "users_basic_permission_required" });
      }
      const invalidAdminFields = updateKeys.filter((field) => !isBasicProfileField(field));
      if (invalidAdminFields.length > 0) {
        return res.status(403).json({ error: "basic_fields_only" });
      }
    }
    if ((actorIsPrimary || actorIsSecondary) && touchesBasicFields && !actorCanUsersBasic) {
      return res.status(403).json({ error: "users_basic_permission_required" });
    }
    if ((actorIsPrimary || actorIsSecondary) && touchesAccessFields && !actorCanUsersAccess) {
      return res.status(403).json({ error: "users_access_permission_required" });
    }

    if (targetContext.isPrimaryOwner) {
      const immutableFields = ["permissions", "status", "accessRole"].filter((field) =>
        Object.prototype.hasOwnProperty.call(update, field),
      );
      if (immutableFields.length > 0) {
        return res.status(403).json({ error: "primary_owner_immutable" });
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(update, "accessRole") &&
      String(update.accessRole || "").includes("owner")
    ) {
      return res.status(403).json({ error: "owner_role_requires_owner_governance" });
    }

    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "user",
      resourceId: targetId,
      current: currentUserSnapshot,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }

    const basicPatch = pickBasicProfilePatch(update);
    const updated = {
      ...existing,
      ...basicPatch,
      avatarDisplay:
        basicPatch.avatarDisplay !== undefined
          ? normalizeAvatarDisplay(basicPatch.avatarDisplay)
          : normalizeAvatarDisplay(existing.avatarDisplay),
      socials: Array.isArray(basicPatch.socials)
        ? sanitizeSocials(basicPatch.socials)
        : existing.socials,
      favoriteWorks: Object.prototype.hasOwnProperty.call(basicPatch, "favoriteWorks")
        ? sanitizeFavoriteWorksByCategory(basicPatch.favoriteWorks)
        : existing.favoriteWorks,
      roles: Array.isArray(update.roles) ? removeOwnerRoleLabel(update.roles) : existing.roles,
      status:
        update.status === "retired"
          ? "retired"
          : update.status === "active"
            ? "active"
            : existing.status,
      accessRole: Object.prototype.hasOwnProperty.call(update, "accessRole")
        ? normalizeAccessRole(update.accessRole, existing.accessRole || AccessRole.NORMAL)
        : existing.accessRole || AccessRole.NORMAL,
      permissions: Array.isArray(update.permissions)
        ? sanitizePermissionsForStorage(update.permissions, {
            acceptLegacyStar: false,
            keepUnknown: true,
          })
        : existing.permissions,
    };

    if (
      Object.prototype.hasOwnProperty.call(update, "accessRole") &&
      !Array.isArray(update.permissions) &&
      !targetContext.isOwner
    ) {
      updated.permissions = [...defaultPermissionsForRole(updated.accessRole)];
    }
    if (actorIsSecondary && targetContext.isOwner) {
      return res.status(403).json({ error: "owner_update_forbidden" });
    }
    if ((actorIsPrimary || actorIsSecondary) && targetContext.isOwner) {
      updated.accessRole = existing.accessRole;
    }
    if (
      updated.accessRole === AccessRole.OWNER_PRIMARY ||
      updated.accessRole === AccessRole.OWNER_SECONDARY
    ) {
      updated.accessRole = existing.accessRole;
    }
    if (!actorIsPrimary && !actorIsSecondary) {
      updated.permissions = existing.permissions;
      updated.accessRole = existing.accessRole;
      updated.status = existing.status;
      updated.roles = existing.roles;
    }

    const beforeSnapshot = currentUserSnapshot;
    users[index] = updated;
    users = persistCurrentUsers({ users });
    const persisted = users.find((user) => user.id === targetId) || updated;
    const afterSnapshot = toUserApiResponse({
      applyOwnerRole,
      ownerIds,
      user: persisted,
      userWithAccessForResponse,
    });

    appendAuditLog(req, "users.update", "users", {
      id: targetId,
      before: beforeSnapshot,
      after: afterSnapshot,
      changes: diffUserFields(beforeSnapshot, afterSnapshot, [
        ...BASIC_PROFILE_FIELDS,
        "status",
        "permissions",
        "roles",
        "accessRole",
      ]),
    });

    const hasPrivilegeEscalation =
      JSON.stringify(beforeSnapshot.permissions || []) !==
        JSON.stringify(afterSnapshot.permissions || []) ||
      String(beforeSnapshot.accessRole || "") !== String(afterSnapshot.accessRole || "") ||
      String(beforeSnapshot.status || "") !== String(afterSnapshot.status || "");
    if (
      hasPrivilegeEscalation &&
      shouldEmitSecurityRuleEvent("privilege_escalation_warning", `${sessionUser.id}:${targetId}`)
    ) {
      emitSecurityEvent({
        req,
        type: "privilege_escalation_warning",
        severity: SecurityEventSeverity.WARNING,
        riskScore: 78,
        actorUserId: sessionUser.id,
        targetUserId: targetId,
        data: {
          accessRoleBefore: beforeSnapshot.accessRole || null,
          accessRoleAfter: afterSnapshot.accessRole || null,
          permissionsBefore: beforeSnapshot.permissions || [],
          permissionsAfter: afterSnapshot.permissions || [],
          statusBefore: beforeSnapshot.status || null,
          statusAfter: afterSnapshot.status || null,
        },
      });
    }

    if (targetId === String(sessionUser?.id || "")) {
      syncSessionUserDisplayProfile(req, afterSnapshot, responseUploads);
    }
    return res.json({
      user: buildSelfResponseUser({
        req,
        resolveDiscordAvatarFallbackUrl,
        responseUploads,
        targetId,
        user: afterSnapshot,
        withEffectiveAvatarUrl,
        withUserProfileRevision,
      }),
    });
  });

  app.delete("/api/users/:id", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    const targetId = String(req.params.id || "");
    const primaryOwnerId = getPrimaryOwnerId();

    if (!targetId) {
      return res.status(400).json({ error: "invalid_id" });
    }
    if (sessionUser?.id && String(sessionUser.id) === targetId) {
      return res.status(400).json({ error: "cannot_delete_self" });
    }

    if (!isRbacV2Enabled) {
      if (!isOwner(sessionUser?.id)) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (primaryOwnerId && String(primaryOwnerId) === targetId) {
        return res.status(403).json({ error: "cannot_delete_primary_owner" });
      }
      if (isOwner(targetId) && !isPrimaryOwner(sessionUser?.id)) {
        return res.status(403).json({ error: "owner_delete_forbidden" });
      }

      let users = normalizeUsers(loadUsers());
      const index = users.findIndex((user) => user.id === targetId);
      if (index === -1) {
        return res.status(404).json({ error: "not_found" });
      }

      const removed = users[index];
      users = rebuildUsersAfterDeletion(users.filter((user) => user.id !== targetId));

      let nextOwnerIds = loadOwnerIds();
      if (nextOwnerIds.includes(targetId)) {
        nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
        if (nextOwnerIds.length === 0 && primaryOwnerId) {
          nextOwnerIds = [String(primaryOwnerId)];
        }
        writeOwnerIds(nextOwnerIds);
      }

      persistCurrentUsers({ users, isLegacy: true });
      appendAuditLog(req, "users.delete", "users", {
        id: targetId,
        wasOwner: isOwner(removed.id),
      });
      return res.json({
        ok: true,
        ownerIds: loadOwnerIds(),
      });
    }

    let users = normalizeUsers(loadUsers());
    const index = users.findIndex((user) => user.id === targetId);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }

    const removed = users[index];
    const actorContext = getUserAccessContextById(sessionUser?.id, users);
    const targetContext = getUserAccessContextById(targetId, users);
    const actorIsPrimary = actorContext.accessRole === AccessRole.OWNER_PRIMARY;
    const actorIsSecondary = actorContext.accessRole === AccessRole.OWNER_SECONDARY;
    const actorCanUsersAccess = can({
      grants: actorContext.grants,
      permissionId: PermissionId.USUARIOS_ACESSO,
    });
    if ((!actorIsPrimary && !actorIsSecondary) || !actorCanUsersAccess) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (targetContext.isPrimaryOwner || (primaryOwnerId && String(primaryOwnerId) === targetId)) {
      return res.status(403).json({ error: "cannot_delete_primary_owner" });
    }
    if (targetContext.isOwner && !actorIsPrimary) {
      return res.status(403).json({ error: "owner_delete_forbidden" });
    }

    users = rebuildUsersAfterDeletion(users.filter((user) => user.id !== targetId));

    let nextOwnerIds = loadOwnerIds().map((id) => String(id));
    if (nextOwnerIds.includes(targetId)) {
      nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
      if (nextOwnerIds.length === 0 && primaryOwnerId) {
        nextOwnerIds = [String(primaryOwnerId)];
      }
      writeOwnerIds(nextOwnerIds);
    }

    persistCurrentUsers({ users });
    appendAuditLog(req, "users.delete", "users", {
      id: targetId,
      wasOwner: targetContext.isOwner,
      before: toUserApiResponse({
        applyOwnerRole,
        ownerIds: nextOwnerIds,
        user: removed,
        userWithAccessForResponse,
      }),
    });
    return res.json({
      ok: true,
      ownerIds: loadOwnerIds().map((id) => String(id)),
      primaryOwnerId: getPrimaryOwnerId() || null,
    });
  });
};

export default registerUserManagementRoutes;
