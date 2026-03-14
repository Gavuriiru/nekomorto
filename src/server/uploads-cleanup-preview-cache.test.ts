import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testing,
  invalidateUploadsCleanupPreviewCache,
  loadCachedUploadsCleanupPreview,
} from "../../server/lib/uploads-cleanup-preview-cache.js";

describe("uploads cleanup preview cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
    invalidateUploadsCleanupPreviewCache();
  });

  afterEach(() => {
    invalidateUploadsCleanupPreviewCache();
    vi.useRealTimers();
  });

  it("reaproveita o preview dentro do TTL", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ generatedAt: "2026-03-13T12:00:00.000Z", token: "first" });

    const first = await loadCachedUploadsCleanupPreview(loader);
    const second = await loadCachedUploadsCleanupPreview(loader);

    expect(first).toEqual({ generatedAt: "2026-03-13T12:00:00.000Z", token: "first" });
    expect(second).toEqual(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("expira o preview quando o TTL acaba", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ token: "first" })
      .mockResolvedValueOnce({ token: "second" });

    const first = await loadCachedUploadsCleanupPreview(loader);
    vi.advanceTimersByTime(__testing.getUploadsCleanupPreviewTtlMs() + 1);
    const second = await loadCachedUploadsCleanupPreview(loader);

    expect(first).toEqual({ token: "first" });
    expect(second).toEqual({ token: "second" });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("invalida o preview quando o fluxo de escrita pede limpeza do cache", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ token: "first" })
      .mockResolvedValueOnce({ token: "second" });

    await loadCachedUploadsCleanupPreview(loader);
    invalidateUploadsCleanupPreviewCache();
    const second = await loadCachedUploadsCleanupPreview(loader);

    expect(__testing.getUploadsCleanupPreviewCacheState()).toEqual(
      expect.objectContaining({
        value: { token: "second" },
      }),
    );
    expect(second).toEqual({ token: "second" });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
