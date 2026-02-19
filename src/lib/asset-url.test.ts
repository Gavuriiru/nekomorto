import { afterEach, describe, expect, it } from "vitest";

import {
  getAssetBase,
  normalizeAssetBase,
  normalizeAssetUrl,
  resolveAssetBase,
} from "@/lib/asset-url";

const viteEnv = import.meta.env as Record<string, unknown>;
const originalViteAssetBase = viteEnv.VITE_ASSET_BASE;
const originalViteApiBase = viteEnv.VITE_API_BASE;

afterEach(() => {
  viteEnv.VITE_ASSET_BASE = originalViteAssetBase;
  viteEnv.VITE_API_BASE = originalViteApiBase;
});

describe("asset-url", () => {
  it("normalizeAssetBase trims spaces and trailing slashes", () => {
    expect(normalizeAssetBase(" https://assets.example.com/// ")).toBe(
      "https://assets.example.com",
    );
    expect(normalizeAssetBase("")).toBe("");
  });

  it("resolveAssetBase prioritizes asset base, then api base, then location origin", () => {
    expect(
      resolveAssetBase({
        envAssetBase: "https://assets.example.com/",
        envApiBase: "https://api.example.com/",
        locationOrigin: "https://site.example.com/",
      }),
    ).toBe("https://assets.example.com");
    expect(
      resolveAssetBase({
        envAssetBase: " ",
        envApiBase: "https://api.example.com/",
        locationOrigin: "https://site.example.com/",
      }),
    ).toBe("https://api.example.com");
    expect(
      resolveAssetBase({
        envAssetBase: "",
        envApiBase: "",
        locationOrigin: "https://site.example.com/",
      }),
    ).toBe("https://site.example.com");
  });

  it("getAssetBase uses VITE_ASSET_BASE before VITE_API_BASE", () => {
    viteEnv.VITE_ASSET_BASE = "https://assets.example.com/";
    viteEnv.VITE_API_BASE = "https://api.example.com/";
    expect(getAssetBase()).toBe("https://assets.example.com");

    viteEnv.VITE_ASSET_BASE = "";
    expect(getAssetBase()).toBe("https://api.example.com");
  });

  it("returns empty string for empty values", () => {
    expect(normalizeAssetUrl("")).toBe("");
    expect(normalizeAssetUrl(null)).toBe("");
    expect(normalizeAssetUrl(undefined)).toBe("");
  });

  it("normalizes relative paths to asset base", () => {
    viteEnv.VITE_ASSET_BASE = "https://assets.example.com/";
    expect(normalizeAssetUrl("/uploads/posts/image.png?x=1#preview")).toBe(
      "https://assets.example.com/uploads/posts/image.png?x=1#preview",
    );
  });

  it("falls back to api base for relative paths when asset base is not set", () => {
    viteEnv.VITE_ASSET_BASE = "";
    viteEnv.VITE_API_BASE = "https://api.example.com/";
    expect(normalizeAssetUrl("/uploads/posts/image.png")).toBe(
      "https://api.example.com/uploads/posts/image.png",
    );
  });

  it("rewrites absolute upload URLs from any host to asset base", () => {
    viteEnv.VITE_ASSET_BASE = "https://assets.example.com";
    expect(normalizeAssetUrl("https://legacy.example.com/uploads/posts/a.png?cache=1")).toBe(
      "https://assets.example.com/uploads/posts/a.png?cache=1",
    );
    expect(normalizeAssetUrl("http://127.0.0.1:8080/uploads/projects/capa.webp")).toBe(
      "https://assets.example.com/uploads/projects/capa.webp",
    );
  });

  it("keeps external non-upload URLs unchanged", () => {
    expect(normalizeAssetUrl("https://cdn.example.com/images/a.png")).toBe(
      "https://cdn.example.com/images/a.png",
    );
  });

  it("keeps invalid absolute values unchanged", () => {
    expect(normalizeAssetUrl("not a valid url")).toBe("not a valid url");
  });
});
