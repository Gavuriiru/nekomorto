import { afterEach, describe, expect, it, vi } from "vitest";

import { API_CONTRACT_VERSION, buildApiContractV1 } from "../../server/lib/api-contract-v1.js";

describe("buildApiContractV1", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes EPUB capabilities and build metadata", () => {
    vi.stubEnv("APP_COMMIT_SHA", "abcdef1234567890");
    vi.stubEnv("APP_BUILD_TIME", "2026-03-02T16:00:00Z");

    const contract = buildApiContractV1();

    expect(contract.version).toBe(API_CONTRACT_VERSION);
    expect(contract.capabilities).toEqual({
      project_epub_import: true,
      project_epub_export: true,
    });
    expect(contract.build).toEqual({
      commitSha: "abcdef1234567890",
      builtAt: "2026-03-02T16:00:00Z",
    });
    expect(contract.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "POST",
          path: "/api/projects/epub/import",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/projects/epub/import/cleanup",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/projects/epub/export",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/dashboard/overview",
        }),
      ]),
    );
    expect(typeof contract.generatedAt).toBe("string");
  });

  it("falls back to APP_IMAGE_TAG when explicit commit metadata is absent", () => {
    vi.stubEnv("APP_COMMIT_SHA", "");
    vi.stubEnv("COMMIT_SHA", "");
    vi.stubEnv("GIT_COMMIT_SHA", "");
    vi.stubEnv("GITHUB_SHA", "");
    vi.stubEnv("APP_IMAGE_TAG", "sha-1234567890abcdef");

    const contract = buildApiContractV1();

    expect(contract.build).toMatchObject({
      commitSha: "1234567890abcdef",
    });
  });
});
