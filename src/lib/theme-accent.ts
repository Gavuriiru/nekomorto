const DEFAULT_PRIMARY_FOREGROUND = "0 0% 100%";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const hexToHsl = (hex: string) => {
  const cleaned = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }
  const expanded =
    cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const parseHslToken = (value: string) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    return null;
  }
  return {
    h: Number(match[1]),
    s: Number(match[2]) / 100,
    l: Number(match[3]) / 100,
  };
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }) => {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray] as const;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(1 / 3) * 255),
    Math.round(channel(0) * 255),
    Math.round(channel(-1 / 3) * 255),
  ] as const;
};

const relativeLuminance = (rgb: readonly [number, number, number]) => {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb.map(normalize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundHsl = parseHslToken(foreground);
  const backgroundHsl = parseHslToken(background);
  if (!foregroundHsl || !backgroundHsl) {
    return 0;
  }
  const luminanceA = relativeLuminance(hslToRgb(foregroundHsl));
  const luminanceB = relativeLuminance(hslToRgb(backgroundHsl));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
};

const pickReadableForeground = (background: string) => {
  const darkForeground = "224 41% 12%";
  const lightForeground = DEFAULT_PRIMARY_FOREGROUND;
  return contrastRatio(darkForeground, background) >= contrastRatio(lightForeground, background)
    ? darkForeground
    : lightForeground;
};

export const deriveThemeAccentTokens = (accentHex: string) => {
  const accent = hexToHsl(accentHex);
  if (!accent) {
    return null;
  }
  const primaryValue = `${accent.h} ${accent.s}% ${accent.l}%`;
  const accentValue = `${accent.h} ${clamp(accent.s - 10, 0, 100)}% ${clamp(
    accent.l + 6,
    0,
    100,
  )}%`;
  return {
    primary: primaryValue,
    ring: primaryValue,
    sidebarPrimary: primaryValue,
    sidebarRing: primaryValue,
    accent: accentValue,
    primaryForeground: pickReadableForeground(primaryValue),
    accentForeground: pickReadableForeground(accentValue),
  };
};
