import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTargetPorts } from "../../scripts/dev-preflight.mjs";

describe("dev-preflight", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses only the app port for the integrated dev server", () => {
    vi.stubEnv("PORT", "8080");
    vi.stubEnv("DEV_HMR_PORT", "24678");

    expect(resolveTargetPorts()).toEqual([8080]);
  });

  it("falls back to the default app port when PORT is invalid", () => {
    vi.stubEnv("PORT", "invalid");

    expect(resolveTargetPorts()).toEqual([8080]);
  });
});
