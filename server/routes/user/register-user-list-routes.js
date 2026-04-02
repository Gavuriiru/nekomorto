import { sortUsersByOrder, toUserApiResponse } from "./shared.js";

export const registerUserListRoutes = ({
  app,
  appendAuditLog,
  applyOwnerRole,
  canManageUsersAccess,
  canManageUsersBasic,
  enforceUserAccessInvariants,
  ensureOwnerUser,
  isRbacV2Enabled,
  loadOwnerIds,
  loadUploads,
  loadUsers,
  normalizeUsers,
  requireAuth,
  syncAllowedUsers,
  userWithAccessForResponse,
  withUserProfileRevision,
  writeUsers,
} = {}) => {
  app.get("/api/users", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (isRbacV2Enabled) {
      const canReadUsers =
        canManageUsersBasic(sessionUser?.id) || canManageUsersAccess(sessionUser?.id);
      if (!canReadUsers) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    ensureOwnerUser(sessionUser);
    let users = enforceUserAccessInvariants(normalizeUsers(loadUsers()));
    users = sortUsersByOrder(users);
    writeUsers(users);
    syncAllowedUsers(users);

    const ownerIds = loadOwnerIds().map((id) => String(id));
    const uploads = loadUploads();
    const responseUsers = users.map((user) =>
      withUserProfileRevision(
        toUserApiResponse({
          applyOwnerRole,
          ownerIds,
          user,
          userWithAccessForResponse,
        }),
        uploads,
      ),
    );

    appendAuditLog(req, "users.read", "users", {});
    return res.json({
      users: responseUsers,
      ownerIds,
      primaryOwnerId: ownerIds[0] || null,
    });
  });
};

export default registerUserListRoutes;
