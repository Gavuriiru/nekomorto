import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS,
  PUBLIC_FRESHNESS_CHECK_INTERVAL_MS,
  startPublicFreshnessCoordinator,
} from "@/lib/public-freshness";

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("public-freshness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it("revalidates stale bootstrap data on start, wake events, and the visible interval", async () => {
    let now = 200_000;
    let lastFetchedAt = now - (PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS + 1_000);
    const refetchBootstrap = vi.fn().mockImplementation(async () => {
      lastFetchedAt = now;
    });
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const stopCoordinator = startPublicFreshnessCoordinator({
      globalWindow: window,
      fetchBuildMetadata: async () => ({
        commitSha: "frontendsha",
        builtAt: "2026-04-08T01:00:00Z",
      }),
      getFrontendBuild: () => ({
        commitSha: "frontendsha",
        builtAt: "2026-04-08T01:00:00Z",
      }),
      getBootstrapLastFetchedAt: () => lastFetchedAt,
      refetchBootstrap,
      reloadPage: vi.fn(),
    });

    await flushAsyncWork();
    expect(refetchBootstrap).toHaveBeenCalledTimes(1);

    now += 5_000;
    window.dispatchEvent(new Event("focus"));
    await flushAsyncWork();
    expect(refetchBootstrap).toHaveBeenCalledTimes(1);

    lastFetchedAt = now - (PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS + 1_000);
    window.dispatchEvent(new Event("online"));
    await flushAsyncWork();
    expect(refetchBootstrap).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    lastFetchedAt = now - (PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS + 1_000);
    now += PUBLIC_FRESHNESS_CHECK_INTERVAL_MS;
    await vi.advanceTimersByTimeAsync(PUBLIC_FRESHNESS_CHECK_INTERVAL_MS);
    expect(refetchBootstrap).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushAsyncWork();
    expect(refetchBootstrap).toHaveBeenCalledTimes(3);

    lastFetchedAt = now - (PUBLIC_BOOTSTRAP_REVALIDATE_AFTER_MS + 1_000);
    now += PUBLIC_FRESHNESS_CHECK_INTERVAL_MS;
    await vi.advanceTimersByTimeAsync(PUBLIC_FRESHNESS_CHECK_INTERVAL_MS);
    expect(refetchBootstrap).toHaveBeenCalledTimes(4);

    stopCoordinator();
  });

  it("reloads once per backend fingerprint when the deployed build changes", async () => {
    const reloadSpy = vi.fn();
    const stopCoordinator = startPublicFreshnessCoordinator({
      globalWindow: window,
      fetchBuildMetadata: async () => ({
        commitSha: "backendsha",
        builtAt: "2026-04-08T02:00:00Z",
      }),
      getFrontendBuild: () => ({
        commitSha: "frontendsha",
        builtAt: "2026-04-08T01:00:00Z",
      }),
      getBootstrapLastFetchedAt: () => Date.now(),
      refetchBootstrap: vi.fn(),
      reloadPage: reloadSpy,
    });

    await flushAsyncWork();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await flushAsyncWork();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    stopCoordinator();
  });

  it("does not run on dashboard routes", async () => {
    window.history.replaceState({}, "", "/dashboard/posts");
    const fetchBuildMetadata = vi.fn(async () => ({
      commitSha: "backendsha",
      builtAt: "2026-04-08T02:00:00Z",
    }));
    const refetchBootstrap = vi.fn();
    const reloadSpy = vi.fn();

    const stopCoordinator = startPublicFreshnessCoordinator({
      globalWindow: window,
      fetchBuildMetadata,
      getFrontendBuild: () => ({
        commitSha: "frontendsha",
        builtAt: "2026-04-08T01:00:00Z",
      }),
      getBootstrapLastFetchedAt: () => 0,
      refetchBootstrap,
      reloadPage: reloadSpy,
    });

    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(PUBLIC_FRESHNESS_CHECK_INTERVAL_MS);

    expect(fetchBuildMetadata).not.toHaveBeenCalled();
    expect(refetchBootstrap).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    stopCoordinator();
  });
});
