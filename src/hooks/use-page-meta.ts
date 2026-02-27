import { useLayoutEffect, useMemo } from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { getCanonicalPageUrl } from "@/lib/canonical-url";

type PageMetaOptions = {
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  separator?: string;
};

const ensureMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => {
      el?.setAttribute(key, value);
    });
    document.head.appendChild(el);
  }
  return el;
};

const ensureLink = (selector: string, attrs: Record<string, string>) => {
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    Object.entries(attrs).forEach(([key, value]) => {
      el?.setAttribute(key, value);
    });
    document.head.appendChild(el);
  }
  return el;
};

export const usePageMeta = ({
  title,
  description,
  image,
  type = "website",
  noIndex = false,
  separator,
}: PageMetaOptions) => {
  const { settings, isLoading } = useSiteSettings();
  const siteName = settings.site.name || "Nekomata";
  const resolveSeparator = (value: unknown) => {
    const normalized = typeof value === "string" ? value : "";
    return normalized || " | ";
  };
  const effectiveSeparator = resolveSeparator(separator ?? settings.site.titleSeparator);
  const pageTitle = useMemo(() => {
    if (!title) {
      return siteName;
    }
    return `${title}${effectiveSeparator}${siteName}`;
  }, [effectiveSeparator, siteName, title]);
  const pageDescription = description ?? settings.site.description ?? "";
  const pageImage = useMemo(() => {
    const candidate = image ?? settings.site.defaultShareImage ?? "";
    return normalizeAssetUrl(candidate);
  }, [image, settings.site.defaultShareImage]);

  useLayoutEffect(() => {
    if (isLoading) {
      return;
    }
    document.documentElement.dataset.pageMeta = "true";
    document.title = pageTitle;

    const canonicalUrl = getCanonicalPageUrl(window.location.href) || window.location.href;

    const descriptionMeta = ensureMeta('meta[name="description"]', { name: "description" });
    descriptionMeta?.setAttribute("content", pageDescription);

    const robots = ensureMeta('meta[name="robots"]', { name: "robots" });
    robots?.setAttribute("content", noIndex ? "noindex, nofollow" : "index, follow");

    const ogTitle = ensureMeta('meta[property="og:title"]', { property: "og:title" });
    ogTitle?.setAttribute("content", pageTitle);
    const ogDescription = ensureMeta('meta[property="og:description"]', { property: "og:description" });
    ogDescription?.setAttribute("content", pageDescription);
    const ogSiteName = ensureMeta('meta[property="og:site_name"]', { property: "og:site_name" });
    ogSiteName?.setAttribute("content", siteName);
    const ogImage = ensureMeta('meta[property="og:image"]', { property: "og:image" });
    ogImage?.setAttribute("content", pageImage);
    const ogType = ensureMeta('meta[property="og:type"]', { property: "og:type" });
    ogType?.setAttribute("content", type);
    const ogUrl = ensureMeta('meta[property="og:url"]', { property: "og:url" });
    ogUrl?.setAttribute("content", canonicalUrl);
    const ogLocale = ensureMeta('meta[property="og:locale"]', { property: "og:locale" });
    ogLocale?.setAttribute("content", "pt_BR");

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" });
    twitterTitle?.setAttribute("content", pageTitle);
    const twitterDescription = ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" });
    twitterDescription?.setAttribute("content", pageDescription);
    const twitterImage = ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" });
    twitterImage?.setAttribute("content", pageImage);
    const twitterCard = ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" });
    twitterCard?.setAttribute("content", pageImage ? "summary_large_image" : "summary");

    const canonical = ensureLink('link[rel="canonical"]', { rel: "canonical" });
    canonical?.setAttribute("href", canonicalUrl);

    return () => {
      delete document.documentElement.dataset.pageMeta;
    };
  }, [isLoading, noIndex, pageDescription, pageImage, pageTitle, siteName, type]);
};
