import type { GrantMap } from "@/lib/access-control";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    const grants = Object.fromEntries(access.permissionIds.map((id) => [id, false])) as GrantMap;
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

  it("merges explicit grants into legacy navigation when V2 is disabled", async () => {
    const access = await loadAccessControl(false);
    const grants = access.resolveGrants({
      id: "u-1",
      permissions: [],
      grants: {
        posts: true,
      },
    });
    expect(access.isDashboardHrefAllowed("/dashboard/posts", grants)).toBe(true);
    expect(access.isDashboardHrefAllowed("/dashboard/usuarios", grants)).toBe(false);
    expect(access.isDashboardPathAllowed("/dashboard/usuarios", grants)).toBe(true);
    expect(
      access.buildDashboardMenuFromGrants(
        [
          { href: "/dashboard", enabled: true },
          { href: "/dashboard/posts", enabled: true },
          { href: "/dashboard/usuarios", enabled: true },
        ],
        grants,
      ),
    ).toEqual([
      { href: "/dashboard", enabled: true },
      { href: "/dashboard/posts", enabled: true },
    ]);
    expect(access.getFirstAllowedDashboardRoute(grants)).toBe("/dashboard");
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

  it("allows project access from explicit grants and ownerIds without legacy permissions", async () => {
    const access = await loadAccessControl(false);

    expect(
      access.canManageProjectsAccess({
        id: "grant-user",
        permissions: [],
        grants: { projetos: true },
      }),
    ).toBe(true);

    expect(
      access.canManageProjectsAccess({
        id: "owner-user",
        permissions: [],
        ownerIds: ["owner-user"],
        primaryOwnerId: "other-owner",
      }),
    ).toBe(true);
  });

  it("allows post access from explicit grants and ownerIds without legacy permissions", async () => {
    const access = await loadAccessControl(false);

    expect(
      access.canManagePostsAccess({
        id: "grant-user",
        permissions: [],
        grants: { posts: true },
      }),
    ).toBe(true);

    expect(
      access.canManagePostsAccess({
        id: "owner-user",
        permissions: [],
        ownerIds: ["owner-user"],
        primaryOwnerId: "other-owner",
      }),
    ).toBe(true);
  });

  it("preserves legacy permission access for posts and projects when V2 is enabled", async () => {
    const access = await loadAccessControl(true);

    expect(
      access.canManagePostsAccess({
        id: "legacy-post-user",
        permissions: ["posts"],
      }),
    ).toBe(true);

    expect(
      access.canManagePostsAccess({
        id: "legacy-admin-user",
        permissions: ["*"],
      }),
    ).toBe(true);

    expect(
      access.canManageProjectsAccess({
        id: "legacy-project-user",
        permissions: ["projetos"],
      }),
    ).toBe(true);
  });
});
