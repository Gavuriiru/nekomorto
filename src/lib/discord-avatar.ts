const DISCORD_AVATAR_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

const resolveDiscordAvatarSize = (requestedSize: number) => {
  const size = Math.max(16, Math.floor(Number(requestedSize) || 0));
  return DISCORD_AVATAR_SIZES.find((candidate) => candidate >= size) || 4096;
};

export const withDiscordAvatarSize = (url: string, requestedSize: number) => {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return "";
  }
  try {
    const parsed = new URL(safeUrl, "http://localhost");
    if (!/^https?:$/i.test(parsed.protocol)) {
      return safeUrl;
    }
    if (parsed.hostname !== "cdn.discordapp.com") {
      return safeUrl;
    }
    if (!parsed.pathname.includes("/avatars/")) {
      return safeUrl;
    }
    parsed.searchParams.set("size", String(resolveDiscordAvatarSize(requestedSize)));
    return parsed.toString();
  } catch {
    return safeUrl;
  }
};
