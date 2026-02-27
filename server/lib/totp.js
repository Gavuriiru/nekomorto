import crypto from "crypto";
import { sha256Hex } from "./security-crypto.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

const normalizeText = (value) => String(value || "").trim();

const normalizeCode = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();

const encodeBase32 = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const decodeBase32 = (input) => {
  const clean = normalizeText(input).toUpperCase().replace(/=+$/g, "");
  if (!clean) {
    return Buffer.alloc(0);
  }
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const computeTotp = ({ secretBuffer, counter, digits = TOTP_DIGITS } = {}) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binaryCode % 10 ** digits;
  return String(otp).padStart(digits, "0");
};

const currentCounter = (nowMs = Date.now(), stepSeconds = TOTP_PERIOD_SECONDS) =>
  Math.floor(nowMs / 1000 / stepSeconds);

export const generateTotpSecret = ({ bytes = 20 } = {}) => {
  const size = Number.isFinite(Number(bytes)) ? Math.min(Math.max(Math.floor(bytes), 10), 64) : 20;
  return encodeBase32(crypto.randomBytes(size));
};

export const buildOtpAuthUrl = ({ issuer, accountName, secret, iconUrl } = {}) => {
  const safeIssuer = normalizeText(issuer || "Nekomata");
  const safeAccountName = normalizeText(accountName || "user");
  const safeSecret = normalizeText(secret).toUpperCase();
  const safeIconUrl = normalizeText(iconUrl);
  const label = encodeURIComponent(`${safeIssuer}:${safeAccountName}`);
  const params = new URLSearchParams({
    secret: safeSecret,
    issuer: safeIssuer,
    period: String(TOTP_PERIOD_SECONDS),
    digits: String(TOTP_DIGITS),
    algorithm: "SHA1",
  });
  if (safeIconUrl) {
    params.set("image", safeIconUrl);
    params.set("icon", safeIconUrl);
  }
  return `otpauth://totp/${label}?${params.toString()}`;
};

export const verifyTotpCode = ({ secret, code, window = 1, nowMs = Date.now() } = {}) => {
  const normalizedCode = normalizeCode(code);
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }
  const secretBuffer = decodeBase32(secret);
  if (secretBuffer.length < 10) {
    return false;
  }
  const baseCounter = currentCounter(nowMs, TOTP_PERIOD_SECONDS);
  const safeWindow = Number.isFinite(Number(window)) ? Math.min(Math.max(Math.floor(window), 0), 5) : 1;
  for (let offset = -safeWindow; offset <= safeWindow; offset += 1) {
    const expected = computeTotp({
      secretBuffer,
      counter: baseCounter + offset,
      digits: TOTP_DIGITS,
    });
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedCode))) {
      return true;
    }
  }
  return false;
};

export const normalizeRecoveryCode = (value) =>
  normalizeCode(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const hashRecoveryCode = ({ code, pepper = "" } = {}) => {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) {
    return "";
  }
  return sha256Hex(`${pepper}:${normalized}`);
};

export const generateRecoveryCodes = ({ count = 8 } = {}) => {
  const safeCount = Number.isFinite(Number(count)) ? Math.min(Math.max(Math.floor(count), 4), 20) : 8;
  const set = new Set();
  while (set.size < safeCount) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${code.slice(0, 5)}-${code.slice(5, 10)}`;
    set.add(formatted);
  }
  return Array.from(set);
};
