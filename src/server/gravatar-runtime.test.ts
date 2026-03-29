import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";

import { createGravatarRuntime } from "../../server/lib/gravatar-runtime.js";

describe("gravatar-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createGravatarRuntime()).toThrow(/missing required dependencies/i);
  });

  it("normalizes emails, hashes them, and builds fallback urls", () => {
    const runtime = createGravatarRuntime({ crypto, gravatarApiKey: "" });

    expect(runtime.normalizeEmail("  TeSt@Example.com ")).toBe("test@example.com");
    expect(runtime.createGravatarHash("  TeSt@Example.com ")).toBe(
      crypto.createHash("sha256").update("test@example.com").digest("hex"),
    );
    expect(runtime.buildGravatarUrl("hash-123", 128)).toBe(
      "https://gravatar.com/avatar/hash-123?d=identicon&s=128",
    );
  });

  it("returns the remote gravatar avatar when the api responds with one", async () => {
    const fetch = vi.fn(async () => ({
      json: async () => ({ avatar_url: "https://cdn.example/avatar.png" }),
      ok: true,
    }));
    const runtime = createGravatarRuntime({
      crypto,
      fetch,
      gravatarApiKey: "gravatar-key",
    });

    await expect(runtime.resolveGravatarAvatarUrl("hash-123")).resolves.toBe(
      "https://cdn.example/avatar.png",
    );
    expect(fetch).toHaveBeenCalledWith("https://api.gravatar.com/v3/profiles/hash-123", {
      headers: {
        Authorization: "Bearer gravatar-key",
      },
    });
  });

  it("falls back to the public gravatar url when the api is unavailable", async () => {
    const runtime = createGravatarRuntime({
      crypto,
      fetch: vi.fn(async () => {
        throw new Error("network down");
      }),
      gravatarApiKey: "gravatar-key",
    });

    await expect(runtime.resolveGravatarAvatarUrl("hash-123")).resolves.toBe(
      "https://gravatar.com/avatar/hash-123?d=identicon&s=96",
    );
  });
});
