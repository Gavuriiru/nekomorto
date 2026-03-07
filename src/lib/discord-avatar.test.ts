import { describe, expect, it } from "vitest";

import {
  buildDiscordAvatarProxyUrl,
  parseDiscordAvatarUrl,
  resolveDiscordAvatarRenderUrl,
  resolveDiscordAvatarSize,
} from "@/lib/discord-avatar";

describe("discord avatar helpers", () => {
  it("normaliza size para a grade suportada do Discord", () => {
    expect(resolveDiscordAvatarSize(1)).toBe(16);
    expect(resolveDiscordAvatarSize(48)).toBe(64);
    expect(resolveDiscordAvatarSize(129)).toBe(256);
  });

  it("extrai userId e avatarFile de um avatar valido do Discord", () => {
    expect(
      parseDiscordAvatarUrl("https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=64"),
    ).toEqual({
      userId: "123456789",
      avatarFile: "avatar_hash.png",
    });
  });

  it("gera a URL same-origin para o proxy publico", () => {
    expect(
      buildDiscordAvatarProxyUrl({
        userId: "123456789",
        avatarFile: "avatar_hash.png",
        requestedSize: 200,
      }),
    ).toBe("/api/public/discord-avatar/123456789/avatar_hash.png?size=256");
  });

  it("resolve avatar do Discord para o proxy local e preserva URLs nao-Discord", () => {
    expect(
      resolveDiscordAvatarRenderUrl(
        "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=64",
        64,
      ),
    ).toBe("/api/public/discord-avatar/123456789/avatar_hash.png?size=64");
    expect(resolveDiscordAvatarRenderUrl("/uploads/users/avatar.png", 128)).toBe(
      "/uploads/users/avatar.png",
    );
    expect(resolveDiscordAvatarRenderUrl("https://example.com/avatar.png", 128)).toBe(
      "https://example.com/avatar.png",
    );
  });
});
