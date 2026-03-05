export const DEFAULT_THEME_COLOR = "#9667e0";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const SECTION_HSL_OFFSETS = {
  home: { h: 0, s: 0, l: 0 },
  projects: { h: 22, s: 8, l: 2 },
  project: { h: 30, s: 10, l: 0 },
  post: { h: -22, s: 10, l: -1 },
  team: { h: 10, s: 2, l: 5 },
  about: { h: -8, s: -4, l: 6 },
  donations: { h: 42, s: 12, l: 1 },
  faq: { h: 55, s: 4, l: 4 },
  recruitment: { h: 70, s: 6, l: 2 },
  login: { h: -32, s: -8, l: -2 },
  dashboard: { h: -14, s: -12, l: -8 },
  default: { h: 0, s: 0, l: 0 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrapHue = (value) => ((value % 360) + 360) % 360;

const normalizePathname = (value) => {
  let pathname = String(value || "/").trim();
  if (!pathname) {
    return "/";
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname || "/";
    } catch {
      pathname = "/";
    }
  }

  pathname = pathname.split("#")[0].split("?")[0].trim();
  if (!pathname) {
    return "/";
  }
  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
  }
  return pathname || "/";
};

const normalizeAccentHex = (value) => {
  const normalized = String(value || "").trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return DEFAULT_THEME_COLOR;
  }
  const raw = normalized.slice(1);
  const expanded = raw.length === 3 ? raw.split("").map((part) => `${part}${part}`).join("") : raw;
  return `#${expanded.toLowerCase()}`;
};

const hexToRgb = (hex) => {
  const normalized = normalizeAccentHex(hex);
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToHsl = ({ r, g, b }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
    h = Math.round(h * 60);
  }
  if (h < 0) {
    h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hueToChannel = (p, q, value) => {
  let t = value;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

const hslToRgb = ({ h, s, l }) => {
  const hue = wrapHue(h) / 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const gray = Math.round(lightness * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: Math.round(hueToChannel(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToChannel(p, q, hue) * 255),
    b: Math.round(hueToChannel(p, q, hue - 1 / 3) * 255),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

export const resolveThemeColorSection = (pathname) => {
  const normalized = normalizePathname(pathname);

  if (normalized === "/") return "home";
  if (normalized === "/projetos") return "projects";

  if (/^\/(?:projeto|projetos)\/[^/]+(?:\/leitura\/[^/]+)?$/.test(normalized)) {
    return "project";
  }
  if (/^\/postagem\/[^/]+$/.test(normalized)) return "post";
  if (normalized === "/equipe") return "team";
  if (normalized === "/sobre") return "about";
  if (normalized === "/doacoes") return "donations";
  if (normalized === "/faq") return "faq";
  if (normalized === "/recrutamento") return "recruitment";
  if (normalized === "/login") return "login";
  if (/^\/dashboard(?:\/|$)/.test(normalized)) return "dashboard";

  return "default";
};

export const resolveRouteThemeColor = ({ pathname, accentHex }) => {
  const baseColor = normalizeAccentHex(accentHex);
  const section = resolveThemeColorSection(pathname);
  const offset = SECTION_HSL_OFFSETS[section];
  if (!offset || (offset.h === 0 && offset.s === 0 && offset.l === 0)) {
    return baseColor;
  }

  const hsl = rgbToHsl(hexToRgb(baseColor));
  return rgbToHex({
    ...hslToRgb({
      h: wrapHue(hsl.h + offset.h),
      s: clamp(hsl.s + offset.s, 0, 100),
      l: clamp(hsl.l + offset.l, 0, 100),
    }),
  });
};
