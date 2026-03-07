const DISCORD_AVATAR_HOST = "cdn.discordapp.com";
const DISCORD_AVATAR_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const DISCORD_AVATAR_FILE_PATTERN = /^[A-Za-z0-9_]+\.(?:png|jpe?g|webp|gif)$/i;
const DISCORD_AVATAR_MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export const normalizeDiscordAvatarSize = (value) => {
  const size = Math.max(16, Math.floor(Number(value) || 0));
  return DISCORD_AVATAR_SIZES.find((candidate) => candidate >= size) || 4096;
};

export const normalizeDiscordAvatarRequest = ({ userId, avatarFile }) => {
  const safeUserId = String(userId || "").trim();
  const safeAvatarFile = String(avatarFile || "").trim();
  if (!/^\d+$/.test(safeUserId)) {
    return null;
  }
  if (!DISCORD_AVATAR_FILE_PATTERN.test(safeAvatarFile)) {
    return null;
  }
  return {
    userId: safeUserId,
    avatarFile: safeAvatarFile,
  };
};

export const getDiscordAvatarMimeType = (avatarFile) => {
  const extension = String(avatarFile || "")
    .trim()
    .split(".")
    .pop()
    ?.toLowerCase();
  return DISCORD_AVATAR_MIME_BY_EXTENSION[extension || ""] || "image/png";
};

export const buildDiscordAvatarUpstreamUrl = ({ userId, avatarFile, size }) => {
  const normalized = normalizeDiscordAvatarRequest({ userId, avatarFile });
  if (!normalized) {
    return "";
  }
  const params = new URLSearchParams({
    size: String(normalizeDiscordAvatarSize(size)),
  });
  return `https://${DISCORD_AVATAR_HOST}/avatars/${encodeURIComponent(normalized.userId)}/${encodeURIComponent(normalized.avatarFile)}?${params.toString()}`;
};

export const proxyDiscordAvatarRequest = async ({
  userId,
  avatarFile,
  size,
  fetchImpl = globalThis.fetch,
}) => {
  const normalized = normalizeDiscordAvatarRequest({ userId, avatarFile });
  if (!normalized) {
    return {
      ok: false,
      status: 400,
      error: "invalid_discord_avatar",
    };
  }
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      status: 502,
      error: "discord_avatar_fetch_unavailable",
    };
  }

  const upstreamUrl = buildDiscordAvatarUpstreamUrl({
    userId: normalized.userId,
    avatarFile: normalized.avatarFile,
    size,
  });

  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(upstreamUrl, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*",
      },
      redirect: "follow",
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "discord_avatar_upstream_failed",
    };
  }

  if (upstreamResponse.status === 404) {
    return {
      ok: false,
      status: 404,
      error: "discord_avatar_not_found",
    };
  }
  if (!upstreamResponse.ok) {
    return {
      ok: false,
      status: 502,
      error: "discord_avatar_bad_status",
    };
  }

  let body;
  try {
    body = Buffer.from(await upstreamResponse.arrayBuffer());
  } catch {
    return {
      ok: false,
      status: 502,
      error: "discord_avatar_body_read_failed",
    };
  }

  return {
    ok: true,
    status: 200,
    body,
    contentType:
      String(upstreamResponse.headers.get("content-type") || "").trim() ||
      getDiscordAvatarMimeType(normalized.avatarFile),
    cacheControl: "public, max-age=31536000, immutable",
  };
};
