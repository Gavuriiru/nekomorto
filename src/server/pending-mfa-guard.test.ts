import { describe, expect, it } from "vitest";

import { canAccessApiDuringPendingMfa } from "../../server/lib/pending-mfa-guard.js";

describe("pending-mfa-guard", () => {
  it("permite rotas publicas", () => {
    expect(canAccessApiDuringPendingMfa("/public/bootstrap")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/public/settings")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/public/pages")).toBe(true);
  });

  it("permite rotas explicitamente allowlisted", () => {
    expect(canAccessApiDuringPendingMfa("/auth/mfa/verify")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/logout")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/version")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/contracts")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/contracts/v1")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/contracts/v1.json")).toBe(true);
  });

  it("bloqueia subpaths privados", () => {
    expect(canAccessApiDuringPendingMfa("/me")).toBe(false);
    expect(canAccessApiDuringPendingMfa("/users")).toBe(false);
    expect(canAccessApiDuringPendingMfa("/settings")).toBe(false);
  });

  it("normaliza querystring de forma consistente", () => {
    expect(canAccessApiDuringPendingMfa("/public/bootstrap?refresh=1")).toBe(true);
    expect(canAccessApiDuringPendingMfa("/me?from=login")).toBe(false);
  });
});
