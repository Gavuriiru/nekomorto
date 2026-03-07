export const DISCORD_AVATAR_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096] as const;

const DISCORD_AVATAR_HOSTNAME = "cdn.discordapp.com";
const DISCORD_AVATAR_PATH_PATTERN =
  /^\/avatars\/(?<userId>\d+)\/(?<avatarFile>[A-Za-z0-9_]+\.(?:png|jpe?g|webp|gif))$/i;

export const resolveDiscordAvatarSize = (requestedSize: number) => {
  const size = Math.max(16, Math.floor(Number(requestedSize) || 0));
  return DISCORD_AVATAR_SIZES.find((candidate) => candidate >= size) || 4096;
};

export const parseDiscordAvatarUrl = (url: string) => {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return null;
  }

  try {
    const parsed = new URL(safeUrl, "http://localhost");
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
    if (parsed.hostname !== DISCORD_AVATAR_HOSTNAME) {
      return null;
    }
    const match = parsed.pathname.match(DISCORD_AVATAR_PATH_PATTERN);
    if (!match?.groups?.userId || !match.groups.avatarFile) {
      return null;
    }
    return {
      userId: match.groups.userId,
      avatarFile: match.groups.avatarFile,
    };
  } catch {
    return null;
  }
};

export const buildDiscordAvatarProxyUrl = ({
  userId,
  avatarFile,
  requestedSize,
}: {
  userId: string;
  avatarFile: string;
  requestedSize: number;
}) => {
  const params = new URLSearchParams({
    size: String(resolveDiscordAvatarSize(requestedSize)),
  });
  return `/api/public/discord-avatar/${encodeURIComponent(userId)}/${encodeURIComponent(avatarFile)}?${params.toString()}`;
};

export const resolveDiscordAvatarRenderUrl = (url: string, requestedSize: number) => {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return "";
  }
  const parsedAvatar = parseDiscordAvatarUrl(safeUrl);
  if (!parsedAvatar) {
    return safeUrl;
  }
  return buildDiscordAvatarProxyUrl({
    userId: parsedAvatar.userId,
    avatarFile: parsedAvatar.avatarFile,
    requestedSize,
  });
};

export const withDiscordAvatarSize = (url: string, requestedSize: number) =>
  resolveDiscordAvatarRenderUrl(url, requestedSize);
