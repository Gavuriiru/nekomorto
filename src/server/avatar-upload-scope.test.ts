import { describe, expect, it } from "vitest";

import {
  resolveUploadScopeAccess,
  shouldIncludeUploadInHashDedupe,
} from "../../server/lib/avatar-upload-scope.js";

describe("upload scope helpers", () => {
  it("permite usuarios_basico no root users", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        canManageUsersBasic: true,
        folder: "users",
      }),
    ).toEqual({
      allowed: true,
      hasFullAccess: false,
      allowedRoots: ["users"],
    });
  });

  it("permite posts e shared quando o ator pode editar posts", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        canManagePosts: true,
        folder: "posts",
      }),
    ).toEqual({
      allowed: true,
      hasFullAccess: false,
      allowedRoots: ["posts", "shared"],
    });
  });

  it("permite shared quando o ator pode editar paginas", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        canManagePages: true,
        folder: "shared",
      }),
    ).toEqual({
      allowed: true,
      hasFullAccess: false,
      allowedRoots: ["shared"],
    });
  });

  it("permite users no modo self quando scopeUserId coincide com a sessao", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        sessionUserId: "user-1",
        scopeUserId: "user-1",
        folder: "users",
      }),
    ).toEqual({
      allowed: true,
      hasFullAccess: false,
      allowedRoots: ["users"],
    });
  });

  it("bloqueia root fora do escopo permitido", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        canManageUsersBasic: true,
        folder: "projects/projeto-1",
      }),
    ).toEqual({
      allowed: false,
      hasFullAccess: false,
      allowedRoots: ["users"],
    });
  });

  it("permite listagem __all__ restrita aos roots autorizados", () => {
    expect(
      resolveUploadScopeAccess({
        hasUploadManagement: false,
        canManageUsersBasic: true,
        canManagePosts: true,
        listAll: true,
      }),
    ).toEqual({
      allowed: true,
      hasFullAccess: false,
      allowedRoots: ["posts", "users", "shared"],
    });
  });

  it("ignora dedupe fora dos roots autorizados", () => {
    expect(
      shouldIncludeUploadInHashDedupe(
        {
          folder: "posts",
          url: "/uploads/posts/cover.png",
        },
        { hasFullAccess: false, allowedRoots: ["users"] },
      ),
    ).toBe(false);

    expect(
      shouldIncludeUploadInHashDedupe(
        {
          folder: "users",
          url: "/uploads/users/avatar-user-1.png",
        },
        { hasFullAccess: false, allowedRoots: ["users"] },
      ),
    ).toBe(true);
  });
});
