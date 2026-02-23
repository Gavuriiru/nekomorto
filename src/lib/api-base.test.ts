import { afterEach, describe, expect, it } from "vitest";

import { getApiBase, normalizeApiBase, resolveApiBase } from "@/lib/api-base";

const viteEnv = import.meta.env as Record<string, unknown>;
const originalViteApiBase = viteEnv.VITE_API_BASE;

afterEach(() => {
  viteEnv.VITE_API_BASE = originalViteApiBase;
});

describe("api-base", () => {
  it("normalizeApiBase trims spaces and trailing slashes", () => {
    expect(normalizeApiBase(" https://api.example.com/// ")).toBe("https://api.example.com");
    expect(normalizeApiBase("")).toBe("");
  });

  it("resolveApiBase prioritizes env base when present", () => {
    expect(
      resolveApiBase({
        envBase: "https://api.example.com/",
        locationOrigin: "https://site.example.com",
      }),
    ).toBe("https://api.example.com");
  });

  it("resolveApiBase falls back to location origin", () => {
    expect(
      resolveApiBase({
        envBase: " ",
        locationOrigin: "https://site.example.com/",
      }),
    ).toBe("https://site.example.com");
  });

  it("resolveApiBase ignores localhost env base when page origin is public", () => {
    expect(
      resolveApiBase({
        envBase: "http://localhost:8080",
        locationOrigin: "https://dev.nekomata.moe",
      }),
    ).toBe("https://dev.nekomata.moe");
  });

  it("resolveApiBase keeps localhost env base when page origin is local", () => {
    expect(
      resolveApiBase({
        envBase: "http://127.0.0.1:8080",
        locationOrigin: "http://localhost:5173",
      }),
    ).toBe("http://127.0.0.1:8080");
  });

  it("resolveApiBase returns empty when env and location are missing", () => {
    expect(resolveApiBase({ envBase: "", locationOrigin: "" })).toBe("");
  });

  it("getApiBase uses VITE_API_BASE when configured", () => {
    viteEnv.VITE_API_BASE = "https://api.example.com/";
    expect(getApiBase()).toBe("https://api.example.com");
  });

  it("getApiBase uses same-origin when VITE_API_BASE is empty", () => {
    viteEnv.VITE_API_BASE = "";
    expect(getApiBase()).toBe(window.location.origin);
  });
});
