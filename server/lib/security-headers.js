const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

const HSTS_HEADER_VALUE = "max-age=31536000; includeSubDomains";

const escapeHtmlAttribute = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const buildContentSecurityPolicy = (nonce) => {
  const normalizedNonce = String(nonce || "").trim();
  const scriptSrc = ["'self'"];
  if (normalizedNonce) {
    scriptSrc.push(`'nonce-${normalizedNonce}'`);
  }
  scriptSrc.push("https://platform.twitter.com");

  const directives = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["connect-src", ["'self'", "https:"]],
    [
      "frame-src",
      [
        "'self'",
        "https://www.youtube-nocookie.com",
        "https://www.youtube.com",
        "https://platform.twitter.com",
        "https://syndication.twitter.com",
        "https://*.twitter.com",
        "https://x.com",
      ],
    ],
    ["worker-src", ["'self'", "blob:"]],
  ];

  return `${directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ")};`;
};

export const injectNonceIntoHtmlScripts = (html, nonce) => {
  const input = String(html ?? "");
  const normalizedNonce = String(nonce || "").trim();
  if (!input || !normalizedNonce) {
    return input;
  }
  const escapedNonce = escapeHtmlAttribute(normalizedNonce);
  return input.replace(/<script\b(?![^>]*\bnonce\s*=)([^>]*)>/gi, (_match, attrs = "") => {
    return `<script${attrs} nonce="${escapedNonce}">`;
  });
};

export const applySecurityHeaders = (res, nonce) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
  res.setHeader("Strict-Transport-Security", HSTS_HEADER_VALUE);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy(nonce));
};
