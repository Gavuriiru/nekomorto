const escapeHtmlAttribute = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const serializeInlineJson = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

const injectSnippet = (html, marker, snippet, fallbackPattern = "</head>") => {
  if (!snippet) {
    return String(html || "");
  }
  const input = String(html || "");
  if (input.includes(marker)) {
    return input.replace(marker, `${marker}\n${snippet}`);
  }
  return input.replace(fallbackPattern, `${snippet}\n${fallbackPattern}`);
};

const readHtmlAttributeValue = (tag, attributeName) => {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = String(tag || "").match(pattern);
  if (!match) {
    return "";
  }
  return String(match[1] || match[2] || match[3] || "").trim();
};

const isLocalStylesheetHref = (href) => {
  const value = String(href || "").trim();
  if (!value) {
    return false;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(value)) {
    return false;
  }
  if (value.startsWith("data:") || value.startsWith("javascript:")) {
    return false;
  }
  return value.startsWith("/assets/") || value.startsWith("assets/");
};

export const extractLocalStylesheetHrefs = (html) => {
  const tags = String(html || "").match(/<link\b[^>]*>/gi) || [];
  const hrefs = [];
  const seen = new Set();

  tags.forEach((tag) => {
    const rel = readHtmlAttributeValue(tag, "rel")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!rel.includes("stylesheet")) {
      return;
    }
    const href = readHtmlAttributeValue(tag, "href");
    if (!isLocalStylesheetHref(href) || seen.has(href)) {
      return;
    }
    seen.add(href);
    hrefs.push(href);
  });

  return hrefs;
};

const buildInlineBootstrapInitScript = () =>
  [
    "(function () {",
    '  var THEME_STORAGE_KEY = "nekomata:theme-mode-preference";',
    '  var DEFAULT_THEME_COLOR = "#9667e0";',
    "  var isPlaceholderTitle = function (value) {",
    "    var normalized = String(value || '').trim().toLowerCase();",
    '    return !normalized || normalized === "carregando..." || normalized === "loading...";',
    "  };",
    "  var normalizeBootstrapPayload = function (value) {",
    "    if (!value || typeof value !== 'object') return null;",
    "    if (!Array.isArray(value.projects) || !Array.isArray(value.posts)) return null;",
    "    return value;",
    "  };",
    "  var normalizeThemeMode = function (value) {",
    "    return String(value || '').toLowerCase() === 'light' ? 'light' : 'dark';",
    "  };",
    "  var THEME_COLOR_OFFSETS = {",
    "    home: { h: 0, s: 0, l: 0 },",
    "    projects: { h: 22, s: 8, l: 2 },",
    "    project: { h: 30, s: 10, l: 0 },",
    "    post: { h: -22, s: 10, l: -1 },",
    "    team: { h: 10, s: 2, l: 5 },",
    "    about: { h: -8, s: -4, l: 6 },",
    "    donations: { h: 42, s: 12, l: 1 },",
    "    faq: { h: 55, s: 4, l: 4 },",
    "    recruitment: { h: 70, s: 6, l: 2 },",
    "    login: { h: -32, s: -8, l: -2 },",
    "    dashboard: { h: -14, s: -12, l: -8 },",
    "    default: { h: 0, s: 0, l: 0 },",
    "  };",
    "  var clamp = function (value, min, max) {",
    "    return Math.min(max, Math.max(min, value));",
    "  };",
    "  var wrapHue = function (value) {",
    "    return ((value % 360) + 360) % 360;",
    "  };",
    "  var normalizeThemeColor = function (value) {",
    "    var normalized = String(value || '').trim();",
    "    if (!/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(normalized)) {",
    "      return DEFAULT_THEME_COLOR;",
    "    }",
    "    var raw = normalized.slice(1);",
    "    if (raw.length === 3) {",
    "      raw = raw",
    "        .split('')",
    "        .map(function (entry) {",
    "          return entry + entry;",
    "        })",
    "        .join('');",
    "    }",
    "    return '#' + raw.toLowerCase();",
    "  };",
    "  var normalizePathname = function (value) {",
    "    var pathname = String(value || '/').trim();",
    "    if (!pathname) return '/';",
    "    pathname = pathname.split('#')[0].split('?')[0].trim();",
    "    if (!pathname) return '/';",
    "    if (pathname.charAt(0) !== '/') {",
    "      pathname = '/' + pathname;",
    "    }",
    "    pathname = pathname.replace(/\\/{2,}/g, '/');",
    "    if (pathname.length > 1) {",
    "      pathname = pathname.replace(/\\/+$/, '');",
    "    }",
    "    return pathname || '/';",
    "  };",
    "  var resolveThemeColorSection = function (pathname) {",
    "    var normalized = normalizePathname(pathname);",
    "    if (normalized === '/') return 'home';",
    "    if (normalized === '/projetos') return 'projects';",
    "    if (/^\\/(?:projeto|projetos)\\/[^/]+(?:\\/leitura\\/[^/]+)?$/.test(normalized)) return 'project';",
    "    if (/^\\/postagem\\/[^/]+$/.test(normalized)) return 'post';",
    "    if (normalized === '/equipe') return 'team';",
    "    if (normalized === '/sobre') return 'about';",
    "    if (normalized === '/doacoes') return 'donations';",
    "    if (normalized === '/faq') return 'faq';",
    "    if (normalized === '/recrutamento') return 'recruitment';",
    "    if (normalized === '/login') return 'login';",
    "    if (/^\\/dashboard(?:\\/|$)/.test(normalized)) return 'dashboard';",
    "    return 'default';",
    "  };",
    "  var hexToRgb = function (hex) {",
    "    var normalized = normalizeThemeColor(hex);",
    "    var raw = normalized.slice(1);",
    "    return {",
    "      r: parseInt(raw.slice(0, 2), 16),",
    "      g: parseInt(raw.slice(2, 4), 16),",
    "      b: parseInt(raw.slice(4, 6), 16),",
    "    };",
    "  };",
    "  var rgbToHsl = function (rgb) {",
    "    var red = rgb.r / 255;",
    "    var green = rgb.g / 255;",
    "    var blue = rgb.b / 255;",
    "    var max = Math.max(red, green, blue);",
    "    var min = Math.min(red, green, blue);",
    "    var delta = max - min;",
    "    var hue = 0;",
    "    if (delta > 0) {",
    "      if (max === red) {",
    "        hue = ((green - blue) / delta) % 6;",
    "      } else if (max === green) {",
    "        hue = (blue - red) / delta + 2;",
    "      } else {",
    "        hue = (red - green) / delta + 4;",
    "      }",
    "      hue = Math.round(hue * 60);",
    "    }",
    "    if (hue < 0) hue += 360;",
    "    var lightness = (max + min) / 2;",
    "    var saturation =",
    "      delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));",
    "    return {",
    "      h: Math.round(hue),",
    "      s: Math.round(saturation * 100),",
    "      l: Math.round(lightness * 100),",
    "    };",
    "  };",
    "  var hueToChannel = function (p, q, value) {",
    "    var t = value;",
    "    if (t < 0) t += 1;",
    "    if (t > 1) t -= 1;",
    "    if (t < 1 / 6) return p + (q - p) * 6 * t;",
    "    if (t < 1 / 2) return q;",
    "    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;",
    "    return p;",
    "  };",
    "  var hslToRgb = function (hsl) {",
    "    var hue = wrapHue(hsl.h) / 360;",
    "    var saturation = clamp(hsl.s, 0, 100) / 100;",
    "    var lightness = clamp(hsl.l, 0, 100) / 100;",
    "    if (saturation === 0) {",
    "      var gray = Math.round(lightness * 255);",
    "      return { r: gray, g: gray, b: gray };",
    "    }",
    "    var q =",
    "      lightness < 0.5",
    "        ? lightness * (1 + saturation)",
    "        : lightness + saturation - lightness * saturation;",
    "    var p = 2 * lightness - q;",
    "    return {",
    "      r: Math.round(hueToChannel(p, q, hue + 1 / 3) * 255),",
    "      g: Math.round(hueToChannel(p, q, hue) * 255),",
    "      b: Math.round(hueToChannel(p, q, hue - 1 / 3) * 255),",
    "    };",
    "  };",
    "  var rgbToHex = function (rgb) {",
    "    var toHex = function (value) {",
    "      return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');",
    "    };",
    "    return '#' + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);",
    "  };",
    "  var resolveRouteThemeColor = function (pathname, accentHex) {",
    "    var baseColor = normalizeThemeColor(accentHex);",
    "    var section = resolveThemeColorSection(pathname);",
    "    var offset = THEME_COLOR_OFFSETS[section] || THEME_COLOR_OFFSETS.default;",
    "    if (!offset || (offset.h === 0 && offset.s === 0 && offset.l === 0)) {",
    "      return baseColor;",
    "    }",
    "    var hsl = rgbToHsl(hexToRgb(baseColor));",
    "    return rgbToHex(hslToRgb({",
    "        h: wrapHue(hsl.h + offset.h),",
    "        s: clamp(hsl.s + offset.s, 0, 100),",
    "        l: clamp(hsl.l + offset.l, 0, 100),",
    "      }));",
    "  };",
    "  var applyThemeColor = function (pathname, accentHex) {",
    '    var meta = document.querySelector(\'meta[name="theme-color"]\');',
    "    if (!meta) return;",
    "    meta.setAttribute('content', resolveRouteThemeColor(pathname, accentHex));",
    "  };",
    "  var applyThemeMode = function (mode) {",
    "    var resolved = normalizeThemeMode(mode);",
    "    var root = document.documentElement;",
    "    root.dataset.themeMode = resolved;",
    "    root.style.colorScheme = resolved;",
    "    if (resolved === 'dark') {",
    "      root.classList.add('dark');",
    "      return;",
    "    }",
    "    root.classList.remove('dark');",
    "  };",
    "  var readLocalThemePreference = function () {",
    "    try {",
    "      var value = window.localStorage.getItem(THEME_STORAGE_KEY);",
    "      if (value === 'light' || value === 'dark') {",
    "        return value;",
    "      }",
    "    } catch (_error) {",
    "      return 'global';",
    "    }",
    "    return 'global';",
    "  };",
    "  var localThemePreference = readLocalThemePreference();",
    "  var applyBootstrapSettings = function (settings) {",
    "    if (!settings || typeof settings !== 'object') return;",
    "    window.__BOOTSTRAP_SETTINGS__ = settings;",
    "    var name = (settings.site && settings.site.name) || '';",
    "    if (name && isPlaceholderTitle(document.title)) {",
    "      document.title = name;",
    "    }",
    "    var globalMode = settings && settings.theme ? settings.theme.mode : 'dark';",
    "    if (localThemePreference === 'global') {",
    "      applyThemeMode(globalMode);",
    "    }",
    "    applyThemeColor(window.location.pathname, settings.theme && settings.theme.accent);",
    "  };",
    "  var hydrateBootstrap = function (value) {",
    "    var bootstrap = normalizeBootstrapPayload(value);",
    "    if (!bootstrap) {",
    "      return null;",
    "    }",
    "    window.__BOOTSTRAP_PUBLIC__ = bootstrap;",
    "    applyBootstrapSettings(bootstrap.settings || null);",
    "    return bootstrap;",
    "  };",
    "  var existingBootstrap = normalizeBootstrapPayload(window.__BOOTSTRAP_PUBLIC__);",
    "  var existingSettings =",
    "    (existingBootstrap && existingBootstrap.settings) || window.__BOOTSTRAP_SETTINGS__ || null;",
    "  var initialMode =",
    "    localThemePreference === 'light' || localThemePreference === 'dark'",
    "      ? localThemePreference",
    "      : normalizeThemeMode(existingSettings && existingSettings.theme && existingSettings.theme.mode);",
    "  applyThemeMode(initialMode);",
    "  applyThemeColor(window.location.pathname, (existingSettings && existingSettings.theme && existingSettings.theme.accent) || DEFAULT_THEME_COLOR);",
    "  if (existingSettings) {",
    "    applyBootstrapSettings(existingSettings);",
    "  }",
    "  if (existingBootstrap) {",
    "    window.__BOOTSTRAP_PUBLIC_PROMISE__ =",
    "      window.__BOOTSTRAP_PUBLIC_PROMISE__ || Promise.resolve(existingBootstrap);",
    "    return;",
    "  }",
    "  var existingPromise = window.__BOOTSTRAP_PUBLIC_PROMISE__;",
    "  if (existingPromise && typeof existingPromise.then === 'function') {",
    "    window.__BOOTSTRAP_PUBLIC_PROMISE__ = existingPromise",
    "      .then(hydrateBootstrap)",
    "      .catch(function () {",
    "        return null;",
    "      });",
    "    return;",
    "  }",
    "  window.__BOOTSTRAP_PUBLIC_PROMISE__ = fetch('/api/public/bootstrap', {",
    "    credentials: 'same-origin',",
    "    cache: 'no-store',",
    "  })",
    "    .then(function (response) {",
    "      return response.ok ? response.json() : null;",
    "    })",
    "    .then(hydrateBootstrap)",
    "    .catch(function () {",
    "      return null;",
    "    });",
    "})();",
  ].join("\n");

export const injectBootstrapGlobals = ({ html, publicBootstrap, settings, publicMe = null }) => {
  const bootstrapScript = [
    "<script>",
    `window.__BOOTSTRAP_PUBLIC__ = ${serializeInlineJson(publicBootstrap)};`,
    `window.__BOOTSTRAP_SETTINGS__ = ${serializeInlineJson(settings)};`,
    `window.__BOOTSTRAP_PUBLIC_ME__ = ${serializeInlineJson(publicMe)};`,
    buildInlineBootstrapInitScript(),
    "</script>",
  ].join("\n");
  return injectSnippet(String(html || ""), "<!-- APP_BOOTSTRAP -->", bootstrapScript);
};

export const injectPreloadLinks = ({ html, preloads = [] }) => {
  const uniquePreloads = [];
  const seen = new Set();
  preloads
    .filter((entry) => entry && entry.href)
    .forEach((entry) => {
      const href = String(entry.href || "").trim();
      const as = String(entry.as || "fetch").trim() || "fetch";
      const key = `${as}::${href}`;
      if (!href || seen.has(key)) {
        return;
      }
      seen.add(key);
      uniquePreloads.push({
        ...entry,
        href,
        as,
      });
    });

  const tags = uniquePreloads.map((entry) => {
      const parts = [
        '  <link rel="preload"',
        `href="${escapeHtmlAttribute(entry.href)}"`,
        `as="${escapeHtmlAttribute(entry.as || "fetch")}"`,
      ];
      if (entry.crossorigin) {
        parts.push(`crossorigin="${escapeHtmlAttribute(entry.crossorigin)}"`);
      }
      if (entry.type) {
        parts.push(`type="${escapeHtmlAttribute(entry.type)}"`);
      }
      if (entry.imagesrcset) {
        parts.push(`imagesrcset="${escapeHtmlAttribute(entry.imagesrcset)}"`);
      }
      if (entry.imagesizes) {
        parts.push(`imagesizes="${escapeHtmlAttribute(entry.imagesizes)}"`);
      }
      if (entry.fetchpriority) {
        parts.push(`fetchpriority="${escapeHtmlAttribute(entry.fetchpriority)}"`);
      }
      return `${parts.join(" ")} />`;
    });
  if (tags.length === 0) {
    return String(html || "");
  }
  return injectSnippet(String(html || ""), "<!-- APP_PRELOADS -->", tags.join("\n"));
};

export const injectHomeHeroShell = ({ html, shellMarkup = "" }) => {
  const snippet = String(shellMarkup || "").trim();
  if (!snippet) {
    return String(html || "");
  }
  return injectSnippet(
    String(html || ""),
    "<!-- APP_HOME_HERO_SHELL -->",
    snippet,
    '<div id="root"></div>',
  );
};
