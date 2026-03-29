import { describe, expect, it, vi } from "vitest";

import { createPublicReadCacheRuntime } from "../../server/lib/public-read-cache-runtime.js";

describe("public-read-cache-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createPublicReadCacheRuntime()).toThrow(/missing required dependencies/i);
  });

  it("serializes query params deterministically and reads/writes cache entries", () => {
    const cache = new Map();
    const runtime = createPublicReadCacheRuntime({
      publicReadCache: {
        get: vi.fn((key) => cache.get(key)),
        set: vi.fn((key, value) => cache.set(key, value)),
        invalidateTags: vi.fn(),
      },
    });

    const req = {
      path: "/api/public/posts",
      query: {
        z: "last",
        a: "first",
        tags: ["manga", "novel"],
      },
    };

    const cacheKey = runtime.writePublicCachedJson(req, { ok: true }, {
      statusCode: 201,
      ttlMs: 1500,
      tags: ["posts"],
    });

    expect(cacheKey).toBe("/api/public/posts?a=first&tags=manga&tags=novel&z=last");
    expect(runtime.readPublicCachedJson(req)).toEqual({
      cacheKey,
      payload: { ok: true },
      statusCode: 201,
    });
  });

  it("invalidates cache tags through the wrapped cache store", () => {
    const invalidateTags = vi.fn();
    const runtime = createPublicReadCacheRuntime({
      publicReadCache: {
        get: vi.fn(),
        set: vi.fn(),
        invalidateTags,
      },
    });

    runtime.invalidatePublicReadCacheTags(["bootstrap", "posts"]);

    expect(invalidateTags).toHaveBeenCalledWith(["bootstrap", "posts"]);
  });
});
