import { afterEach, describe, expect, it, vi } from "vitest";

import { getBuildMetadata } from "../../server/lib/build-metadata.js";

describe("getBuildMetadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers explicit env metadata", () => {
    vi.stubEnv("APP_COMMIT_SHA", "abcdef1234567890");
    vi.stubEnv("APP_BUILD_TIME", "2026-03-02T18:00:00Z");
    vi.stubEnv("APP_IMAGE_TAG", "sha-deadbeef");

    expect(getBuildMetadata()).toEqual({
      commitSha: "abcdef1234567890",
      builtAt: "2026-03-02T18:00:00Z",
    });
  });

  it("falls back to sha embedded in APP_IMAGE_TAG", () => {
    vi.stubEnv("APP_COMMIT_SHA", "");
    vi.stubEnv("COMMIT_SHA", "");
    vi.stubEnv("GIT_COMMIT_SHA", "");
    vi.stubEnv("GITHUB_SHA", "");
    vi.stubEnv("APP_IMAGE_TAG", "sha-1234567890abcdef");
    vi.stubEnv("APP_BUILD_TIME", "");
    vi.stubEnv("BUILD_TIME", "2026-03-02T19:00:00Z");

    expect(getBuildMetadata()).toEqual({
      commitSha: "1234567890abcdef",
      builtAt: "2026-03-02T19:00:00Z",
    });
  });
});
