import crypto from "crypto";

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
      .sort((a, b) => a.localeCompare(b, "en"));
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
};

export const createRevisionToken = (value) =>
  crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");

