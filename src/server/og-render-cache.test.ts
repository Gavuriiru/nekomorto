import { describe, expect, it, vi } from "vitest";

import {
  buildOgRenderCacheKey,
  buildOgRenderFingerprint,
  createOgRenderCache,
} from "../../server/lib/og-render-cache.js";

const baseModel = {
  eyebrow: "Anime • Finalizado",
  title: "Oshi no Ko",
  subtitle: "Doga Kobo",
  sceneVersion: "project-og-v3",
  titleFontSize: 84,
  artworkUrl: "/uploads/projects/oshi-no-ko/cover.jpg",
  artworkSource: "cover",
  backdropUrl: "/uploads/projects/oshi-no-ko/banner.jpg",
  backdropSource: "banner",
  palette: {
    accentPrimary: "#3173ff",
    accentLine: "#49b6ff",
    accentDarkStart: "#0a2238",
    accentDarkEnd: "#020913",
    bgBase: "#02050b",
  },
  layout: {
    artworkLeft: 780,
    artworkTop: 0,
    artworkWidth: 420,
    artworkHeight: 630,
    dividerLeft: 776,
    dividerTop: -10,
    dividerWidth: 8,
    dividerHeight: 650,
  },
};

describe("og render cache", () => {
  it("stores and reads cache entries", () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 256 });
    const buffer = Buffer.from("png-data");
    const key = "project:oshi-no-ko";

    expect(cache.read(key)).toBeNull();
    cache.write(key, { buffer, contentType: "image/png" });

    const cached = cache.read(key);
    expect(cached).not.toBeNull();
    expect(cached?.contentType).toBe("image/png");
    expect(cached?.buffer.equals(buffer)).toBe(true);
  });

  it("expires cached entries by ttl", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-04T12:00:00.000Z"));
      const cache = createOgRenderCache({ ttlMs: 1000, maxEntries: 8 });
      const key = "project:exp";
      cache.write(key, { buffer: Buffer.from("x"), contentType: "image/png" });
      expect(cache.read(key)).not.toBeNull();

      vi.setSystemTime(new Date("2026-03-04T12:00:01.100Z"));
      expect(cache.read(key)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("evicts least-recently-used entries when max size is reached", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-04T12:00:00.000Z"));
      const cache = createOgRenderCache({ ttlMs: 30_000, maxEntries: 2 });
      cache.write("a", { buffer: Buffer.from("a"), contentType: "image/png" });
      vi.setSystemTime(new Date("2026-03-04T12:00:00.100Z"));
      cache.write("b", { buffer: Buffer.from("b"), contentType: "image/png" });
      vi.setSystemTime(new Date("2026-03-04T12:00:00.150Z"));
      cache.read("a");
      vi.setSystemTime(new Date("2026-03-04T12:00:00.200Z"));
      cache.write("c", { buffer: Buffer.from("c"), contentType: "image/png" });

      expect(cache.read("a")).not.toBeNull();
      expect(cache.read("b")).toBeNull();
      expect(cache.read("c")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates concurrent renders with in-flight promises", async () => {
    vi.useRealTimers();
    const cache = createOgRenderCache({ ttlMs: 30_000, maxEntries: 8 });
    let runs = 0;
    const factory = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true };
    };
    const first = cache.getOrCreateInFlight("same", factory);
    const second = cache.getOrCreateInFlight("same", factory);
    const [a, b] = await Promise.all([first, second]);

    expect(runs).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
  });

  it("changes fingerprint and key when accent, backdrop or scene version changes", () => {
    const originalFingerprint = buildOgRenderFingerprint({
      kind: "project",
      id: "oshi-no-ko",
      model: baseModel,
    });
    const originalKey = buildOgRenderCacheKey({
      kind: "project",
      id: "oshi-no-ko",
      model: baseModel,
    });
    const accentChangedModel = {
      ...baseModel,
      palette: {
        ...baseModel.palette,
        accentLine: "#ff6b6b",
      },
    };
    const titleChangedModel = {
      ...baseModel,
      title: "Oshi no Ko 2",
    };
    const backdropChangedModel = {
      ...baseModel,
      backdropUrl: "/uploads/projects/oshi-no-ko/banner-v2.jpg",
    };
    const versionChangedModel = {
      ...baseModel,
      sceneVersion: "project-og-v4",
    };

    const accentFingerprint = buildOgRenderFingerprint({
      kind: "project",
      id: "oshi-no-ko",
      model: accentChangedModel,
    });
    const accentKey = buildOgRenderCacheKey({
      kind: "project",
      id: "oshi-no-ko",
      model: accentChangedModel,
    });
    const titleKey = buildOgRenderCacheKey({
      kind: "project",
      id: "oshi-no-ko",
      model: titleChangedModel,
    });
    const backdropKey = buildOgRenderCacheKey({
      kind: "project",
      id: "oshi-no-ko",
      model: backdropChangedModel,
    });
    const versionKey = buildOgRenderCacheKey({
      kind: "project",
      id: "oshi-no-ko",
      model: versionChangedModel,
    });

    expect(accentFingerprint).not.toBe(originalFingerprint);
    expect(accentKey).not.toBe(originalKey);
    expect(titleKey).not.toBe(originalKey);
    expect(backdropKey).not.toBe(originalKey);
    expect(versionKey).not.toBe(originalKey);
  });
});
