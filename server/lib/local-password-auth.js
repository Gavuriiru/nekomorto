import crypto from "crypto";

const SCRYPT_KEYLEN = 64;
const DEFAULT_SCRYPT_COST = 16384;
const DEFAULT_SCRYPT_BLOCK_SIZE = 8;
const DEFAULT_SCRYPT_PARALLELIZATION = 1;
const DEFAULT_SCRYPT_MAXMEM = 32 * 1024 * 1024;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const normalizeIdentifier = (value) => String(value || "").trim();

export const normalizeEmailIdentifier = (value) => normalizeIdentifier(value).toLowerCase();

export const normalizeUsernameIdentifier = (value) => normalizeIdentifier(value).toLowerCase();

export const isEmailLikeIdentifier = (value) => normalizeIdentifier(value).includes("@");

export const resolvePasswordIdentifierType = (value) =>
  isEmailLikeIdentifier(value) ? "email" : "username";

export const normalizePasswordIdentifier = (value) =>
  resolvePasswordIdentifierType(value) === "email"
    ? normalizeEmailIdentifier(value)
    : normalizeUsernameIdentifier(value);

export const buildLocalAuthLookup = (value) => {
  const identifierNormalized = normalizePasswordIdentifier(value);
  if (!identifierNormalized) {
    return null;
  }
  const identifierType = resolvePasswordIdentifierType(value);
  return {
    identifierType,
    identifierNormalized,
    emailNormalized: identifierType === "email" ? identifierNormalized : null,
    usernameNormalized: identifierType === "username" ? identifierNormalized : null,
  };
};

export const buildLocalAuthWhereClause = (value) => {
  const lookup = buildLocalAuthLookup(value);
  if (!lookup) {
    return null;
  }
  return lookup.identifierType === "email"
    ? { emailNormalized: lookup.emailNormalized }
    : { usernameNormalized: lookup.usernameNormalized };
};

const getScryptOptions = () => ({
  N: toPositiveInt(process.env.AUTH_PASSWORD_SCRYPT_COST, DEFAULT_SCRYPT_COST),
  r: toPositiveInt(process.env.AUTH_PASSWORD_SCRYPT_BLOCK_SIZE, DEFAULT_SCRYPT_BLOCK_SIZE),
  p: toPositiveInt(
    process.env.AUTH_PASSWORD_SCRYPT_PARALLELIZATION,
    DEFAULT_SCRYPT_PARALLELIZATION,
  ),
  maxmem: toPositiveInt(process.env.AUTH_PASSWORD_SCRYPT_MAXMEM, DEFAULT_SCRYPT_MAXMEM),
});

const scryptAsync = (password, salt, options) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });

const serializePasswordHash = ({ salt, hash, options }) =>
  [
    "scrypt",
    `n=${options.N}`,
    `r=${options.r}`,
    `p=${options.p}`,
    `maxmem=${options.maxmem}`,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");

const parsePasswordHash = (value) => {
  const parts = String(value || "").trim().split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt") {
    return null;
  }
  const [, nPart, rPart, pPart, maxmemPart, saltB64, hashB64] = parts;
  const options = {
    N: toPositiveInt(nPart.split("=")[1], 0),
    r: toPositiveInt(rPart.split("=")[1], 0),
    p: toPositiveInt(pPart.split("=")[1], 0),
    maxmem: toPositiveInt(maxmemPart.split("=")[1], 0),
  };
  if (!options.N || !options.r || !options.p || !options.maxmem) {
    return null;
  }
  try {
    const salt = Buffer.from(saltB64, "base64");
    const hash = Buffer.from(hashB64, "base64");
    if (!salt.length || !hash.length) {
      return null;
    }
    return { options, salt, hash };
  } catch {
    return null;
  }
};

export const hashLocalPassword = async (password) => {
  const normalizedPassword = String(password || "");
  if (!normalizedPassword) {
    throw new Error("password_required");
  }
  const options = getScryptOptions();
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(normalizedPassword, salt, options);
  return serializePasswordHash({ salt, hash, options });
};

export const verifyLocalPassword = async (password, serializedHash) => {
  const parsed = parsePasswordHash(serializedHash);
  if (!parsed) {
    return false;
  }
  const candidate = await scryptAsync(String(password || ""), parsed.salt, parsed.options);
  if (!Buffer.isBuffer(candidate) || candidate.length !== parsed.hash.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(candidate, parsed.hash);
  } catch {
    return false;
  }
};

export const normalizeStoredLocalAuthRecord = (record) => {
  const userId = String(record?.userId || "").trim();
  if (!userId) {
    return null;
  }
  return {
    userId,
    emailNormalized: record?.emailNormalized ? normalizeEmailIdentifier(record.emailNormalized) : null,
    usernameNormalized: record?.usernameNormalized
      ? normalizeUsernameIdentifier(record.usernameNormalized)
      : null,
    passwordHash: String(record?.passwordHash || ""),
    passwordUpdatedAt: String(record?.passwordUpdatedAt || "").trim() || null,
    disabledAt: record?.disabledAt ? String(record.disabledAt).trim() : null,
    createdAt: String(record?.createdAt || "").trim() || null,
    updatedAt: String(record?.updatedAt || "").trim() || null,
  };
};

export const isActiveLocalAuthRecord = (record) =>
  Boolean(record?.userId && !record?.disabledAt && record?.passwordHash);

export const buildStoredLocalAuthRecord = ({ userId, identifier, passwordHash, disabledAt = null } = {}) => {
  const lookup = buildLocalAuthLookup(identifier);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !lookup || !String(passwordHash || "").trim()) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    userId: normalizedUserId,
    emailNormalized: lookup.emailNormalized,
    usernameNormalized: lookup.usernameNormalized,
    passwordHash: String(passwordHash || "").trim(),
    passwordUpdatedAt: now,
    disabledAt: disabledAt ? String(disabledAt).trim() : null,
    createdAt: now,
    updatedAt: now,
  };
};

export const toLocalAuthPublicShape = (record) =>
  record
    ? {
        userId: record.userId,
        emailNormalized: record.emailNormalized || null,
        usernameNormalized: record.usernameNormalized || null,
        passwordUpdatedAt: record.passwordUpdatedAt || null,
        disabledAt: record.disabledAt || null,
      }
    : null;

export const buildPasswordAuditMeta = (identifier) => ({
  identifierType: buildLocalAuthLookup(identifier)?.identifierType || null,
});

export default {
  buildLocalAuthLookup,
  buildLocalAuthWhereClause,
  buildPasswordAuditMeta,
  buildStoredLocalAuthRecord,
  hashLocalPassword,
  isActiveLocalAuthRecord,
  isEmailLikeIdentifier,
  normalizeEmailIdentifier,
  normalizePasswordIdentifier,
  normalizeStoredLocalAuthRecord,
  normalizeUsernameIdentifier,
  resolvePasswordIdentifierType,
  toLocalAuthPublicShape,
  verifyLocalPassword,
};
