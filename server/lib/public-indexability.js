import { resolveInstitutionalOgPageKeyFromPath } from "../../shared/institutional-og-seo.js";
import {
  isAboutPublicPageMaterial,
  isFaqPublicPageMaterial,
  isRecruitmentPublicPageMaterial,
  normalizePublicPageContentCollection,
} from "../../shared/public-page-content.js";

const INDEXABLE_STATIC_PUBLIC_PATHS = new Set(["/", "/projetos"]);
const MATERIAL_INSTITUTIONAL_PAGE_KEYS = new Set(["about", "faq", "recruitment"]);

const normalizePathname = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "/";
  }
  return normalized.replace(/\/+$/, "") || "/";
};

const isCanonicalProjectDetailPath = (pathname) => /^\/projeto\/[^/]+$/.test(pathname);
const isLegacyProjectDetailPath = (pathname) => /^\/projetos\/[^/]+$/.test(pathname);
const isPublicPostDetailPath = (pathname) => /^\/postagem\/[^/]+$/.test(pathname);

const isInstitutionalPageIndexable = ({ pageKey, pages }) => {
  if (!pageKey) {
    return false;
  }
  if (!MATERIAL_INSTITUTIONAL_PAGE_KEYS.has(pageKey)) {
    return true;
  }
  switch (pageKey) {
    case "about":
      return isAboutPublicPageMaterial(pages?.about);
    case "faq":
      return isFaqPublicPageMaterial(pages?.faq);
    case "recruitment":
      return isRecruitmentPublicPageMaterial(pages?.recruitment);
    default:
      return false;
  }
};

export const normalizePublicPagesForSeo = (pages) => normalizePublicPageContentCollection(pages);

export const isStaticPublicPathIndexable = ({ pathname, pages } = {}) => {
  const normalizedPathname = normalizePathname(pathname);
  if (INDEXABLE_STATIC_PUBLIC_PATHS.has(normalizedPathname)) {
    return true;
  }
  const normalizedPages = normalizePublicPagesForSeo(pages);
  const pageKey = resolveInstitutionalOgPageKeyFromPath(normalizedPathname);
  return isInstitutionalPageIndexable({
    pageKey,
    pages: normalizedPages,
  });
};

export const resolvePublicPathIndexability = ({
  pathname,
  pages,
  project = null,
  post = null,
  isDashboardPath = false,
  isLoginPath = false,
  isReadingRoute = false,
} = {}) => {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedPages = normalizePublicPagesForSeo(pages);
  const pageKey = resolveInstitutionalOgPageKeyFromPath(normalizedPathname);

  let shouldIndex = false;

  if (!isDashboardPath && !isLoginPath && !isReadingRoute) {
    if (INDEXABLE_STATIC_PUBLIC_PATHS.has(normalizedPathname)) {
      shouldIndex = true;
    } else if (isCanonicalProjectDetailPath(normalizedPathname)) {
      shouldIndex = Boolean(project);
    } else if (isLegacyProjectDetailPath(normalizedPathname)) {
      shouldIndex = Boolean(project);
    } else if (isPublicPostDetailPath(normalizedPathname)) {
      shouldIndex = Boolean(post);
    } else if (pageKey) {
      shouldIndex = isInstitutionalPageIndexable({
        pageKey,
        pages: normalizedPages,
      });
    }
  }

  return {
    normalizedPathname,
    pageKey,
    pages: normalizedPages,
    shouldIndex,
    shouldRenderSeoSnapshot: shouldIndex,
    robots: shouldIndex ? "index, follow" : "noindex, nofollow",
  };
};
