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

export const toUserApiResponse = ({ applyOwnerRole, ownerIds, user, userWithAccessForResponse }) =>
  applyOwnerRole(userWithAccessForResponse(user, ownerIds));

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
