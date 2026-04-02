export const registerUserPublicUserRoutes = ({
  app,
  buildPublicMediaVariants,
  buildPublicTeamMembers,
} = {}) => {
  app.get("/api/public/users", (_req, res) => {
    const users = buildPublicTeamMembers();
    const teamAvatarUrls = users.map((user) => user?.avatarUrl).filter(Boolean);

    return res.json({
      users,
      mediaVariants: buildPublicMediaVariants([users], {
        allowPrivateUrls: teamAvatarUrls,
      }),
    });
  });
};

export default registerUserPublicUserRoutes;
