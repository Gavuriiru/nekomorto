import { describe, expect, it } from "vitest";

import {
  decryptStringWithKeyring,
  encryptStringWithKeyring,
  parseDataEncryptionKeyring,
  resolveSessionSecrets,
} from "../../server/lib/security-crypto.js";

describe("security-crypto", () => {
  it("resolves rotated session secrets from env list", () => {
    expect(
      resolveSessionSecrets({
        sessionSecretsEnv: "new-secret, old-secret",
        sessionSecretFallback: "fallback-secret",
      }),
    ).toEqual(["new-secret", "old-secret"]);
  });

  it("falls back to single SESSION_SECRET when list is empty", () => {
    expect(
      resolveSessionSecrets({
        sessionSecretsEnv: "",
        sessionSecretFallback: "fallback-secret",
      }),
    ).toEqual(["fallback-secret"]);
  });

  it("parses keyring from DATA_ENCRYPTION_KEYS_JSON and round-trips payloads", () => {
    const raw = Buffer.alloc(32, 7).toString("base64");
    const keyring = parseDataEncryptionKeyring({
      dataEncryptionKeysJson: JSON.stringify({
        activeKeyId: "key-2026-02",
        keys: {
          "key-2026-02": raw,
        },
      }),
    });

    const encrypted = encryptStringWithKeyring({
      keyring,
      plaintext: "mfa-secret-value",
    });
    const decrypted = decryptStringWithKeyring({ keyring, payload: encrypted });

    expect(keyring.activeKeyId).toBe("key-2026-02");
    expect(typeof encrypted).toBe("string");
    expect(decrypted).toBe("mfa-secret-value");
  });

  it("returns null when decrypting payload with unknown key id", () => {
    const keyring = parseDataEncryptionKeyring({
      dataEncryptionKeysJson: JSON.stringify({
        activeKeyId: "key-a",
        keys: { "key-a": Buffer.alloc(32, 1).toString("base64") },
      }),
    });
    const encrypted = encryptStringWithKeyring({ keyring, plaintext: "hello" });
    const tampered = encrypted.replace("v1:key-a:", "v1:key-b:");
    expect(decryptStringWithKeyring({ keyring, payload: tampered })).toBeNull();
  });
});
