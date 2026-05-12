const loadedStyleAssetHrefs = new Set<string>();

const normalizeStyleAssetHref = (value: string) => String(value || "").trim();

export const ensureStyleAssetLoaded = (href: string) => {
  if (typeof document === "undefined") {
    return;
  }
  const normalizedHref = normalizeStyleAssetHref(href);
  if (!normalizedHref || loadedStyleAssetHrefs.has(normalizedHref)) {
    return;
  }
  const existingLink = document.querySelector<HTMLLinkElement>(
    `link[rel="stylesheet"][href="${CSS.escape(normalizedHref)}"]`,
  );
  if (existingLink) {
    loadedStyleAssetHrefs.add(normalizedHref);
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = normalizedHref;
  document.head.appendChild(link);
  loadedStyleAssetHrefs.add(normalizedHref);
};
