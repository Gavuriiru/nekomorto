import { describe, expect, it } from "vitest";

import {
  isDiscordAvatarUrl,
  resolveEffectiveUserAvatarUrl,
  resolveUserAvatarRenderVersion,
  shouldSyncDiscordAvatarToStoredUser,
} from "../../server/lib/user-avatar.js";

describe("user avatar helpers", () => {
  it("gera revision avatar-aware para uploads sobrescritos na mesma URL", () => {
    expect(
      resolveUserAvatarRenderVersion({
        avatarUrl: "/uploads/users/avatar-user-1.png",
        uploads: [
          {
            url: "/uploads/users/avatar-user-1.png",
            variantsVersion: 7,
            createdAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      }),
    ).toBe("variant-7");
  });

  it("sincroniza o avatar do Discord apenas quando o usuario ainda nao tem avatar proprio", () => {
    const discordAvatarUrl =
      "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=128";

    expect(
      shouldSyncDiscordAvatarToStoredUser({
        storedAvatarUrl: "",
        discordAvatarUrl,
      }),
    ).toBe(true);
    expect(
      shouldSyncDiscordAvatarToStoredUser({
        storedAvatarUrl: discordAvatarUrl,
        discordAvatarUrl,
      }),
    ).toBe(true);
    expect(
      shouldSyncDiscordAvatarToStoredUser({
        storedAvatarUrl: "/uploads/users/avatar-user-1.png",
        discordAvatarUrl,
      }),
    ).toBe(false);
  });

  it("prioriza avatar salvo sobre fallback do Discord", () => {
    const discordAvatarUrl =
      "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=128";

    expect(isDiscordAvatarUrl(discordAvatarUrl)).toBe(true);
    expect(
      resolveEffectiveUserAvatarUrl({
        storedAvatarUrl: "/uploads/users/avatar-user-1.png",
        fallbackAvatarUrl: discordAvatarUrl,
      }),
    ).toBe("/uploads/users/avatar-user-1.png");
    expect(
      resolveEffectiveUserAvatarUrl({
        storedAvatarUrl: "",
        fallbackAvatarUrl: discordAvatarUrl,
      }),
    ).toBe(discordAvatarUrl);
  });
});
