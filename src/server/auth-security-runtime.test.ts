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
    expect(runtime.resolveEnrollmentFromSession({
      req,
      enrollmentToken: "token-1",
      userId: "user-1",
    })).toMatchObject({
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
