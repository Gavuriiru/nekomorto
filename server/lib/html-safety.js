import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { parseSafeUrlValue } from "./url-safety.js";

const SVG_SANITIZER_BASE_URL = "https://svg.local/";
const SVG_SANITIZER_BASE_ORIGIN = new URL(SVG_SANITIZER_BASE_URL).origin;
const SVG_FORBIDDEN_TAGS = Object.freeze([
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "style",
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
]);

const persistentDom = new JSDOM("<!doctype html><html><body></body></html>");
const svgSanitizer = createDOMPurify(persistentDom.window);

export const sanitizeSvgReferenceUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("#")) {
    return raw;
  }
  const parsed = parseSafeUrlValue(raw, { baseUrl: SVG_SANITIZER_BASE_URL });
  if (!parsed || parsed.origin !== SVG_SANITIZER_BASE_ORIGIN) {
    return null;
  }
  const normalizedPath = `${parsed.pathname || ""}${parsed.search || ""}${parsed.hash || ""}`;
  return normalizedPath.startsWith("/") ? normalizedPath : null;
};

svgSanitizer.addHook("uponSanitizeAttribute", (node, data) => {
  const attrName = String(data.attrName || "").toLowerCase();
  if (!attrName) {
    return;
  }
  if (attrName === "style" || attrName.startsWith("on")) {
    data.keepAttr = false;
    return;
  }
  if (attrName === "xlink:href") {
    const safeValue = sanitizeSvgReferenceUrl(data.attrValue);
    if (!safeValue) {
      data.keepAttr = false;
      return;
    }
    if (typeof node?.setAttribute === "function" && !node.hasAttribute("href")) {
      node.setAttribute("href", safeValue);
    }
    data.keepAttr = false;
    return;
  }
  if (attrName === "href" || attrName === "src") {
    const safeValue = sanitizeSvgReferenceUrl(data.attrValue);
    if (!safeValue) {
      data.keepAttr = false;
      return;
    }
    data.attrValue = safeValue;
    data.keepAttr = true;
    data.forceKeepAttr = true;
  }
});

const serializeFirstSvgElement = (markup) => {
  const dom = new JSDOM(`<body>${String(markup || "")}</body>`);
  try {
    return String(dom.window.document.querySelector("svg")?.outerHTML || "").trim();
  } finally {
    dom.window.close();
  }
};

const normalizeLegacySvgReferences = (markup) => {
  const dom = new JSDOM(`<body>${String(markup || "")}</body>`);
  try {
    const svg = dom.window.document.querySelector("svg");
    if (!svg) {
      return String(markup || "");
    }
    svg.querySelectorAll("*").forEach((node) => {
      if (node.hasAttribute("xlink:href") && !node.hasAttribute("href")) {
        node.setAttribute("href", String(node.getAttribute("xlink:href") || ""));
      }
      node.removeAttribute("xlink:href");
    });
    return svg.outerHTML;
  } finally {
    dom.window.close();
  }
};

export const sanitizeSvg = (value) => {
  if (!value) {
    return "";
  }
  const sanitized = svgSanitizer.sanitize(normalizeLegacySvgReferences(value), {
    NAMESPACE: "http://www.w3.org/2000/svg",
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["use"],
    ADD_ATTR: ["href", "xlink:href"],
    FORBID_TAGS: SVG_FORBIDDEN_TAGS,
    FORBID_ATTR: ["style"],
  });
  return serializeFirstSvgElement(sanitized);
};

export const extractPlainTextFromHtml = (value, { preserveLineBreaks = false } = {}) => {
  const input = String(value ?? "");
  if (!input) {
    return "";
  }
  const dom = new JSDOM(`<body>${input}</body>`);
  try {
    const { document } = dom.window;
    if (preserveLineBreaks) {
      document.querySelectorAll("br").forEach((node) => {
        node.replaceWith("\n");
      });
      document
        .querySelectorAll("p,div,section,article,blockquote,li,h1,h2,h3,h4,h5,h6,pre,table,tr")
        .forEach((node) => {
          node.append(document.createTextNode("\n"));
        });
    }
    const rawText = String(document.body.textContent || "");
    if (!preserveLineBreaks) {
      return rawText.replace(/\s+/g, " ").trim();
    }
    return rawText
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    dom.window.close();
  }
};
