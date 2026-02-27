import { describe, expect, it } from "vitest";

import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotpCode,
} from "../../server/lib/totp.js";

describe("totp", () => {
  it("validates RFC test vector with 6 digits", () => {
    const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const codeAt59s = "287082";
    expect(verifyTotpCode({ secret: rfcSecret, code: codeAt59s, nowMs: 59_000, window: 0 })).toBe(
      true,
    );
    expect(verifyTotpCode({ secret: rfcSecret, code: "000000", nowMs: 59_000, window: 0 })).toBe(
      false,
    );
  });

  it("generates usable secrets and otpauth urls", () => {
    const secret = generateTotpSecret();
    const url = buildOtpAuthUrl({
      issuer: "Nekomata",
      accountName: "user-42",
      secret,
      iconUrl: "https://cdn.nekomata.moe/avatar.png",
    });

    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url.includes("issuer=Nekomata")).toBe(true);
    expect(url.includes("image=https%3A%2F%2Fcdn.nekomata.moe%2Favatar.png")).toBe(true);
  });

  it("normalizes and hashes recovery codes consistently", () => {
    const codeA = normalizeRecoveryCode("abcde-12345");
    const codeB = normalizeRecoveryCode("ABCDE 12345");

    expect(codeA).toBe("ABCDE12345");
    expect(codeA).toBe(codeB);
    expect(hashRecoveryCode({ code: codeA, pepper: "pepper" })).toBe(
      hashRecoveryCode({ code: codeB, pepper: "pepper" }),
    );
  });

  it("creates unique recovery code batch", () => {
    const codes = generateRecoveryCodes({ count: 8 });
    expect(codes.length).toBe(8);
    expect(new Set(codes).size).toBe(8);
  });
});
