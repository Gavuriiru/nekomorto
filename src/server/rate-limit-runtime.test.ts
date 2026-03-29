import { describe, expect, it, vi } from "vitest";

import { createRateLimitRuntime } from "../../server/lib/rate-limit-runtime.js";

const createRuntime = (overrides: Record<string, unknown> = {}) => {
  const metricsRegistry = {
    inc: vi.fn(),
  };
  const rateLimiter = {
    consume: vi.fn(async () => ({ allowed: true })),
  };
  const runtime = createRateLimitRuntime({
    isProduction: false,
    metricsRegistry,
    rateLimiter,
    ...overrides,
  });

  return {
    metricsRegistry,
    rateLimiter,
    runtime,
  };
};

describe("rate-limit-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createRateLimitRuntime()).toThrow(/missing required dependencies/i);
  });

  it("allows requests without an ip and skips the limiter", async () => {
    const { rateLimiter, runtime } = createRuntime();

    await expect(runtime.canSubmitComment("")).resolves.toBe(true);
    expect(rateLimiter.consume).not.toHaveBeenCalled();
  });

  it("increments reject metrics when a limiter bucket denies the request", async () => {
    const rateLimiter = {
      consume: vi.fn(async () => ({ allowed: false })),
    };
    const { metricsRegistry, runtime } = createRuntime({
      rateLimiter,
    });

    await expect(runtime.canRegisterView("127.0.0.1")).resolves.toBe(false);
    expect(rateLimiter.consume).toHaveBeenCalledWith({
      bucket: "register_view",
      key: "127.0.0.1",
      limit: 300,
      windowMs: 60000,
    });
    expect(metricsRegistry.inc).toHaveBeenCalledWith("rate_limit_reject_total", {
      bucket: "register_view",
    });
  });

  it("uses production limits for sensitive buckets", async () => {
    const rateLimiter = {
      consume: vi.fn(async () => ({ allowed: true })),
    };
    const runtime = createRateLimitRuntime({
      isProduction: true,
      metricsRegistry: { inc: vi.fn() },
      rateLimiter,
    });

    await runtime.canAttemptAuth("127.0.0.1");
    await runtime.canBootstrap("127.0.0.1");
    await runtime.canUploadImage("127.0.0.1");
    await runtime.canRegisterPollVote("127.0.0.1");

    expect(rateLimiter.consume).toHaveBeenNthCalledWith(1, {
      bucket: "auth_attempt",
      key: "127.0.0.1",
      limit: 20,
      windowMs: 60000,
    });
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(2, {
      bucket: "bootstrap_owner",
      key: "127.0.0.1",
      limit: 5,
      windowMs: 60000,
    });
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(3, {
      bucket: "upload_image",
      key: "127.0.0.1",
      limit: 20,
      windowMs: 60000,
    });
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(4, {
      bucket: "poll_vote",
      key: "127.0.0.1",
      limit: 20,
      windowMs: 60000,
    });
  });

  it("fails open when the limiter throws", async () => {
    const runtime = createRateLimitRuntime({
      isProduction: false,
      metricsRegistry: { inc: vi.fn() },
      rateLimiter: {
        consume: vi.fn(async () => {
          throw new Error("redis unavailable");
        }),
      },
    });

    await expect(runtime.canAttemptAuth("127.0.0.1")).resolves.toBe(true);
  });
});
