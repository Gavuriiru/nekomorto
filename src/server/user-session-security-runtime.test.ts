import { describe, expect, it, vi } from "vitest";

import { createUserSessionSecurityRuntime } from "../../server/lib/user-session-security-runtime.js";

const createDeps = (overrides = {}) => {
  let mfaRecords = {
    "user-1": {
      enabledAt: "2026-03-28T10:00:00.000Z",
      secretEncrypted: "encrypted:secret",
    },
  };
  let sessionRecords = [
    {
      sid: "sid-1",
      userId: "user-1",
      lastSeenAt: "2026-03-28T12:00:00.000Z",
      revokedAt: null,
    },
    {
      sid: "sid-2",
      userId: "user-1",
      lastSeenAt: "2026-03-28T11:00:00.000Z",
      revokedAt: "2026-03-28T11:30:00.000Z",
    },
    {
      sid: "sid-3",
      userId: "user-1",
      lastSeenAt: "2026-03-28T13:00:00.000Z",
      revokedAt: null,
    },
  ];

  return {
    dataEncryptionKeyring: { currentKeyId: "key-1" },
    dataRepository: {
      loadUserMfaTotpRecord: vi.fn((userId) => mfaRecords[userId] ?? null),
      writeUserMfaTotpRecord: vi.fn((userId, record) => {
        mfaRecords[userId] = record;
      }),
      deleteUserMfaTotpRecord: vi.fn((userId) => {
        delete mfaRecords[userId];
      }),
      loadUserSessionIndexRecords: vi.fn(({ userId = null, includeRevoked = true } = {}) =>
        sessionRecords.filter((record) => {
          if (userId && record.userId !== userId) {
            return false;
          }
          if (!includeRevoked && record.revokedAt) {
            return false;
          }
          return true;
        }),
      ),
      upsertUserSessionIndexRecord: vi.fn((record) => {
        sessionRecords = [...sessionRecords.filter((item) => item.sid !== record.sid), record];
      }),
      revokeUserSessionIndexRecord: vi.fn((sid, options = {}) => {
        sessionRecords = sessionRecords.map((record) =>
          record.sid === sid
            ? {
                ...record,
                revokedAt: "2026-03-28T14:00:00.000Z",
                revokedBy: options.revokedBy ?? null,
                revokeReason: options.revokeReason ?? null,
              }
            : record,
        );
      }),
      removeUserSessionIndexRecord: vi.fn((sid) => {
        sessionRecords = sessionRecords.filter((record) => record.sid !== sid);
      }),
    },
    decryptStringWithKeyring: vi.fn(({ payload }) =>
      payload === "encrypted:secret" ? JSON.stringify({ secret: " abcd1234 " }) : "",
    ),
    metricsRegistry: {
      inc: vi.fn(),
    },
    sessionStore: {
      destroy: vi.fn((_sid, callback) => callback()),
    },
    __getMfaRecords: () => mfaRecords,
    __getSessionRecords: () => sessionRecords,
    ...overrides,
  };
};

describe("user-session-security-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createUserSessionSecurityRuntime()).toThrow(/missing required dependencies/i);
  });

  it("reads, writes and deletes MFA records", () => {
    const deps = createDeps();
    const runtime = createUserSessionSecurityRuntime(deps);

    expect(runtime.loadUserMfaTotpRecord("user-1")).toEqual(
      expect.objectContaining({
        secretEncrypted: "encrypted:secret",
      }),
    );
    expect(
      runtime.writeUserMfaTotpRecord("user-1", {
        enabledAt: "2026-03-28T15:00:00.000Z",
        secretEncrypted: "encrypted:new",
      }),
    ).toEqual({
      enabledAt: "2026-03-28T15:00:00.000Z",
      secretEncrypted: "encrypted:new",
    });

    runtime.deleteUserMfaTotpRecord("user-1");
    expect(deps.__getMfaRecords()["user-1"]).toBeUndefined();
  });

  it("resolves TOTP enablement and decrypts normalized secrets", () => {
    const runtime = createUserSessionSecurityRuntime(createDeps());

    expect(runtime.isTotpEnabledForUser("user-1")).toBe(true);
    expect(runtime.getUserTotpSecret("user-1")).toBe("ABCD1234");
    expect(runtime.getUserTotpSecret("unknown")).toBeNull();
  });

  it("lists active sessions sorted by most recent activity", () => {
    const runtime = createUserSessionSecurityRuntime(createDeps());

    expect(runtime.listActiveSessionsForUser("user-1")).toEqual([
      expect.objectContaining({ sid: "sid-3" }),
      expect.objectContaining({ sid: "sid-1" }),
    ]);
    expect(
      runtime.loadUserSessionIndexRecords({ userId: "user-1", includeRevoked: true }),
    ).toHaveLength(3);
  });

  it("revokes a session by sid and updates metrics", async () => {
    const deps = createDeps();
    const runtime = createUserSessionSecurityRuntime(deps);

    await expect(
      runtime.revokeSessionBySid({
        sid: "sid-3",
        revokedBy: "owner-1",
        revokeReason: "manual_revoke",
      }),
    ).resolves.toBe(true);

    expect(deps.sessionStore.destroy).toHaveBeenCalledWith("sid-3", expect.any(Function));
    expect(deps.dataRepository.revokeUserSessionIndexRecord).toHaveBeenCalledWith("sid-3", {
      revokedBy: "owner-1",
      revokeReason: "manual_revoke",
    });
    expect(deps.metricsRegistry.inc).toHaveBeenCalledWith("active_sessions_total", {}, -1);
  });
});
