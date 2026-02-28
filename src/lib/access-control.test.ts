import { afterEach, describe, expect, it, vi } from "vitest";
import type { GrantMap } from "@/lib/access-control";

const loadAccessControl = async (enabled: boolean) => {
  vi.resetModules();
  vi.stubEnv("VITE_RBAC_V2_ENABLED", enabled ? "true" : "false");
  return import("@/lib/access-control");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access-control RBAC V2", () => {
  it("hides restricted dashboard routes when V2 is enabled", async () => {
    const access = await loadAccessControl(true);
    const grants = Object.fromEntries(
      access.permissionIds.map((id) => [id, false]),
    ) as GrantMap;
    grants.posts = true;

    expect(access.isDashboardHrefAllowed("/dashboard/posts", grants)).toBe(true);
    expect(access.isDashboardHrefAllowed("/dashboard/comentarios", grants)).toBe(false);
    expect(access.isDashboardHrefAllowed("/dashboard/usuarios", grants)).toBe(false);
    expect(access.isDashboardHrefAllowed("/dashboard/webhooks", grants)).toBe(false);
    expect(access.isDashboardHrefAllowed("/dashboard/redirecionamentos", grants)).toBe(false);
    grants.integracoes = true;
    expect(access.isDashboardHrefAllowed("/dashboard/webhooks", grants)).toBe(true);
    grants.configuracoes = true;
    expect(access.isDashboardHrefAllowed("/dashboard/redirecionamentos", grants)).toBe(true);

    const menu = access.buildDashboardMenuFromGrants(
      [
        { href: "/dashboard", enabled: true },
        { href: "/dashboard/posts", enabled: true },
        { href: "/dashboard/usuarios", enabled: true },
      ],
      grants,
    );
    expect(menu.map((item) => item.href)).toEqual(["/dashboard", "/dashboard/posts"]);
  });

  it("keeps legacy permissive behavior when V2 is disabled", async () => {
    const access = await loadAccessControl(false);
    const grants = null;
    expect(access.isDashboardHrefAllowed("/dashboard/usuarios", grants)).toBe(true);
    expect(access.isDashboardPathAllowed("/dashboard/usuarios", grants)).toBe(true);
  });

  it("resolves owner role from ownerIds regardless of persisted accessRole", async () => {
    const access = await loadAccessControl(true);
    const role = access.resolveAccessRole({
      id: "u-1",
      accessRole: "admin",
      ownerIds: ["u-1"],
      primaryOwnerId: "u-1",
    });
    expect(role).toBe("owner_primary");
  });
});
