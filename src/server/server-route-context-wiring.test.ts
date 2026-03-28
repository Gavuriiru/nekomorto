import { describe, expect, it } from "vitest";

import { createServerRouteDependencies } from "../../server/bootstrap/create-server-route-dependencies.js";

describe("server route dependency wiring", () => {
  it("routes upload scope helpers into the upload domain without leaking them at the root", () => {
    const app = { get: () => {} };
    const context = createServerRouteDependencies({
      app,
      normalizeUploadScopeUserId: "normalizeUploadScopeUserId",
      resolveRequestUploadAccessScope: "resolveRequestUploadAccessScope",
    });

    expect(context.app).toBe(app);
    expect(context.upload.normalizeUploadScopeUserId).toBe("normalizeUploadScopeUserId");
    expect(context.upload.resolveRequestUploadAccessScope).toBe(
      "resolveRequestUploadAccessScope",
    );
    expect(context).not.toHaveProperty("normalizeUploadScopeUserId");
    expect(context).not.toHaveProperty("resolveRequestUploadAccessScope");
  });
});
