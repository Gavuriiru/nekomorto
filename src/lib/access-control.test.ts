import type { AccessRole, GrantMap, PermissionId } from "@/lib/access-control";
import { describe, expect, it } from "vitest";

import {
  buildDashboardMenuFromGrants,
  canManagePostsAccess,
  canManageProjectsAccess,
  getFirstAllowedDashboardRoute,
  isDashboardHrefAllowed,
  isDashboardPathAllowed,
  permissionIds,
  resolveAccessRole,
  resolveGrants,
} from "@/lib/access-control";

const grantsWith = (...allowed: PermissionId[]): GrantMap => {
  const grants = Object.fromEntries(permissionIds.map((id) => [id, false])) as GrantMap;
  allowed.forEach((permission) => {
    grants[permission] = true;
  });
  return grants;
};

const expectRouteAccess = ({
  allow,
  deny,
  grants,
  role = "normal",
}: {
  allow: string[];
  deny: string[];
  grants: GrantMap;
  role?: AccessRole;
}) => {
  allow.forEach((href) =>
    expect(isDashboardHrefAllowed(href, grants, { accessRole: role })).toBe(true),
  );
  deny.forEach((href) =>
    expect(isDashboardHrefAllowed(href, grants, { accessRole: role })).toBe(false),
  );
};

describe("access-control dashboard RBAC", () => {
  it("uses explicit grants only for dashboard access", () => {
    const matrix: Array<{ grant: PermissionId; allow: string[]; deny: string[] }> = [
      {
        grant: "posts",
        allow: ["/dashboard/posts"],
        deny: ["/dashboard/comentarios", "/dashboard/analytics", "/dashboard/uploads"],
      },
      {
        grant: "projetos",
        allow: ["/dashboard/projetos"],
        deny: [
          "/dashboard/comentarios",
          "/dashboard/analytics",
          "/dashboard/webhooks",
          "/dashboard/uploads",
        ],
      },
      {
        grant: "comentarios",
        allow: ["/dashboard/comentarios"],
        deny: ["/dashboard/analytics"],
      },
      {
        grant: "configuracoes",
        allow: ["/dashboard/configuracoes", "/dashboard/redirecionamentos"],
        deny: ["/dashboard/webhooks", "/dashboard/uploads"],
      },
      {
        grant: "uploads",
        allow: ["/dashboard/uploads"],
        deny: ["/dashboard/posts", "/dashboard/projetos", "/dashboard/configuracoes"],
      },
      {
        grant: "analytics",
        allow: ["/dashboard/analytics"],
        deny: ["/dashboard/posts", "/dashboard/projetos", "/dashboard/comentarios"],
      },
      {
        grant: "integracoes",
        allow: ["/dashboard/webhooks"],
        deny: ["/dashboard/projetos", "/dashboard/configuracoes"],
      },
      {
        grant: "audit_log",
        allow: ["/dashboard/audit-log"],
        deny: ["/dashboard/seguranca"],
      },
      {
        grant: "usuarios",
        allow: ["/dashboard/usuarios"],
        deny: ["/dashboard/seguranca"],
      },
    ];

    matrix.forEach(({ allow, deny, grant }) =>
      expectRouteAccess({ allow, deny, grants: grantsWith(grant) }),
    );
  });

  it("requires owner role for security", () => {
    const grants = grantsWith("audit_log", "usuarios");

    expect(isDashboardHrefAllowed("/dashboard/seguranca", grants, { accessRole: "admin" })).toBe(
      false,
    );
    expect(
      isDashboardPathAllowed("/dashboard/seguranca", grants, { accessRole: "owner_secondary" }),
    ).toBe(true);
    expect(getFirstAllowedDashboardRoute(grants, { accessRole: "admin" })).not.toBe(
      "/dashboard/seguranca",
    );
  });

  it("filters menu items with the same route rules", () => {
    const menu = buildDashboardMenuFromGrants(
      [
        { href: "/dashboard", enabled: true },
        { href: "/dashboard/posts", enabled: true },
        { href: "/dashboard/usuarios", enabled: true },
        { href: "/dashboard/seguranca", enabled: true },
      ],
      grantsWith("posts"),
      { accessRole: "admin" },
    );

    expect(menu.map((item) => item.href)).toEqual(["/dashboard", "/dashboard/posts"]);
  });

  it("resolves grants from the canonical grants payload only", () => {
    expect(
      resolveGrants({
        id: "legacy-user",
        permissions: ["*", "posts", "usuarios_basico"],
        grants: { posts: true },
      }),
    ).toEqual(grantsWith("posts"));
  });

  it("resolves owner role from ownerIds regardless of persisted accessRole", () => {
    const role = resolveAccessRole({
      id: "u-1",
      accessRole: "admin",
      ownerIds: ["u-1"],
      primaryOwnerId: "u-1",
    });
    expect(role).toBe("owner_primary");
  });

  it("allows post/project helpers from explicit grants and ownerIds only", () => {
    expect(canManagePostsAccess({ id: "grant-user", grants: { posts: true } })).toBe(true);
    expect(canManagePostsAccess({ id: "legacy-post-user", permissions: ["posts"] })).toBe(false);
    expect(canManageProjectsAccess({ id: "grant-user", grants: { projetos: true } })).toBe(true);
    expect(canManageProjectsAccess({ id: "legacy-project-user", permissions: ["projetos"] })).toBe(
      false,
    );
    expect(
      canManageProjectsAccess({
        id: "owner-user",
        ownerIds: ["owner-user"],
        primaryOwnerId: "other-owner",
      }),
    ).toBe(true);
  });
});
