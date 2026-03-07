import { describe, expect, it, vi } from "vitest";

import {
  buildDiscordAvatarUpstreamUrl,
  normalizeDiscordAvatarRequest,
  normalizeDiscordAvatarSize,
  proxyDiscordAvatarRequest,
} from "../../server/lib/discord-avatar-proxy.js";

describe("discord avatar proxy", () => {
  it("normaliza parametros validos e rejeita entradas invalidas", () => {
    expect(
      normalizeDiscordAvatarRequest({
        userId: "123456789",
        avatarFile: "avatar_hash.png",
      }),
    ).toEqual({
      userId: "123456789",
      avatarFile: "avatar_hash.png",
    });

    expect(
      normalizeDiscordAvatarRequest({
        userId: "user-1",
        avatarFile: "avatar_hash.png",
      }),
    ).toBeNull();
    expect(
      normalizeDiscordAvatarRequest({
        userId: "123456789",
        avatarFile: "avatar_hash.svg",
      }),
    ).toBeNull();
  });

  it("gera a URL upstream com size normalizado", () => {
    expect(normalizeDiscordAvatarSize(80)).toBe(128);
    expect(
      buildDiscordAvatarUpstreamUrl({
        userId: "123456789",
        avatarFile: "avatar_hash.png",
        size: 80,
      }),
    ).toBe("https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=128");
  });

  it("faz proxy do avatar com cache imutavel e sem expor cookies do upstream", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "_cfuvid=blocked",
        },
      }),
    );

    const result = await proxyDiscordAvatarRequest({
      userId: "123456789",
      avatarFile: "avatar_hash.png",
      size: 64,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=64",
      expect.objectContaining({
        redirect: "follow",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(result.ok && result.body.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(result).not.toHaveProperty("set-cookie");
  });

  it("propaga 404 do upstream e retorna 502 para falhas restantes", async () => {
    const notFound = await proxyDiscordAvatarRequest({
      userId: "123456789",
      avatarFile: "avatar_hash.png",
      size: 128,
      fetchImpl: vi.fn(async () => new Response(null, { status: 404 })),
    });
    expect(notFound).toMatchObject({
      ok: false,
      status: 404,
      error: "discord_avatar_not_found",
    });

    const failed = await proxyDiscordAvatarRequest({
      userId: "123456789",
      avatarFile: "avatar_hash.png",
      size: 128,
      fetchImpl: vi.fn(async () => new Response(null, { status: 500 })),
    });
    expect(failed).toMatchObject({
      ok: false,
      status: 502,
      error: "discord_avatar_bad_status",
    });
  });
});
