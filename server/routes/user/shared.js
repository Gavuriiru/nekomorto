export const sortUsersByOrder = (users) =>
  [...users].sort((left, right) => left.order - right.order);

const buildActiveRetiredOrder = (users) => {
  const activeUsers = users
    .filter((user) => user.status === "active")
    .sort((left, right) => left.order - right.order);
  const retiredUsers = users
    .filter((user) => user.status === "retired")
    .sort((left, right) => left.order - right.order);

  return { activeUsers, retiredUsers };
};

export const buildReorderedUsers = ({ users, orderedIds, retiredIds }) => {
  const { activeUsers, retiredUsers } = buildActiveRetiredOrder(users);
  const activeOrder = Array.isArray(orderedIds)
    ? orderedIds.map(String)
    : activeUsers.map((user) => user.id);
  const retiredOrder = Array.isArray(retiredIds)
    ? retiredIds.map(String)
    : retiredUsers.map((user) => user.id);

  const activeOrderMap = new Map(activeOrder.map((id, index) => [String(id), index]));
  const retiredOrderMap = new Map(retiredOrder.map((id, index) => [String(id), index]));

  return users.map((user) => {
    if (user.status === "active" && activeOrderMap.has(user.id)) {
      return { ...user, order: activeOrderMap.get(user.id) };
    }
    if (user.status === "retired" && retiredOrderMap.has(user.id)) {
      return { ...user, order: activeOrder.length + retiredOrderMap.get(user.id) };
    }
    return user;
  });
};

export const rebuildUsersAfterDeletion = (users) => {
  const { activeUsers, retiredUsers } = buildActiveRetiredOrder(users);
  let orderIndex = 0;
  return [
    ...activeUsers.map((user) => ({ ...user, order: orderIndex++ })),
    ...retiredUsers.map((user) => ({ ...user, order: orderIndex++ })),
  ];
};

const normalizeLegacyUsersAfterMutation = ({ users, isOwner, normalizeUsers }) =>
  normalizeUsers(users).map((user) =>
    isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
  );

export const persistUsers = ({
  users,
  isLegacy = false,
  enforceUserAccessInvariants,
  isOwner,
  normalizeUsers,
  syncAllowedUsers,
  writeUsers,
}) => {
  const nextUsers = isLegacy
    ? normalizeLegacyUsersAfterMutation({ users, isOwner, normalizeUsers })
    : enforceUserAccessInvariants(users);
  const sortedUsers = sortUsersByOrder(nextUsers);
  writeUsers(sortedUsers);
  syncAllowedUsers(sortedUsers);
  return sortedUsers;
};

export const loadNormalizedOwnerIds = (loadOwnerIds) =>
  (typeof loadOwnerIds === "function" ? loadOwnerIds() : []).map((entry) => String(entry));

export const toUserApiResponse = ({ applyOwnerRole, ownerIds, user, userWithAccessForResponse }) =>
  applyOwnerRole(userWithAccessForResponse(user, ownerIds));

export const buildUserApiSnapshot = ({
  applyOwnerRole,
  loadOwnerIds,
  ownerIds,
  user,
  userWithAccessForResponse,
}) =>
  toUserApiResponse({
    applyOwnerRole,
    ownerIds: Array.isArray(ownerIds) ? ownerIds : loadNormalizedOwnerIds(loadOwnerIds),
    user,
    userWithAccessForResponse,
  });

export const diffUserFields = (beforeUser, afterUser, fields) => {
  const before = beforeUser || {};
  const after = afterUser || {};
  const keys = Array.isArray(fields) ? fields : [];
  const changes = {};

  keys.forEach((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = {
        from: beforeValue,
        to: afterValue,
      };
    }
  });

  return changes;
};

export const buildLegacyManagedUser = ({
  avatarDisplay,
  avatarUrl,
  bio,
  favoriteWorks,
  id,
  name,
  normalizeAvatarDisplay,
  order,
  permissions,
  phrase,
  roles,
  sanitizeFavoriteWorksByCategory,
  sanitizeSocials,
  socials,
  status,
}) => ({
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
  order,
});

export const buildRbacManagedUser = ({
  AccessRole,
  accessRole,
  avatarDisplay,
  avatarUrl,
  bio,
  defaultPermissionsForRole,
  favoriteWorks,
  id,
  name,
  normalizeAccessRole,
  normalizeAvatarDisplay,
  order,
  permissions,
  phrase,
  removeOwnerRoleLabel,
  roles,
  sanitizeFavoriteWorksByCategory,
  sanitizePermissionsForStorage,
  sanitizeSocials,
  socials,
  status,
}) => {
  const normalizedAccessRole = normalizeAccessRole(accessRole, AccessRole.NORMAL);
  const nextAccessRole =
    normalizedAccessRole === AccessRole.ADMIN ? AccessRole.ADMIN : AccessRole.NORMAL;
  const sanitizedPermissions = Array.isArray(permissions)
    ? sanitizePermissionsForStorage(permissions, {
        acceptLegacyStar: false,
        keepUnknown: true,
      })
    : [...defaultPermissionsForRole(nextAccessRole)];

  return {
    id: String(id),
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
    order,
  };
};

export const buildLegacyManagedUserUpdate = ({
  existing,
  normalizeAvatarDisplay,
  sanitizeFavoriteWorksByCategory,
  sanitizeSocials,
  update,
}) => ({
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
});

export const buildRbacManagedUserUpdate = ({
  AccessRole,
  actorIsAdmin,
  actorIsPrimary,
  actorIsSecondary,
  basicPatch,
  defaultPermissionsForRole,
  existing,
  normalizeAccessRole,
  normalizeAvatarDisplay,
  removeOwnerRoleLabel,
  sanitizeFavoriteWorksByCategory,
  sanitizePermissionsForStorage,
  sanitizeSocials,
  targetContext,
  update,
}) => {
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
  if (actorIsAdmin) {
    updated.permissions = existing.permissions;
    updated.accessRole = existing.accessRole;
    updated.status = existing.status;
    updated.roles = existing.roles;
  }

  return updated;
};

export const syncOwnerIdsAfterUserDeletion = ({
  loadOwnerIds,
  primaryOwnerId,
  targetId,
  writeOwnerIds,
}) => {
  let nextOwnerIds = loadNormalizedOwnerIds(loadOwnerIds);
  if (!nextOwnerIds.includes(targetId)) {
    return nextOwnerIds;
  }

  nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
  if (nextOwnerIds.length === 0 && primaryOwnerId) {
    nextOwnerIds = [String(primaryOwnerId)];
  }
  writeOwnerIds(nextOwnerIds);
  return nextOwnerIds;
};

export const buildSelfResponseUser = ({
  req,
  responseUploads,
  targetId,
  user,
  withEffectiveAvatarUrl,
  withUserProfileRevision,
  resolveDiscordAvatarFallbackUrl,
}) => {
  if (targetId !== String(req.session?.user?.id || "")) {
    return withUserProfileRevision(user, responseUploads);
  }

  return withUserProfileRevision(
    withEffectiveAvatarUrl(
      user,
      resolveDiscordAvatarFallbackUrl(req.session?.user?.avatarUrl),
    ),
    responseUploads,
  );
};
