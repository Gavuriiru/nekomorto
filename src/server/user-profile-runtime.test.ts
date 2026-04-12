import { describe, expect, it, vi } from "vitest";

import { createUserProfileRuntime } from "../../server/lib/user-profile-runtime.js";

const createDeps = (overrides = {}) => {
  let users = [
    {
      id: "owner-1",
      name: "Owner",
      phrase: "Hello",
      bio: "Bio",
      avatarUrl: "/stored-owner.png",
      avatarDisplay: "circle",
      socials: [{ label: "x" }],
      favoriteWorks: { manga: ["A"] },
      status: "active",
      permissions: ["*"],
      roles: ["admin"],
      accessRole: "owner_secondary",
      order: 0,
    },
  ];

  return {
    AccessRole: {
      NORMAL: "normal",
    },
    addOwnerRoleLabel: (roles, isOwnerUser) => (isOwnerUser ? [...roles, "owner"] : roles),
    computeEffectiveAccessRole: ({ accessRole }) => accessRole || "normal",
    computeGrants: ({ userId, accessRole }) => ({ userId, accessRole }),
    createRevisionToken: (payload) => `revision:${payload.id}:${payload.avatarRenderVersion}`,
    ensureOwnerUser: vi.fn(),
    enforceUserAccessInvariants: (nextUsers) => nextUsers,
    isDiscordAvatarUrl: (value) => String(value || "").includes("cdn.discordapp.com"),
    isOwner: (userId) => String(userId) === "owner-1",
    isRbacV2AcceptLegacyStar: true,
    isRbacV2Enabled: false,
    loadOwnerIds: () => ["owner-1"],
    loadUploads: () => [{ id: "upload-1" }],
    loadUsers: () => users,
    normalizeAvatarDisplay: (value) => String(value || "circle"),
    normalizeUsers: (input) => input,
    permissionsForRead: (permissions) => permissions,
    resolveEffectiveUserAvatarUrl: ({ storedAvatarUrl, fallbackAvatarUrl }) =>
      storedAvatarUrl || fallbackAvatarUrl || null,
    resolveUserAvatarRenderVersion: ({ avatarUrl }) => `render:${String(avatarUrl || "")}`,
    shouldSyncDiscordAvatarToStoredUser: () => true,
    syncAllowedUsers: vi.fn(),
    writeUsers: vi.fn((nextUsers) => {
      users = nextUsers;
    }),
    ...overrides,
  };
};

describe("user-profile-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createUserProfileRuntime()).toThrow(/missing required dependencies/i);
  });

  it("syncs stored discord avatars and updates persisted users", () => {
    const deps = createDeps({
      shouldSyncDiscordAvatarToStoredUser: ({ storedAvatarUrl, discordAvatarUrl }) =>
        storedAvatarUrl !== discordAvatarUrl,
    });
    const runtime = createUserProfileRuntime(deps);

    runtime.syncPersistedDiscordAvatarForLogin({
      userId: "owner-1",
      discordAvatarUrl: "https://cdn.discordapp.com/avatars/owner-1/hash.png?size=128",
    });

    expect(deps.writeUsers).toHaveBeenCalledTimes(1);
    expect(deps.syncAllowedUsers).toHaveBeenCalledTimes(1);
    expect(deps.writeUsers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "owner-1",
        avatarUrl: "https://cdn.discordapp.com/avatars/owner-1/hash.png?size=128",
        permissions: ["*"],
      }),
    ]);
  });

  it("builds user payloads and session revisions with avatar fallbacks", () => {
    const deps = createDeps();
    const runtime = createUserProfileRuntime(deps);
    const req = {
      session: {
        user: {
          id: "owner-1",
          name: "Owner Session",
          avatarUrl: "https://cdn.discordapp.com/avatars/owner-1/session.png?size=128",
        },
      },
    };

    const payload = runtime.buildUserPayload({
      id: "owner-1",
      name: "Owner Session",
      avatarUrl: "https://cdn.discordapp.com/avatars/owner-1/session.png?size=128",
    });

    expect(deps.ensureOwnerUser).toHaveBeenCalledWith(expect.objectContaining({ id: "owner-1" }));
    expect(payload).toEqual(
      expect.objectContaining({
        id: "owner-1",
        accessRole: "owner_secondary",
        avatarUrl: "/stored-owner.png",
        roles: ["admin", "owner"],
        ownerIds: ["owner-1"],
        revision: "revision:owner-1:render:/stored-owner.png",
      }),
    );

    runtime.syncSessionUserDisplayProfile(
      req,
      {
        id: "owner-1",
        name: "Owner Updated",
        phrase: "Updated phrase",
        bio: "Updated bio",
        avatarDisplay: "square",
      },
      [{ id: "upload-2" }],
    );

    expect(req.session.user).toEqual(
      expect.objectContaining({
        name: "Owner Updated",
        phrase: "Updated phrase",
        bio: "Updated bio",
        avatarUrl: "https://cdn.discordapp.com/avatars/owner-1/session.png?size=128",
        avatarDisplay: "square",
        revision:
          "revision:owner-1:render:https://cdn.discordapp.com/avatars/owner-1/session.png?size=128",
      }),
    );
    expect(
      runtime.resolveDiscordAvatarFallbackUrl("https://cdn.discordapp.com/avatars/test.png"),
    ).toBe("https://cdn.discordapp.com/avatars/test.png");
    expect(runtime.withEffectiveAvatarUrl({ id: "u-1", avatarUrl: "" }, "/fallback.png")).toEqual(
      expect.objectContaining({
        avatarUrl: "/fallback.png",
      }),
    );
  });
});
