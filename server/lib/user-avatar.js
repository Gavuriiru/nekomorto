const DISCORD_AVATAR_HOSTNAME = "cdn.discordapp.com";
const DISCORD_AVATAR_PATH_PATTERN =
  /^\/avatars\/(?<userId>\d+)\/(?<avatarFile>[A-Za-z0-9_]+\.(?:png|jpe?g|webp|gif))$/i;
const UPLOADS_FALLBACK_ORIGIN = "https://nekomata.local";

const normalizeAvatarUrl = (value) => String(value || "").trim();

const normalizeUploadAvatarUrl = (value) => {
  const trimmed = normalizeAvatarUrl(value);
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(trimmed, UPLOADS_FALLBACK_ORIGIN);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    return "";
  }
  return "";
};

export const isDiscordAvatarUrl = (value) => {
  const trimmed = normalizeAvatarUrl(value);
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed, "https://localhost");
    if (!/^https?:$/i.test(parsed.protocol)) {
      return false;
    }
    if (parsed.hostname !== DISCORD_AVATAR_HOSTNAME) {
      return false;
    }
    return DISCORD_AVATAR_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
};

export const isUploadAvatarUrl = (value) => Boolean(normalizeUploadAvatarUrl(value));

export const resolveEffectiveUserAvatarUrl = ({
  storedAvatarUrl,
  fallbackAvatarUrl,
} = {}) => {
  const stored = normalizeAvatarUrl(storedAvatarUrl);
  if (stored) {
    return stored;
  }
  return normalizeAvatarUrl(fallbackAvatarUrl);
};

export const shouldSyncDiscordAvatarToStoredUser = ({
  storedAvatarUrl,
  discordAvatarUrl,
} = {}) => {
  const nextDiscordAvatarUrl = normalizeAvatarUrl(discordAvatarUrl);
  if (!nextDiscordAvatarUrl || !isDiscordAvatarUrl(nextDiscordAvatarUrl)) {
    return false;
  }
  const stored = normalizeAvatarUrl(storedAvatarUrl);
  if (!stored) {
    return true;
  }
  return isDiscordAvatarUrl(stored);
};

export const resolveUserAvatarRenderVersion = ({
  avatarUrl,
  uploads,
} = {}) => {
  const normalizedAvatarUrl = normalizeUploadAvatarUrl(avatarUrl);
  if (!normalizedAvatarUrl) {
    return "";
  }
  const entries = Array.isArray(uploads) ? uploads : [];
  const matchedUpload =
    entries.find((item) => normalizeUploadAvatarUrl(item?.url) === normalizedAvatarUrl) || null;
  if (!matchedUpload) {
    return "";
  }
  const variantsVersion = Number(matchedUpload?.variantsVersion);
  if (Number.isFinite(variantsVersion) && variantsVersion > 0) {
    return `variant-${Math.floor(variantsVersion)}`;
  }
  const createdAt = normalizeAvatarUrl(matchedUpload?.createdAt);
  if (!createdAt) {
    return "";
  }
  const createdAtTimestamp = new Date(createdAt).getTime();
  if (Number.isFinite(createdAtTimestamp) && createdAtTimestamp > 0) {
    return `created-${createdAtTimestamp}`;
  }
  return `created-${createdAt}`;
};
