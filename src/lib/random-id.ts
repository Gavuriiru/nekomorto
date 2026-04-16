let fallbackCounter = 0;

const normalizePrefix = (prefix: string) => {
  const normalized = String(prefix || "id")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "id";
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export const createRandomId = (prefix = "id") => {
  const safePrefix = normalizePrefix(prefix);
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${safePrefix}-${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    return `${safePrefix}-${bytesToHex(bytes)}`;
  }
  fallbackCounter += 1;
  return `${safePrefix}-fallback-${fallbackCounter.toString(36)}`;
};
