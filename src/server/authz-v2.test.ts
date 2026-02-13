import { describe, expect, it } from "vitest";

import {
  AccessRole,
  PermissionId,
  can,
  computeEffectiveAccessRole,
  computeGrants,
  defaultPermissionsForRole,
  expandLegacyPermissions,
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

  it("expands legacy '*' and 'usuarios' aliases", () => {
    const expanded = expandLegacyPermissions(["*", "usuarios"], {
      acceptLegacyStar: true,
      keepUnknown: true,
    });

    expect(expanded.knownPermissions).toContain(PermissionId.POSTS);
    expect(expanded.knownPermissions).toContain(PermissionId.USUARIOS_BASICO);
    expect(expanded.knownPermissions).toContain(PermissionId.USUARIOS_ACESSO);
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
    expect(adminDefaults).toContain(PermissionId.USUARIOS_BASICO);
    expect(adminDefaults).not.toContain(PermissionId.USUARIOS_ACESSO);
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
