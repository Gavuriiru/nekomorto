import { createStableRevisionToken } from "./stable-revision-token.js";

export const INSTITUTIONAL_OG_SCENE_VERSION = "institutional-og-v2";

export const INSTITUTIONAL_OG_PAGE_KEYS = Object.freeze([
  "projects",
  "about",
  "donations",
  "faq",
  "team",
  "recruitment",
]);

const INSTITUTIONAL_OG_PAGE_PATHS = Object.freeze({
  projects: "/projetos",
  about: "/sobre",
  donations: "/doacoes",
  faq: "/faq",
  team: "/equipe",
  recruitment: "/recrutamento",
});

const INSTITUTIONAL_OG_PAGE_TITLES = Object.freeze({
  projects: "Projetos",
  about: "Sobre",
  donations: "Doa\u00e7\u00f5es",
  faq: "FAQ",
  team: "Equipe",
  recruitment: "Recrutamento",
});

const PROJECTS_PAGE_SUPPORT_TEXT =
  "Explore o cat\u00e1logo da Nekomata e descubra projetos em andamento e conclu\u00eddos.";

const normalizeText = (value) => String(value || "").trim();

export const isInstitutionalOgPageKey = (value) =>
  INSTITUTIONAL_OG_PAGE_KEYS.includes(normalizeText(value));

export const resolveInstitutionalOgPageKeyFromPath = (pathname) => {
  const normalizedPath = normalizeText(pathname).replace(/\/+$/, "") || "/";
  return (
    Object.entries(INSTITUTIONAL_OG_PAGE_PATHS).find(([, path]) => path === normalizedPath)?.[0] || ""
  );
};

export const resolveInstitutionalOgPagePath = (pageKey) =>
  INSTITUTIONAL_OG_PAGE_PATHS[normalizeText(pageKey)] || "";

export const resolveInstitutionalOgPageTitle = (pageKey) =>
  INSTITUTIONAL_OG_PAGE_TITLES[normalizeText(pageKey)] || "";

export const resolveInstitutionalOgSupportText = ({ pageKey, pages, settings } = {}) => {
  const normalizedPageKey = normalizeText(pageKey);
  if (normalizedPageKey === "projects") {
    return PROJECTS_PAGE_SUPPORT_TEXT;
  }

  const pageConfig = pages && typeof pages === "object" ? pages[normalizedPageKey] : null;
  return (
    normalizeText(pageConfig?.heroSubtitle) ||
    normalizeText(settings?.site?.description) ||
    ""
  );
};

export const resolveInstitutionalOgBackgroundImage = ({ pageKey, pages, settings } = {}) => {
  const normalizedPageKey = normalizeText(pageKey);
  const pageConfig = pages && typeof pages === "object" ? pages[normalizedPageKey] : null;
  return normalizeText(pageConfig?.shareImage) || normalizeText(settings?.site?.defaultShareImage) || "";
};

export const buildInstitutionalOgImageAlt = (pageKey) => {
  const title = resolveInstitutionalOgPageTitle(pageKey) || "P\u00e1gina";
  return `Card de compartilhamento da p\u00e1gina ${title}`;
};

export const buildInstitutionalOgImagePath = (pageKey) =>
  `/api/og/institutional/${encodeURIComponent(normalizeText(pageKey))}`;

export const buildVersionedInstitutionalOgImagePath = ({ pageKey, revision } = {}) => {
  const basePath = buildInstitutionalOgImagePath(pageKey);
  const normalizedRevision = normalizeText(revision);
  if (!normalizedRevision) {
    return basePath;
  }
  return `${basePath}?v=${encodeURIComponent(normalizedRevision)}`;
};

export const buildInstitutionalOgRevision = ({
  pageKey,
  pages,
  settings,
  sceneVersion = INSTITUTIONAL_OG_SCENE_VERSION,
} = {}) => {
  const normalizedPageKey = normalizeText(pageKey);
  if (!isInstitutionalOgPageKey(normalizedPageKey)) {
    return "";
  }

  return createStableRevisionToken({
    sceneVersion: normalizeText(sceneVersion) || INSTITUTIONAL_OG_SCENE_VERSION,
    pageKey: normalizedPageKey,
    siteName: normalizeText(settings?.site?.name),
    accentHex: normalizeText(settings?.theme?.accent),
    defaultShareImage: normalizeText(settings?.site?.defaultShareImage),
    pageShareImage: normalizeText(pages?.[normalizedPageKey]?.shareImage),
    supportText: resolveInstitutionalOgSupportText({
      pageKey: normalizedPageKey,
      pages,
      settings,
    }),
  });
};
