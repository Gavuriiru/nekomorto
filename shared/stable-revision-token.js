const stableSerialize = (value) => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => key !== "revision")
      .sort((left, right) => left.localeCompare(right, "en"));
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
};

const FNV_OFFSET_BASIS = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const FNV_MASK = BigInt("0xffffffffffffffff");

export const createStableRevisionToken = (value) => {
  const serialized = stableSerialize(value);
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return hash.toString(16).padStart(16, "0");
};

export const stableRevisionSerialize = stableSerialize;
