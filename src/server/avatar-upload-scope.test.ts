import { describe, expect, it } from "vitest";

import {
  resolveAvatarUploadScopeAccess,
  shouldIncludeUploadInHashDedupe,
} from "../../server/lib/avatar-upload-scope.js";

describe("avatar upload scope helpers", () => {
  it("permite usuarios_basico no escopo users", () => {
    expect(
      resolveAvatarUploadScopeAccess({
        hasUploadManagement: false,
        hasUsersBasic: true,
        folder: "users",
      }),
    ).toEqual({
      allowed: true,
      limitedToAvatarScope: true,
    });
  });

  it("bloqueia usuarios_basico para listagem global", () => {
    expect(
      resolveAvatarUploadScopeAccess({
        hasUploadManagement: false,
        hasUsersBasic: true,
        folder: "",
        listAll: true,
      }),
    ).toEqual({
      allowed: false,
      limitedToAvatarScope: true,
    });
  });

  it("bloqueia usuarios_basico fora do root users", () => {
    expect(
      resolveAvatarUploadScopeAccess({
        hasUploadManagement: false,
        hasUsersBasic: true,
        folder: "projects/projeto-1",
      }),
    ).toEqual({
      allowed: false,
      limitedToAvatarScope: true,
    });
  });

  it("ignora dedupe fora de users quando o acesso esta limitado ao avatar", () => {
    expect(
      shouldIncludeUploadInHashDedupe(
        {
          folder: "posts",
          url: "/uploads/posts/cover.png",
        },
        { limitedToAvatarScope: true },
      ),
    ).toBe(false);

    expect(
      shouldIncludeUploadInHashDedupe(
        {
          folder: "users",
          url: "/uploads/users/avatar-user-1.png",
        },
        { limitedToAvatarScope: true },
      ),
    ).toBe(true);
  });
});
