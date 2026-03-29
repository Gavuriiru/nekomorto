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
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
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
    const rel = readHtmlAttributeValue(tag, "rel").toLowerCase().split(/\s+/).filter(Boolean);
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
    "  var applyThemeColor = function (accentHex) {",
    "    var meta = document.querySelector('meta[name=\"theme-color\"]');",
    "    if (!meta) return;",
    "    meta.setAttribute('content', normalizeThemeColor(accentHex));",
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
    "    applyThemeColor(settings.theme && settings.theme.accent);",
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
    "  var shouldSkipPublicFetch = window.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ === true;",
    "  var initialMode =",
    "    localThemePreference === 'light' || localThemePreference === 'dark'",
    "      ? localThemePreference",
    "      : normalizeThemeMode(existingSettings && existingSettings.theme && existingSettings.theme.mode);",
    "  applyThemeMode(initialMode);",
    "  applyThemeColor((existingSettings && existingSettings.theme && existingSettings.theme.accent) || DEFAULT_THEME_COLOR);",
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
    "  if (shouldSkipPublicFetch) {",
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

export const injectBootstrapGlobals = ({
  html,
  publicBootstrap,
  settings,
  publicMe = null,
  pwaEnabled = false,
  skipPublicFetch = false,
}) => {
  const bootstrapScript = [
    "<script>",
    `window.__BOOTSTRAP_PUBLIC__ = ${serializeInlineJson(publicBootstrap)};`,
    `window.__BOOTSTRAP_SETTINGS__ = ${serializeInlineJson(settings)};`,
    `window.__BOOTSTRAP_PUBLIC_ME__ = ${serializeInlineJson(publicMe)};`,
    `window.__BOOTSTRAP_PWA_ENABLED__ = ${pwaEnabled ? "true" : "false"};`,
    `window.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ = ${skipPublicFetch ? "true" : "false"};`,
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
      const media = String(entry.media || "").trim();
      const key = `${as}::${href}::${media}`;
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
    if (entry.media) {
      parts.push(`media="${escapeHtmlAttribute(entry.media)}"`);
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
