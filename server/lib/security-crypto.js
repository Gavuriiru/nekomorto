import crypto from "crypto";

const normalizeText = (value) => String(value || "").trim();

const toBase64 = (value) => Buffer.from(value).toString("base64");

const fromBase64 = (value) => {
  try {
    return Buffer.from(String(value || ""), "base64");
  } catch {
    return Buffer.alloc(0);
  }
};

const parseKeyMaterial = (raw) => {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }
  const decoded = fromBase64(normalized);
  if (decoded.length >= 16) {
    return decoded.length === 32 ? decoded : crypto.createHash("sha256").update(decoded).digest();
  }
  return crypto.createHash("sha256").update(normalized).digest();
};

const normalizeKeyId = (value, fallback = "key-1") => {
  const normalized = normalizeText(value).toLowerCase();
  if (/^[a-z0-9._:-]{2,64}$/.test(normalized)) {
    return normalized;
  }
  return fallback;
};

const parseSessionSecretList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);

export const resolveSessionSecrets = ({ sessionSecretsEnv, sessionSecretFallback } = {}) => {
  const fromMulti = parseSessionSecretList(sessionSecretsEnv);
  if (fromMulti.length > 0) {
    return fromMulti;
  }
  const single = normalizeText(sessionSecretFallback);
  return single ? [single] : [];
};

export const parseDataEncryptionKeyring = ({ dataEncryptionKeysJson, legacySecret } = {}) => {
  const normalized = normalizeText(dataEncryptionKeysJson);
  if (!normalized) {
    const fallbackKey = parseKeyMaterial(legacySecret);
    if (!fallbackKey) {
      return {
        activeKeyId: "key-1",
        keys: {},
      };
    }
    return {
      activeKeyId: "key-1",
      keys: { "key-1": fallbackKey },
    };
  }

  try {
    const parsed = JSON.parse(normalized);
    const sourceKeys = parsed?.keys && typeof parsed.keys === "object" ? parsed.keys : {};
    const keys = {};
    Object.entries(sourceKeys).forEach(([keyId, raw]) => {
      const normalizedKeyId = normalizeKeyId(keyId);
      const material = parseKeyMaterial(raw);
      if (!material) {
        return;
      }
      keys[normalizedKeyId] = material;
    });
    const candidateActive = normalizeKeyId(parsed?.activeKeyId || Object.keys(keys)[0] || "key-1");
    return {
      activeKeyId: candidateActive,
      keys,
    };
  } catch {
    const fallbackKey = parseKeyMaterial(normalized);
    if (!fallbackKey) {
      return { activeKeyId: "key-1", keys: {} };
    }
    return {
      activeKeyId: "key-1",
      keys: { "key-1": fallbackKey },
    };
  }
};

const ensureActiveKey = (keyring) => {
  const activeKeyId = normalizeKeyId(keyring?.activeKeyId || "key-1");
  const key = keyring?.keys?.[activeKeyId];
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    return { key: null, activeKeyId };
  }
  return { key, activeKeyId };
};

export const encryptStringWithKeyring = ({ keyring, plaintext } = {}) => {
  const { key, activeKeyId } = ensureActiveKey(keyring);
  if (!key) {
    throw new Error("encryption_key_unavailable");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${activeKeyId}:${toBase64(iv)}:${toBase64(tag)}:${toBase64(ciphertext)}`;
};

export const decryptStringWithKeyring = ({ keyring, payload } = {}) => {
  const raw = normalizeText(payload);
  if (!raw) {
    return null;
  }
  const parts = raw.split(":");
  if (parts.length !== 5 || parts[0] !== "v1") {
    return null;
  }
  const [, keyIdRaw, ivRaw, tagRaw, ciphertextRaw] = parts;
  const keyId = normalizeKeyId(keyIdRaw);
  const key = keyring?.keys?.[keyId];
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    return null;
  }
  try {
    const iv = fromBase64(ivRaw);
    const tag = fromBase64(tagRaw);
    const ciphertext = fromBase64(ciphertextRaw);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plaintext;
  } catch {
    return null;
  }
};

export const sha256Hex = (value) =>
  crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
