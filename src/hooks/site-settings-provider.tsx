import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SiteSettings } from "@/types/site-settings";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { defaultSettings, mergeSettings, SiteSettingsContext } from "@/hooks/site-settings-context";
import { normalizeAssetUrl } from "@/lib/asset-url";

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToHsl = (hex: string) => {
  const cleaned = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }
  const expanded =
    cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const applyDocumentSettings = (settings: SiteSettings) => {
  if (!settings) {
    return;
  }
  const siteName = settings.site.name || "NEKOMATA";
  const description = settings.site.description || "";
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
    const ogDescription = ensureMeta('meta[property="og:description"]', { property: "og:description" });
    ogDescription?.setAttribute("content", description);
    const ogImage = ensureMeta('meta[property="og:image"]', { property: "og:image" });
    ogImage?.setAttribute("content", shareImage);

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" });
    twitterTitle?.setAttribute("content", siteName);
    const twitterDescription = ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" });
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
    const accent = hexToHsl(accentHex);
    if (accent) {
      const primaryValue = `${accent.h} ${accent.s}% ${accent.l}%`;
      const accentValue = `${accent.h} ${clamp(accent.s - 10, 0, 100)}% ${clamp(
        accent.l + 6,
        0,
        100,
      )}%`;
      root.style.setProperty("--primary", primaryValue);
      root.style.setProperty("--ring", primaryValue);
      root.style.setProperty("--sidebar-primary", primaryValue);
      root.style.setProperty("--sidebar-ring", primaryValue);
      root.style.setProperty("--accent", accentValue);
    }
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-ring");
    root.style.removeProperty("--accent");
  }
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const apiBase = getApiBase();
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(apiBase, "/api/public/settings");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setSettings(mergeSettings(defaultSettings, data.settings || {}));
    } catch {
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

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
