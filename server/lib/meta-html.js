export const createIndexHtmlLoader = ({ fs, clientIndexPath, isProduction }) => {
  let cachedIndexHtml = null;

  return () => {
    if (isProduction) {
      if (!cachedIndexHtml) {
        cachedIndexHtml = fs.readFileSync(clientIndexPath, "utf-8");
      }
      return cachedIndexHtml;
    }

    return fs.readFileSync(clientIndexPath, "utf-8");
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const createAbsoluteUrlResolver = ({ origin }) => (value) => {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("data:")) {
    return input;
  }
  try {
    return new URL(input, origin).toString();
  } catch {
    return input;
  }
};

const upsertMeta = (html, attr, key, content) => {
  const escaped = escapeHtml(content);
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  const regex = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const upsertLink = (html, rel, href) => {
  const escaped = escapeHtml(href);
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  const regex = new RegExp(`<link[^>]*rel="${rel}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const replaceTitle = (html, title) =>
  html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const appendStructuredDataScripts = (html, structuredData, serializeSchemaOrgEntry) => {
  const entries = Array.isArray(structuredData) ? structuredData : [];
  if (entries.length === 0) {
    return html;
  }
  const scripts = entries
    .filter((entry) => entry && typeof entry === "object")
    .map(
      (entry) =>
        `  <script type="application/ld+json" data-schema-org="true">${serializeSchemaOrgEntry(entry)}</script>`,
    );
  if (scripts.length === 0) {
    return html;
  }
  return html.replace("</head>", `${scripts.join("\n")}\n</head>`);
};

export const createMetaHtmlRenderer = ({
  getIndexHtml,
  primaryAppOrigin,
  resolveMetaImageVariantUrl,
  serializeSchemaOrgEntry,
  toAbsoluteUrl,
  truncateMetaDescription,
}) => ({
  renderMetaHtml({
    title,
    description,
    image,
    imageAlt,
    url,
    themeColor,
    type = "website",
    siteName,
    favicon,
    structuredData = [],
  }) {
    let html = getIndexHtml();
    const safeUrl = url || primaryAppOrigin;
    const safeImage = image ? toAbsoluteUrl(resolveMetaImageVariantUrl(image)) : "";
    const safeDescription = truncateMetaDescription(description);
    const safeThemeColor = String(themeColor || "#9667e0");

    html = replaceTitle(html, title);
    html = upsertMeta(html, "name", "description", safeDescription);
    html = upsertMeta(html, "name", "theme-color", safeThemeColor);
    html = upsertMeta(html, "property", "og:title", title);
    html = upsertMeta(html, "property", "og:description", safeDescription);
    html = upsertMeta(html, "property", "og:type", type);
    html = upsertMeta(html, "property", "og:url", safeUrl);
    html = upsertMeta(html, "property", "og:site_name", siteName);
    html = upsertMeta(html, "property", "og:locale", "pt_BR");
    if (safeImage) {
      html = upsertMeta(html, "property", "og:image", safeImage);
      html = upsertMeta(html, "property", "og:image:alt", String(imageAlt || ""));
      html = upsertMeta(html, "name", "twitter:image", safeImage);
      html = upsertMeta(html, "name", "twitter:image:alt", String(imageAlt || ""));
    }
    html = upsertMeta(html, "name", "twitter:title", title);
    html = upsertMeta(html, "name", "twitter:description", safeDescription);
    html = upsertMeta(
      html,
      "name",
      "twitter:card",
      safeImage ? "summary_large_image" : "summary",
    );
    html = upsertLink(html, "canonical", safeUrl);
    if (favicon) {
      html = upsertLink(html, "icon", toAbsoluteUrl(favicon));
    }
    return appendStructuredDataScripts(html, structuredData, serializeSchemaOrgEntry);
  },
});

export const createHtmlSender = ({
  applyHtmlCachingHeaders,
  injectNonceIntoHtmlScripts,
  viteDevServer,
}) => async (req, res, html) => {
  let nextHtml = html;
  const requestPath = req.originalUrl || req.url || "/";
  if (viteDevServer) {
    nextHtml = await viteDevServer.transformIndexHtml(requestPath, nextHtml);
  }
  const nonce = typeof res.locals?.cspNonce === "string" ? res.locals.cspNonce : "";
  const body = nonce ? injectNonceIntoHtmlScripts(nextHtml, nonce) : nextHtml;
  applyHtmlCachingHeaders(res, {
    pathname: requestPath,
    isAuthenticated: Boolean(req?.session?.user),
  });
  return res.type("html").send(body);
};
