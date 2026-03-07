import { resolveDiscordAvatarRenderUrl } from "@/lib/discord-avatar";

const appendAvatarRevision = (avatarUrl: string, revision: string) => {
  const trimmedAvatarUrl = String(avatarUrl || "").trim();
  const trimmedRevision = String(revision || "").trim();
  if (!trimmedAvatarUrl || !trimmedRevision) {
    return trimmedAvatarUrl;
  }
  try {
    const isRelativeUrl = trimmedAvatarUrl.startsWith("/");
    const parsed = isRelativeUrl
      ? new URL(trimmedAvatarUrl, "http://localhost")
      : new URL(trimmedAvatarUrl);
    parsed.searchParams.set("v", trimmedRevision);
    if (isRelativeUrl) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return trimmedAvatarUrl;
  }
};

export const buildAvatarRenderUrl = (
  avatarUrl: string | null | undefined,
  requestedSize = 128,
  revision: string | null | undefined = "",
) => {
  const resolvedAvatarUrl = resolveDiscordAvatarRenderUrl(String(avatarUrl || ""), requestedSize);
  return appendAvatarRevision(resolvedAvatarUrl, String(revision || ""));
};
