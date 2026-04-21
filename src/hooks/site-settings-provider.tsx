import { defaultSettings, mergeSettings, SiteSettingsContext } from "@/hooks/site-settings-context";
import { refetchPublicBootstrapCache, refreshPublicBootstrapCacheIfStale } from "@/hooks/use-public-bootstrap";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { truncateMetaDescription } from "@/lib/meta-description";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import { deriveThemeAccentTokens } from "@/lib/theme-accent";
import type { SiteSettings } from "@/types/site-settings";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const applyDocumentSettings = (settings: SiteSettings) => {
  if (!settings) {
    return;
  }
  const siteName = settings.site.name || "NEKOMATA";
  const description = truncateMetaDescription(settings.site.description || "");
  const shareImage = normalizeAssetUrl(settings.site.defaultShareImage || "");
  const hasPageMeta = document.documentElement.dataset.pageMeta === "true";

  const ogSiteName = ensureMeta('meta[property="og:site_name"]', { property: "og:site_name" });
  ogSiteName?.setAttribute("content", siteName);
  if (!hasPageMeta) {
    document.title = siteName;

    const descriptionMeta = ensureMeta('meta[name="description"]', { name: "description" });
    descriptionMeta?.setAttribute("content", description);

    const ogTitle = ensureMeta('meta[property="og:title"]', { property: "og:title" });
    ogTitle?.setAttribute("content", siteName);
    const ogDescription = ensureMeta('meta[property="og:description"]', {
      property: "og:description",
    });
    ogDescription?.setAttribute("content", description);
    const ogImage = ensureMeta('meta[property="og:image"]', { property: "og:image" });
    ogImage?.setAttribute("content", shareImage);

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" });
    twitterTitle?.setAttribute("content", siteName);
    const twitterDescription = ensureMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
    });
    twitterDescription?.setAttribute("content", description);
    const twitterImage = ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" });
    twitterImage?.setAttribute("content", shareImage);
    const twitterCard = ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" });
    twitterCard?.setAttribute("content", shareImage ? "summary_large_image" : "summary");
  }

  if (settings.site.faviconUrl) {
    let icon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = settings.site.faviconUrl;
  }

  const root = document.documentElement;
  const accentHex = settings.theme?.accent?.trim();
  if (accentHex) {
    const accentTokens = deriveThemeAccentTokens(accentHex);
    if (accentTokens) {
      root.style.setProperty("--primary", accentTokens.primary);
      root.style.setProperty("--primary-foreground", accentTokens.primaryForeground);
      root.style.setProperty("--ring", accentTokens.ring);
      root.style.setProperty("--sidebar-primary", accentTokens.sidebarPrimary);
      root.style.setProperty("--sidebar-ring", accentTokens.sidebarRing);
      root.style.setProperty("--accent", accentTokens.accent);
      root.style.setProperty("--accent-foreground", accentTokens.accentForeground);
    }
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-ring");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
  }
};

export const SiteSettingsProvider = ({
  children,
  initialSettings,
  initiallyLoaded = false,
}: {
  children: ReactNode;
  initialSettings?: SiteSettings;
  initiallyLoaded?: boolean;
}) => {
  const apiBase = getApiBase();
  const bootstrapSettings = readWindowPublicBootstrap()?.settings;
  const resolvedInitialSettings = initialSettings || bootstrapSettings;
  const [settings, setSettings] = useState<SiteSettings>(
    mergeSettings(defaultSettings, resolvedInitialSettings || {}),
  );
  const [isLoading, setIsLoading] = useState(!(initiallyLoaded || Boolean(resolvedInitialSettings)));

  const refresh = useCallback(
    async (showLoading = true, options?: { force?: boolean }) => {
      if (showLoading) {
        setIsLoading(true);
      }
      try {
        const bootstrapPayload = options?.force
          ? await refetchPublicBootstrapCache(apiBase)
          : await refreshPublicBootstrapCacheIfStale({ apiBase });
        const nextSettings = bootstrapPayload?.settings;
        if (nextSettings) {
          setSettings(mergeSettings(defaultSettings, nextSettings));
          return;
        }

        const response = await apiFetch(apiBase, "/api/public/settings");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setSettings(mergeSettings(defaultSettings, data.settings || {}));
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [apiBase],
  );

  useEffect(() => {
    if (!resolvedInitialSettings) {
      return;
    }
    setSettings(mergeSettings(defaultSettings, resolvedInitialSettings));
    setIsLoading(false);
  }, [resolvedInitialSettings]);

  useEffect(() => {
    if (initiallyLoaded || resolvedInitialSettings) {
      return;
    }
    void refresh(true);
  }, [initiallyLoaded, refresh, resolvedInitialSettings]);

  useEffect(() => {
    if (!resolvedInitialSettings) {
      return;
    }
    void refresh(false);
  }, [refresh, resolvedInitialSettings]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    applyDocumentSettings(settings);
  }, [isLoading, settings]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      refresh,
    }),
    [settings, isLoading, refresh],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};
