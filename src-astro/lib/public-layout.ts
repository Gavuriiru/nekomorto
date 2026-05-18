import { resolveBranding } from "../../src/lib/branding";
import { resolveThemeColor } from "../../src/lib/theme-color";
import { sanitizePublicHref } from "../../src/lib/url-safety";
import type { SiteSettings } from "../../src/types/site-settings";

export interface PublicChromeLink {
  href: string;
  isExternal: boolean;
  label: string;
}

export interface PublicChromeSection {
  links: PublicChromeLink[];
  title: string;
}

export interface PublicChromeModel {
  brandName: string;
  footerDescription: string;
  footerHighlightDescription: string;
  footerHighlightTitle: string;
  footerLinks: PublicChromeSection[];
  legalLinks: PublicChromeLink[];
  navbarLinks: PublicChromeLink[];
  siteDescription: string;
  siteFaviconUrl: string;
  siteName: string;
  themeColor: string;
  wordmarkAlt: string;
  wordmarkUrl: string;
}

const toText = (value: unknown) => String(value || "").trim();
const isDefined = <T>(value: T | null): value is T => value !== null;

const isExternalHref = (href: string) => /^https?:\/\//i.test(href) || /^mailto:|^tel:/i.test(href);

const toPublicLink = (value: { href?: string; label?: string } | null | undefined) => {
  const href = sanitizePublicHref(value?.href);
  const label = toText(value?.label);
  if (!href || !label) {
    return null;
  }
  return {
    href,
    isExternal: isExternalHref(href),
    label,
  } satisfies PublicChromeLink;
};

const toSection = (value: { title?: string; links?: Array<{ href?: string; label?: string }> }) => {
  const title = toText(value?.title);
  const links = Array.isArray(value?.links) ? value.links.map(toPublicLink).filter(isDefined) : [];
  if (!title || links.length === 0) {
    return null;
  }
  return {
    title,
    links,
  } satisfies PublicChromeSection;
};

export const buildPublicChromeModel = (settings: SiteSettings): PublicChromeModel => {
  const branding = resolveBranding(settings);
  const siteName = toText(settings.site.name) || "Nekomata";
  const footerBrandName = toText(settings.footer.brandName) || siteName;
  const wordmarkUrl = branding.navbar.showWordmark
    ? branding.navbar.wordmarkUrl
    : branding.footer.showWordmark
      ? branding.footer.wordmarkUrl
      : "";
  const navbarLinks = Array.isArray(settings.navbar.links)
    ? settings.navbar.links.map(toPublicLink).filter(isDefined)
    : [];
  const footerLinks = Array.isArray(settings.footer.columns)
    ? settings.footer.columns.map(toSection).filter(isDefined)
    : [];
  const legalLinks = [
    { label: "Termos de Uso", href: "/termos-de-uso" },
    { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  ]
    .map(toPublicLink)
    .filter(isDefined);

  return {
    brandName: footerBrandName,
    footerDescription:
      toText(settings.footer.brandDescription) || toText(settings.site.description),
    footerHighlightDescription: toText(settings.footer.highlightDescription),
    footerHighlightTitle: toText(settings.footer.highlightTitle),
    footerLinks,
    legalLinks,
    navbarLinks,
    siteDescription: toText(settings.site.description),
    siteFaviconUrl: toText(settings.site.faviconUrl),
    siteName,
    themeColor: resolveThemeColor(settings.theme?.accent),
    wordmarkAlt: siteName,
    wordmarkUrl: toText(wordmarkUrl),
  };
};
