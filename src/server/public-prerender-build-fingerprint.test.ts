import { describe, expect, it } from "vitest";

import { buildPublicPrerenderBuildFingerprint } from "../../server/lib/public-prerender-build-fingerprint.js";

describe("buildPublicPrerenderBuildFingerprint", () => {
  it("includes the current client index html fingerprint", () => {
    const first = buildPublicPrerenderBuildFingerprint({
      apiContractVersion: "v1",
      buildMetadata: {
        builtAt: "",
        commitSha: "",
      },
      indexHtml: '<script type="module" src="/assets/index-a.js"></script>',
    });
    const second = buildPublicPrerenderBuildFingerprint({
      apiContractVersion: "v1",
      buildMetadata: {
        builtAt: "",
        commitSha: "",
      },
      indexHtml: '<script type="module" src="/assets/index-b.js"></script>',
    });

    expect(first).not.toBe("api");
    expect(first).not.toEqual(second);
    expect(first).toContain("index:");
  });

  it("keeps build metadata in the fingerprint when provided", () => {
    const result = buildPublicPrerenderBuildFingerprint({
      apiContractVersion: "v2",
      buildMetadata: {
        builtAt: "2026-05-12T03:00:00.000Z",
        commitSha: "abcdef123456",
      },
      indexHtml: "<!doctype html>",
    });

    expect(result).toContain("v2");
    expect(result).toContain("abcdef123456");
    expect(result).toContain("2026-05-12T03:00:00.000Z");
    expect(result).toContain("index:");
  });
});
