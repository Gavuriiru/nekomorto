import { describe, expect, it, vi } from "vitest";

import { createAuthSecurityRuntime } from "../../server/lib/auth-security-runtime.js";

const createDeps = (overrides = {}) => ({
  authFailedBurstCritical: { threshold: 20, windowMs: 15 * 60 * 1000 },
  authFailedBurstWarning: { threshold: 8, windowMs: 5 * 60 * 1000 },
  authFailedByIpCounter: {
    record: () => ({ count: 0 }),
    count: () => 0,
  },
  buildOtpAuthUrl: () => "otpauth://default",
  createEnrollmentToken: () => "token-default",
  emitSecurityEvent: vi.fn(),
  excessiveSessionsWarning: 7,
  generateTotpSecret: () => "secret-default",
  getIpv4Network24: () => "",
  getRequestIp: () => "127.0.0.1",
  getUserTotpSecret: () => "",
  hashRecoveryCode: ({ code }) => `hash-${String(code || "").toLowerCase()}`,
  listActiveSessionsForUser: () => [],
  loadSiteSettings: () => ({ site: { faviconUrl: "/favicon.png" } }),
  loadUserIdentityRecords: () => [],
  loadUserLocalAuthRecord: () => null,
  loadUserMfaTotpRecord: () => null,
  loadUserSessionIndexRecords: () => [],
  metricsRegistry: {
    inc: vi.fn(),
  },
  mfaEnrollmentTtlMs: 10 * 60 * 1000,
  mfaFailedBurstWarning: { threshold: 5, windowMs: 10 * 60 * 1000 },
  mfaFailedByUserCounter: {
    record: () => ({ count: 0 }),
  },
  mfaIconUrl: "",
  mfaIssuer: "Nekomata",
  mfaRecoveryCodePepper: "pepper",
  newNetworkLookbackMs: 30 * 24 * 60 * 60 * 1000,
  primaryAppOrigin: "https://example.com",
  sanitizeAssetUrl: (value) => String(value || "").trim(),
  securityEventSeverity: {
    WARNING: "warning",
    CRITICAL: "critical",
  },
  sessionIndexTouchMinIntervalMs: 30 * 1000,
  sessionIndexTouchTsBySid: new Map(),
  shouldEmitSecurityRuleEvent: () => true,
  upsertUserSessionIndexRecord: vi.fn(),
  verifyTotpCode: () => false,
  writeUserLocalAuthRecord: vi.fn(),
  writeUserMfaTotpRecord: vi.fn(),
  ...overrides,
});

describe("auth-security-runtime", () => {
  it("starts and resolves TOTP enrollment from the session", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        buildOtpAuthUrl: () => "otpauth://generated",
        createEnrollmentToken: () => "token-1",
        generateTotpSecret: () => "secret-1",
      }),
    );
    const req = { session: {} };

    const enrollment = runtime.startTotpEnrollment({
      req,
      userId: "user-1",
      accountName: "User One",
      issuer: "Issuer",
      iconUrl: "/avatar.png",
    });

    expect(enrollment).toEqual({
      enrollmentToken: "token-1",
      secret: "secret-1",
      otpauthUrl: "otpauth://generated",
    });
    expect(
      runtime.resolveEnrollmentFromSession({
        req,
        enrollmentToken: "token-1",
        userId: "user-1",
      }),
    ).toMatchObject({
      token: "token-1",
      secret: "secret-1",
      userId: "user-1",
    });
  });

  it("consumes matching recovery codes and persists the remaining set", () => {
    let record = {
      recoveryCodesHashed: ["hash-alpha", "hash-beta"],
      enabledAt: "2026-01-01T00:00:00.000Z",
    };
    const writeUserMfaTotpRecord = vi.fn((userId, nextRecord) => {
      expect(userId).toBe("user-1");
      record = nextRecord;
    });
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserMfaTotpRecord: () => record,
        writeUserMfaTotpRecord,
      }),
    );

    const result = runtime.verifyTotpOrRecoveryCode({
      userId: "user-1",
      codeOrRecoveryCode: "alpha",
    });

    expect(result).toEqual({
      ok: true,
      method: "recovery_code",
      remainingRecoveryCodes: 1,
    });
    expect(writeUserMfaTotpRecord).toHaveBeenCalledTimes(1);
    expect(record.recoveryCodesHashed).toEqual(["hash-beta"]);
  });

  it("requires TOTP enrollment only when local auth has an explicit pending requirement", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: "2026-04-21T12:00:00.000Z",
        }),
        loadUserMfaTotpRecord: () => null,
      }),
    );

    expect(runtime.shouldRequireTotpEnrollmentForPasswordLogin("user-1")).toBe(true);
  });

  it("does not require TOTP enrollment for users without an explicit local auth pending requirement", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: null,
        }),
        loadUserMfaTotpRecord: () => null,
      }),
    );

    expect(runtime.shouldRequireTotpEnrollmentForPasswordLogin("user-1")).toBe(false);
  });

  it("builds security summary with oauth email suggestion and separated local auth identifiers", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "fallback@example.com",
            emailVerified: false,
            updatedAt: "2026-04-20T10:00:00.000Z",
          },
          {
            provider: "google",
            emailNormalized: "user@example.com",
            emailVerified: true,
            updatedAt: "2026-04-21T10:00:00.000Z",
          },
        ],
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          usernameNormalized: "userone",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: null,
        }),
        loadUserMfaTotpRecord: () => null,
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "user@example.com",
      localAuthEmail: "user@example.com",
      localAuthUsername: "userone",
      localAuthIdentifier: "user@example.com",
    });
  });

  it("prefers the most recent verified oauth email when building security summary", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "google",
            emailNormalized: "older@example.com",
            emailVerified: true,
            updatedAt: "2026-04-20T10:00:00.000Z",
          },
          {
            provider: "discord",
            emailNormalized: "newer@example.com",
            emailVerified: true,
            updatedAt: "2026-04-21T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "newer@example.com",
    });
  });

  it("falls back to the most recent unverified oauth email when no verified email exists", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "older@example.com",
            emailVerified: false,
            updatedAt: "2026-04-20T10:00:00.000Z",
          },
          {
            provider: "google",
            emailNormalized: "newer@example.com",
            emailVerified: false,
            updatedAt: "2026-04-21T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "newer@example.com",
    });
  });

  it("returns null oauth email suggestion when identities do not provide email", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: null,
            emailVerified: true,
            updatedAt: "2026-04-21T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: null,
    });
  });

  it("marks local auth pending only when local auth requires totp and totp is still disabled", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: "2026-04-21T12:00:00.000Z",
        }),
        loadUserMfaTotpRecord: () => ({
          enabledAt: null,
          disabledAt: null,
          recoveryCodesHashed: [],
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthTotpPending: true,
    });
  });

  it("does not mark local auth pending when totp is already enabled", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: "2026-04-21T12:00:00.000Z",
        }),
        loadUserMfaTotpRecord: () => ({
          enabledAt: "2026-04-21T12:05:00.000Z",
          disabledAt: null,
          recoveryCodesHashed: [],
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthTotpPending: false,
    });
  });

  it("returns null local auth fields when local auth is not configured", () => {
    const runtime = createAuthSecurityRuntime(createDeps());

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEmail: null,
      localAuthUsername: null,
      localAuthIdentifier: null,
    });
  });

  it("uses username as compatibility identifier when local auth has no email", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: null,
          usernameNormalized: "userone",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEmail: null,
      localAuthUsername: "userone",
      localAuthIdentifier: "userone",
    });
  });

  it("prefers local auth email over username in compatibility identifier", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          usernameNormalized: "userone",
          passwordHash: "hash",
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthIdentifier: "user@example.com",
    });
  });

  it("reports local auth enabled only when password hash exists and record is active", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          usernameNormalized: "userone",
          passwordHash: "",
          disabledAt: null,
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEnabled: false,
    });
  });

  it("reports local auth disabled when record is disabled", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          usernameNormalized: "userone",
          passwordHash: "hash",
          disabledAt: "2026-04-21T12:00:00.000Z",
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEnabled: false,
    });
  });

  it("reports local auth enabled when active password hash exists", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: "user@example.com",
          usernameNormalized: "userone",
          passwordHash: "hash",
          disabledAt: null,
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEnabled: true,
    });
  });

  it("returns no oauth suggestion when identity loader is absent or empty", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: null,
    });
  });

  it("keeps local auth compatibility identifier null when no local identifiers exist", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserLocalAuthRecord: () => ({
          userId: "user-1",
          emailNormalized: null,
          usernameNormalized: null,
          passwordHash: "hash",
          disabledAt: null,
          totpEnrollmentRequiredAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthIdentifier: null,
    });
  });

  it("ignores disabled identities when summarizing oauth email", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "google",
            emailNormalized: "user@example.com",
            emailVerified: true,
            disabledAt: "2026-04-21T12:00:00.000Z",
            updatedAt: "2026-04-21T12:00:00.000Z",
          },
          {
            provider: "discord",
            emailNormalized: "fallback@example.com",
            emailVerified: false,
            updatedAt: "2026-04-20T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "fallback@example.com",
    });
  });

  it("accepts identity records ordered with verified email taking priority over recency", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "newer-unverified@example.com",
            emailVerified: false,
            updatedAt: "2026-04-21T12:00:00.000Z",
          },
          {
            provider: "google",
            emailNormalized: "older-verified@example.com",
            emailVerified: true,
            updatedAt: "2026-04-20T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "older-verified@example.com",
    });
  });

  it("uses lastUsedAt before updatedAt when picking oauth email suggestion", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "updated@example.com",
            emailVerified: true,
            updatedAt: "2026-04-21T11:00:00.000Z",
          },
          {
            provider: "google",
            emailNormalized: "lastused@example.com",
            emailVerified: true,
            lastUsedAt: "2026-04-21T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "lastused@example.com",
    });
  });

  it("uses linkedAt when other oauth identity timestamps are absent", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "linked@example.com",
            emailVerified: true,
            linkedAt: "2026-04-21T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "linked@example.com",
    });
  });

  it("treats malformed oauth timestamps as lowest priority", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          {
            provider: "discord",
            emailNormalized: "bad-ts@example.com",
            emailVerified: true,
            updatedAt: "not-a-date",
          },
          {
            provider: "google",
            emailNormalized: "good-ts@example.com",
            emailVerified: true,
            updatedAt: "2026-04-21T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: "good-ts@example.com",
    });
  });

  it("does not expose oauth suggestion when every email value is empty", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserIdentityRecords: () => [
          { provider: "discord", emailNormalized: "", emailVerified: true },
          { provider: "google", emailNormalized: null, emailVerified: true },
        ],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      oauthEmailSuggested: null,
    });
  });

  it("keeps active session count in security summary", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        listActiveSessionsForUser: () => [{ sid: "1" }, { sid: "2" }],
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      activeSessionsCount: 2,
    });
  });

  it("keeps recovery code count in security summary", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserMfaTotpRecord: () => ({
          recoveryCodesHashed: ["a", "b", ""],
          enabledAt: "2026-04-21T12:00:00.000Z",
          disabledAt: null,
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      recoveryCodesRemaining: 2,
      totpEnabled: true,
    });
  });

  it("marks totp disabled in summary when mfa record is disabled", () => {
    const runtime = createAuthSecurityRuntime(
      createDeps({
        loadUserMfaTotpRecord: () => ({
          recoveryCodesHashed: [],
          enabledAt: "2026-04-21T12:00:00.000Z",
          disabledAt: "2026-04-21T12:10:00.000Z",
        }),
      }),
    );

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      totpEnabled: false,
    });
  });

  it("preserves issuer and account label metadata in summary", () => {
    const runtime = createAuthSecurityRuntime(createDeps());
    expect(runtime.buildMySecuritySummary({ req: { session: { user: { username: "userone" } } }, userId: "user-1" })).toMatchObject({
      issuer: "Nekomata",
      accountLabel: "userone",
    });
  });

  it("exposes icon url metadata in summary", () => {
    const runtime = createAuthSecurityRuntime(createDeps());
    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      iconUrl: "https://example.com/favicon.png",
    });
  });

  it("returns false local auth pending when there is no local auth record", () => {
    const runtime = createAuthSecurityRuntime(createDeps());

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthTotpPending: false,
    });
  });

  it("returns false local auth enabled when there is no local auth record", () => {
    const runtime = createAuthSecurityRuntime(createDeps());

    expect(runtime.buildMySecuritySummary({ req: { session: {} }, userId: "user-1" })).toMatchObject({
      localAuthEnabled: false,
    });
  });

  it("throttles session index updates by SID touch interval", () => {
    const upsertUserSessionIndexRecord = vi.fn();
    const runtime = createAuthSecurityRuntime(
      createDeps({
        sessionIndexTouchTsBySid: new Map(),
        upsertUserSessionIndexRecord,
      }),
    );
    const req = {
      sessionID: "sid-1",
      session: {
        user: { id: "user-1" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      headers: {
        "user-agent": "Vitest",
      },
    };

    runtime.updateSessionIndexFromRequest(req);
    runtime.updateSessionIndexFromRequest(req);

    expect(upsertUserSessionIndexRecord).toHaveBeenCalledTimes(1);
    expect(upsertUserSessionIndexRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        sid: "sid-1",
        userId: "user-1",
        isPendingMfa: false,
      }),
    );
  });
});
