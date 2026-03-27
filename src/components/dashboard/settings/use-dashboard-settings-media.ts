import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "@/components/ui/use-toast";
import { uploadDashboardImageAsset } from "@/lib/dashboard-upload-assets";
import { DEFAULT_SITE_SHARE_IMAGE_ALT, resolveAssetAltText } from "@/lib/image-alt";
import type { SiteSettings } from "@/types/site-settings";
import {
  addIconCacheBust,
  normalizeLinkTypeId,
  readLogoField,
  writeLogoField,
  type LinkTypeItem,
  type LogoLibraryTarget,
} from "./shared";

type UseDashboardSettingsMediaOptions = {
  apiBase: string;
  linkTypes: LinkTypeItem[];
  setLinkTypes: Dispatch<SetStateAction<LinkTypeItem[]>>;
  settings: SiteSettings;
  setSettings: Dispatch<SetStateAction<SiteSettings>>;
};

export const useDashboardSettingsMedia = ({
  apiBase,
  linkTypes,
  setLinkTypes,
  settings,
  setSettings,
}: UseDashboardSettingsMediaOptions) => {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [iconCacheVersion, setIconCacheVersion] = useState(0);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<LogoLibraryTarget>(
    "branding.assets.symbolUrl",
  );
  const rootLibraryFolders = useMemo(() => [""], []);

  const isIconUrl = useCallback((value?: string | null) => {
    if (!value) {
      return false;
    }
    return value.startsWith("http") || value.startsWith("data:") || value.startsWith("/uploads/");
  }, []);

  const bumpIconCacheVersion = useCallback(() => {
    setIconCacheVersion((prev) => prev + 1);
  }, []);

  const toIconPreviewUrl = useCallback(
    (iconUrl: string | null | undefined) => addIconCacheBust(iconUrl, iconCacheVersion),
    [iconCacheVersion],
  );

  const openLibrary = useCallback((target: LogoLibraryTarget) => {
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  }, []);

  const applyLibraryImage = useCallback(
    (url: string, altText?: string) => {
      const normalizedUrl = String(url || "").trim();
      setSettings((prev) => {
        const next = writeLogoField(prev, libraryTarget, normalizedUrl);
        if (libraryTarget !== "site.defaultShareImage") {
          return next;
        }
        return {
          ...next,
          site: {
            ...next.site,
            defaultShareImageAlt: normalizedUrl
              ? resolveAssetAltText(altText, DEFAULT_SITE_SHARE_IMAGE_ALT)
              : "",
          },
        };
      });
    },
    [libraryTarget, setSettings],
  );

  const clearLibraryImage = useCallback(
    (target: LogoLibraryTarget) => {
      setSettings((prev) => {
        const next = writeLogoField(prev, target, "");
        if (target === "site.defaultShareImage") {
          return {
            ...next,
            site: {
              ...next.site,
              defaultShareImageAlt: "",
            },
          };
        }
        return next;
      });
    },
    [setSettings],
  );

  const currentLibrarySelection = useMemo(() => {
    return readLogoField(settings, libraryTarget);
  }, [libraryTarget, settings]);

  const uploadDownloadIcon = useCallback(
    async (file: File, index: number) => {
      setUploadingKey(`download-icon-${index}`);
      try {
        const source = settings.downloads.sources[index];
        const slot = source?.id ? String(source.id) : `download-${index}`;
        const nextUrl = await uploadDashboardImageAsset({
          apiBase,
          file,
          folder: "downloads",
          slot,
        });
        setSettings((prev) => {
          const next = [...prev.downloads.sources];
          next[index] = { ...next[index], icon: nextUrl };
          return { ...prev, downloads: { ...prev.downloads, sources: next } };
        });
        bumpIconCacheVersion();
        toast({ title: "Ícone enviado", description: "SVG atualizado com sucesso." });
      } catch {
        toast({
          title: "Falha no upload",
          description: "Não foi possível enviar o ícone.",
          variant: "destructive",
        });
      } finally {
        setUploadingKey(null);
      }
    },
    [apiBase, bumpIconCacheVersion, setSettings, settings.downloads.sources],
  );

  const uploadLinkTypeIcon = useCallback(
    async (file: File, index: number) => {
      setUploadingKey(`linktype-icon-${index}`);
      try {
        const link = linkTypes[index];
        const slot = link?.id ? String(link.id) : normalizeLinkTypeId(link?.label || `rede-${index}`);
        const nextUrl = await uploadDashboardImageAsset({
          apiBase,
          file,
          folder: "socials",
          slot,
        });
        setLinkTypes((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], icon: nextUrl };
          return next;
        });
        bumpIconCacheVersion();
        toast({ title: "Ícone enviado", description: "SVG atualizado com sucesso." });
      } catch {
        toast({
          title: "Falha no upload",
          description: "Não foi possível enviar o ícone.",
          variant: "destructive",
        });
      } finally {
        setUploadingKey(null);
      }
    },
    [apiBase, bumpIconCacheVersion, linkTypes, setLinkTypes],
  );

  return {
    applyLibraryImage,
    clearLibraryImage,
    currentLibrarySelection,
    isIconUrl,
    isLibraryOpen,
    libraryTarget,
    openLibrary,
    rootLibraryFolders,
    setIsLibraryOpen,
    toIconPreviewUrl,
    uploadDownloadIcon,
    uploadLinkTypeIcon,
    uploadingKey,
  };
};