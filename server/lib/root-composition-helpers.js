export const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

export const createDiscordAvatarUrl = (user) => {
  if (!user?.avatar) {
    return null;
  }
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
};

export const createRuntimeMetadataBuilder =
  ({ apiVersion, getBuildMetadata } = {}) =>
  () => ({
    apiVersion,
    ...(typeof getBuildMetadata === "function" ? getBuildMetadata() : {}),
  });

export const createRouteGuards = ({ isOwner, isPrimaryOwner } = {}) => {
  const requireAuth = (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  };

  const requireOwner = (req, res, next) => {
    if (!req.session?.user || typeof isOwner !== "function" || !isOwner(req.session.user.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };

  const requirePrimaryOwner = (req, res, next) => {
    if (
      !req.session?.user ||
      typeof isPrimaryOwner !== "function" ||
      !isPrimaryOwner(req.session.user.id)
    ) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };

  return {
    requireAuth,
    requireOwner,
    requirePrimaryOwner,
  };
};

export default {
  createDiscordAvatarUrl,
  createRouteGuards,
  createRuntimeMetadataBuilder,
  normalizeTags,
};
