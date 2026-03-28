const clampColorChannel = (value) => Math.min(255, Math.max(0, Math.round(Number(value) || 0)));

export const normalizeHex = (value) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return "";
  }
  if (cleaned.length === 3) {
    return `#${cleaned
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  return `#${cleaned.toLowerCase()}`;
};

export const hexToRgb = (value) => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

export const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clampColorChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;

export const mixHexColors = (startHex, endHex, amount, fallback = "") => {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  if (!start || !end) {
    return normalizeHex(startHex) || normalizeHex(endHex) || normalizeHex(fallback);
  }
  const safeAmount = Math.min(1, Math.max(0, Number(amount) || 0));
  return rgbToHex({
    r: start.r + (end.r - start.r) * safeAmount,
    g: start.g + (end.g - start.g) * safeAmount,
    b: start.b + (end.b - start.b) * safeAmount,
  });
};
