const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const trimTrailingZeros = (value: string) => value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");

export const parseHumanSizeToBytes = (input: string): number | null => {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = String(match[2] || "B").toUpperCase();
  const factor = SIZE_UNITS[unit];
  if (!factor) {
    return null;
  }

  const bytes = Math.round(amount * factor);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  return bytes;
};

export const formatBytesCompact = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${trimTrailingZeros(value.toFixed(decimals))} ${units[unitIndex]}`;
};

