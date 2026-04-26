import { describe, expect, it } from "vitest";

import {
  AccessRole,
  can,
  computeEffectiveAccessRole,
  computeGrants,
  defaultPermissionsForRole,
  expandLegacyPermissions,
  PermissionId,
  sanitizePermissionsForStorage,
} from "../../server/lib/authz.js";

describe("authz RBAC V2", () => {
  it("resolve owner primary/secondary by ownerIds + primaryOwnerId", () => {
    const ownerIds = ["owner-1", "owner-2"];
    const primaryOwnerId = "owner-1";

    expect(
      computeEffectiveAccessRole({
        userId: "owner-1",
        accessRole: AccessRole.ADMIN,
        ownerIds,
        primaryOwnerId,
      }),
    ).toBe(AccessRole.OWNER_PRIMARY);

    expect(
      computeEffectiveAccessRole({
        userId: "owner-2",
        accessRole: AccessRole.NORMAL,
        ownerIds,
        primaryOwnerId,
      }),
    ).toBe(AccessRole.OWNER_SECONDARY);
  });

  it("downgrades stale persisted owner role when user is not in ownerIds", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "user-2",
        accessRole: AccessRole.OWNER_SECONDARY,
        ownerIds: ["owner-1"],
        primaryOwnerId: "owner-1",
      }),
    ).toBe(AccessRole.NORMAL);
  });

  it("keeps non-owner persisted roles when user is not in ownerIds", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "admin-1",
        accessRole: AccessRole.ADMIN,
        ownerIds: ["owner-1"],
        primaryOwnerId: "owner-1",
      }),
    ).toBe(AccessRole.ADMIN);
  });

  it("allows owner with explicit empty permissions to keep role while grants stay empty", () => {
    const grants = computeGrants({
      userId: "owner-2",
      accessRole: AccessRole.OWNER_SECONDARY,
      permissions: [],
      ownerIds: ["owner-1", "owner-2"],
      primaryOwnerId: "owner-1",
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(false);
    expect(can({ grants, permissionId: PermissionId.CONFIGURACOES })).toBe(false);
  });

  it("does not allow stale owner role to grant owner defaults after demotion", () => {
    const grants = computeGrants({
      userId: "user-2",
      accessRole: computeEffectiveAccessRole({
        userId: "user-2",
        accessRole: AccessRole.OWNER_SECONDARY,
        ownerIds: ["owner-1"],
        primaryOwnerId: "owner-1",
      }),
      permissions: [],
      ownerIds: ["owner-1"],
      primaryOwnerId: "owner-1",
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(false);
    expect(can({ grants, permissionId: PermissionId.AUDIT_LOG })).toBe(false);
  });

  it("keeps canonical grants for real primary owner", () => {
    const grants = computeGrants({
      userId: "owner-1",
      accessRole: computeEffectiveAccessRole({
        userId: "owner-1",
        accessRole: AccessRole.NORMAL,
        ownerIds: ["owner-1"],
        primaryOwnerId: "owner-1",
      }),
      permissions: defaultPermissionsForRole(AccessRole.OWNER_PRIMARY),
      ownerIds: ["owner-1"],
      primaryOwnerId: "owner-1",
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(true);
    expect(can({ grants, permissionId: PermissionId.CONFIGURACOES })).toBe(true);
  });

  it("keeps canonical grants for real secondary owner", () => {
    const grants = computeGrants({
      userId: "owner-2",
      accessRole: computeEffectiveAccessRole({
        userId: "owner-2",
        accessRole: AccessRole.NORMAL,
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      }),
      permissions: defaultPermissionsForRole(AccessRole.OWNER_SECONDARY),
      ownerIds: ["owner-1", "owner-2"],
      primaryOwnerId: "owner-1",
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(true);
    expect(can({ grants, permissionId: PermissionId.CONFIGURACOES })).toBe(true);
  });

  it("falls back to normal when stale owner role is persisted without owner list", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "user-2",
        accessRole: AccessRole.OWNER_PRIMARY,
        ownerIds: [],
        primaryOwnerId: null,
      }),
    ).toBe(AccessRole.NORMAL);
  });

  it("still honors explicit admin role without owner list", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "admin-1",
        accessRole: AccessRole.ADMIN,
        ownerIds: [],
        primaryOwnerId: null,
      }),
    ).toBe(AccessRole.ADMIN);
  });

  it("resolves real owner even when persisted accessRole is stale normal", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "owner-2",
        accessRole: AccessRole.NORMAL,
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      }),
    ).toBe(AccessRole.OWNER_SECONDARY);
  });

  it("preserves strict no-inheritance grants for normal user after stale owner cleanup", () => {
    const grants = computeGrants({
      userId: "user-1",
      accessRole: computeEffectiveAccessRole({
        userId: "user-1",
        accessRole: AccessRole.OWNER_SECONDARY,
        ownerIds: [],
        primaryOwnerId: null,
      }),
      permissions: [PermissionId.POSTS],
      ownerIds: [],
      primaryOwnerId: null,
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(true);
    expect(can({ grants, permissionId: PermissionId.AUDIT_LOG })).toBe(false);
  });

  it("does not infer owner from grants alone", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "user-1",
        accessRole: AccessRole.NORMAL,
        ownerIds: [],
        primaryOwnerId: null,
      }),
    ).toBe(AccessRole.NORMAL);
  });

  it("keeps explicit normal role as normal", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "user-1",
        accessRole: AccessRole.NORMAL,
        ownerIds: [],
        primaryOwnerId: null,
      }),
    ).toBe(AccessRole.NORMAL);
  });

  it("keeps explicit owner role only when owner list confirms it", () => {
    expect(
      computeEffectiveAccessRole({
        userId: "owner-2",
        accessRole: AccessRole.OWNER_SECONDARY,
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      }),
    ).toBe(AccessRole.OWNER_SECONDARY);
  });

  it("expands legacy '*' and 'usuarios' aliases", () => {
    const expanded = expandLegacyPermissions(["*", "usuarios"], {
      acceptLegacyStar: true,
      keepUnknown: true,
    });

    expect(expanded.knownPermissions).toContain(PermissionId.POSTS);
    expect(expanded.knownPermissions).toContain(PermissionId.USUARIOS);
    expect(expanded.hadLegacyStar).toBe(true);
  });

  it("keeps strict no-inheritance grants in V2", () => {
    const grants = computeGrants({
      userId: "user-1",
      accessRole: AccessRole.NORMAL,
      permissions: [PermissionId.POSTS],
      ownerIds: [],
      primaryOwnerId: null,
      acceptLegacyStar: true,
    });

    expect(can({ grants, permissionId: PermissionId.POSTS })).toBe(true);
    expect(can({ grants, permissionId: PermissionId.COMENTARIOS })).toBe(false);
    expect(can({ grants, permissionId: PermissionId.UPLOADS })).toBe(false);
  });

  it("uses expected admin default package", () => {
    const adminDefaults = defaultPermissionsForRole(AccessRole.ADMIN);
    expect(adminDefaults).toContain(PermissionId.USUARIOS);
    expect(adminDefaults).not.toContain(PermissionId.AUDIT_LOG);
  });

  it("sanitizes storage permissions without expanding legacy star when disabled", () => {
    const sanitized = sanitizePermissionsForStorage(["*", "custom_perm"], {
      acceptLegacyStar: false,
      keepUnknown: true,
    });
    expect(sanitized).toEqual(["*", "custom_perm"]);
  });
});
