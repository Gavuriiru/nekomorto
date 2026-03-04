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

export const injectBootstrapGlobals = ({
  html,
  publicBootstrap,
  settings,
}) => {
  const bootstrapScript = [
    "<script>",
    `window.__BOOTSTRAP_PUBLIC__ = ${serializeInlineJson(publicBootstrap)};`,
    `window.__BOOTSTRAP_SETTINGS__ = ${serializeInlineJson(settings)};`,
    "window.__BOOTSTRAP_PUBLIC_PROMISE__ = Promise.resolve(window.__BOOTSTRAP_PUBLIC__);",
    "</script>",
  ].join("");
  return injectSnippet(String(html || ""), "<!-- APP_BOOTSTRAP -->", bootstrapScript);
};

export const injectPreloadLinks = ({ html, preloads = [] }) => {
  const tags = preloads
    .filter((entry) => entry && entry.href)
    .map((entry) => {
      const parts = [
        '  <link rel="preload"',
        `href="${escapeHtmlAttribute(entry.href)}"`,
        `as="${escapeHtmlAttribute(entry.as || "fetch")}"`,
      ];
      if (entry.type) {
        parts.push(`type="${escapeHtmlAttribute(entry.type)}"`);
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
