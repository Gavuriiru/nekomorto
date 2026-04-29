import { createStableRevisionToken } from "./stable-revision-token.js";

export const INSTITUTIONAL_OG_SCENE_VERSION = "institutional-og-v2";

export const INSTITUTIONAL_OG_PAGE_KEYS = Object.freeze([
  "projects",
  "about",
  "donations",
  "faq",
  "team",
  "recruitment",
  "terms",
  "privacy",
]);

const INSTITUTIONAL_OG_PAGE_PATHS = Object.freeze({
  projects: "/projetos",
  about: "/sobre",
  donations: "/doacoes",
  faq: "/faq",
  team: "/equipe",
  recruitment: "/recrutamento",
  terms: "/termos-de-uso",
  privacy: "/politica-de-privacidade",
});

const INSTITUTIONAL_OG_PAGE_TITLES = Object.freeze({
  projects: "Projetos",
  about: "Sobre",
  donations: "Doa\u00e7\u00f5es",
  faq: "FAQ",
  team: "Equipe",
  recruitment: "Recrutamento",
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
});

const INSTITUTIONAL_PAGE_SUPPORT_TEXTS = Object.freeze({
  projects:
    "Explore os projetos da Nekomata, fansub e scan feita por f\u00e3s, com tradu\u00e7\u00f5es cuidadosas e carinho pela comunidade.",
  about:
    "Conhe\u00e7a a Nekomata, uma fansub e scan feita por f\u00e3s, com tradu\u00e7\u00f5es cuidadosas, carinho pela comunidade e respeito aos autores.",
  team: "Conhe\u00e7a a equipe da Nekomata e as pessoas que traduzem, revisam e cuidam dos projetos com dedica\u00e7\u00e3o.",
  faq: "Tire d\u00favidas sobre projetos, lan\u00e7amentos, tradu\u00e7\u00f5es e formas de acompanhar a Nekomata.",
  recruitment:
    "Entre para a Nekomata e colabore com uma fansub e scan feita por f\u00e3s para a comunidade.",
  donations:
    "Apoie a Nekomata e ajude a manter os projetos, servidores e ferramentas da fansub e scan.",
  terms:
    "Veja as regras de uso do site da Nekomata, incluindo comentários, áreas restritas e recursos públicos.",
  privacy:
    "Entenda como a Nekomata trata dados de comentários, autenticação, segurança e operação do site.",
});

const normalizeText = (value) => String(value || "").trim();

export const isInstitutionalOgPageKey = (value) =>
  INSTITUTIONAL_OG_PAGE_KEYS.includes(normalizeText(value));

export const resolveInstitutionalOgPageKeyFromPath = (pathname) => {
  const normalizedPath = normalizeText(pathname).replace(/\/+$/, "") || "/";
  return (
    Object.entries(INSTITUTIONAL_OG_PAGE_PATHS).find(([, path]) => path === normalizedPath)?.[0] ||
    ""
  );
};

export const resolveInstitutionalOgPagePath = (pageKey) =>
  INSTITUTIONAL_OG_PAGE_PATHS[normalizeText(pageKey)] || "";

export const resolveInstitutionalOgPageTitle = (pageKey) =>
  INSTITUTIONAL_OG_PAGE_TITLES[normalizeText(pageKey)] || "";

export const resolveInstitutionalOgSupportText = ({ pageKey, pages, settings } = {}) => {
  const normalizedPageKey = normalizeText(pageKey);
  const pageConfig = pages && typeof pages === "object" ? pages[normalizedPageKey] : null;
  return (
    normalizeText(pageConfig?.heroSubtitle) ||
    INSTITUTIONAL_PAGE_SUPPORT_TEXTS[normalizedPageKey] ||
    normalizeText(settings?.site?.description) ||
    ""
  );
};

export const resolveInstitutionalOgBackgroundImage = ({ pageKey, pages, settings } = {}) => {
  const normalizedPageKey = normalizeText(pageKey);
  const pageConfig = pages && typeof pages === "object" ? pages[normalizedPageKey] : null;
  return (
    normalizeText(pageConfig?.shareImage) || normalizeText(settings?.site?.defaultShareImage) || ""
  );
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
