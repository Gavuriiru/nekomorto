import { diffUserFields, toUserApiResponse } from "./shared.js";

export const registerUserSelfRoutes = ({
  BASIC_PROFILE_FIELDS,
  app,
  appendAuditLog,
  applyOwnerRole,
  buildUserProfileRevisionToken,
  ensureNoEditConflict,
  loadOwnerIds,
  loadUploads,
  loadUsers,
  normalizeAvatarDisplay,
  normalizeUsers,
  parseEditRevisionOptions,
  persistCurrentUsers,
  pickBasicProfilePatch,
  requireAuth,
  resolveDiscordAvatarFallbackUrl,
  sanitizeFavoriteWorksByCategory,
  sanitizeSocials,
  syncSessionUserDisplayProfile,
  userWithAccessForResponse,
  withEffectiveAvatarUrl,
  withUserProfileRevision,
} = {}) => {
  app.put("/api/users/self", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    const options = parseEditRevisionOptions(req.body);
    let users = normalizeUsers(loadUsers());
    const index = users.findIndex((user) => user.id === String(sessionUser.id));
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }

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
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "user",
      resourceId: existing.id,
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
      name: basicPatch.name ?? existing.name,
      phrase: basicPatch.phrase ?? existing.phrase,
      bio: basicPatch.bio ?? existing.bio,
      avatarUrl: basicPatch.avatarUrl ?? existing.avatarUrl,
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
    };

    const beforeSnapshot = currentUserSnapshot;
    users[index] = updated;
    users = persistCurrentUsers({ users });
    const persisted = users.find((user) => user.id === String(sessionUser.id)) || updated;
    const afterSnapshot = toUserApiResponse({
      applyOwnerRole,
      ownerIds,
      user: persisted,
      userWithAccessForResponse,
    });

    appendAuditLog(req, "users.update_self", "users", {
      id: sessionUser.id,
      before: beforeSnapshot,
      after: afterSnapshot,
      changes: diffUserFields(beforeSnapshot, afterSnapshot, BASIC_PROFILE_FIELDS),
    });
    syncSessionUserDisplayProfile(req, persisted, responseUploads);
    return res.json({
      user: withUserProfileRevision(
        withEffectiveAvatarUrl(
          afterSnapshot,
          resolveDiscordAvatarFallbackUrl(req.session?.user?.avatarUrl),
        ),
        responseUploads,
      ),
    });
  });
};

export default registerUserSelfRoutes;
