import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";
import DashboardShell from "@/components/DashboardShell";
import ImageLibraryDialog from "@/components/ImageLibraryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  BadgeCheck,
  Check,
  Clock,
  Code,
  Download,
  Facebook,
  Instagram,
  Languages,
  Layers,
  Link2,
  MessageCircle,
  Paintbrush,
  Palette,
  PenTool,
  Send,
  Sparkles,
  Twitter,
  User,
  Video,
  HardDrive,
  GripVertical,
  Cloud,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  autosaveRuntimeConfig,
  autosaveStorageKeys,
  readAutosavePreference,
  writeAutosavePreference,
} from "@/config/autosave";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { usePageMeta } from "@/hooks/use-page-meta";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { navbarIconOptions } from "@/lib/navbar-icons";
import { resolveBranding } from "@/lib/branding";

const roleIconOptions = [
  { id: "languages", label: "Languages" },
  { id: "check", label: "Check" },
  { id: "pen-tool", label: "Pen Tool" },
  { id: "sparkles", label: "Sparkles" },
  { id: "code", label: "Code" },
  { id: "paintbrush", label: "Paintbrush" },
  { id: "layers", label: "Layers" },
  { id: "video", label: "Video" },
  { id: "clock", label: "Clock" },
  { id: "badge", label: "Badge" },
  { id: "palette", label: "Palette" },
  { id: "user", label: "User" },
];

const roleIconMap: Record<string, typeof User> = {
  languages: Languages,
  check: Check,
  "pen-tool": PenTool,
  sparkles: Sparkles,
  code: Code,
  paintbrush: Paintbrush,
  layers: Layers,
  video: Video,
  clock: Clock,
  badge: BadgeCheck,
  palette: Palette,
  user: User,
};

const socialIconMap: Record<string, typeof Link2> = {
  "google-drive": Cloud,
  mega: HardDrive,
  torrent: Download,
  mediafire: HardDrive,
  telegram: Send,
  link: Link2,
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  discord: MessageCircle,
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const normalizeLinkTypeId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const reorderItems = <T,>(items: T[], from: number, to: number) => {
  if (from === to) {
    return items;
  }
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  next.splice(to, 0, moved);
  return next;
};

type LogoLibraryTarget =
  | "branding.assets.symbolUrl"
  | "branding.assets.wordmarkUrl"
  | "site.faviconUrl"
  | "site.defaultShareImage"
  | "branding.overrides.navbarWordmarkUrl"
  | "branding.overrides.footerWordmarkUrl"
  | "branding.overrides.navbarSymbolUrl"
  | "branding.overrides.footerSymbolUrl";

type NavbarBrandMode = SiteSettings["branding"]["display"]["navbar"];
type FooterBrandMode = SiteSettings["branding"]["display"]["footer"];

type SettingsTabKey =
  | "geral"
  | "downloads"
  | "equipe"
  | "footer"
  | "navbar"
  | "redes-usuarios"
  | "traducoes";

type LinkTypeItem = { id: string; label: string; icon: string };
type TranslationsPayload = {
  tags: Record<string, string>;
  genres: Record<string, string>;
  staffRoles: Record<string, string>;
};

const logoEditorFields: Array<{
  target: LogoLibraryTarget;
  label: string;
  description: string;
  frameClassName: string;
  imageClassName: string;
  optional?: boolean;
}> = [
  {
    target: "branding.assets.symbolUrl",
    label: "Símbolo da marca",
    description: "Ativo principal usado como base para logo da marca.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-10 rounded bg-black/10 object-contain",
  },
  {
    target: "branding.assets.wordmarkUrl",
    label: "Logotipo (wordmark)",
    description: "Tipografia principal da marca usada como base para header e footer.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-full object-contain",
  },
  {
    target: "site.faviconUrl",
    label: "Favicon",
    description: "Ícone mostrado na aba do navegador.",
    frameClassName: "h-16",
    imageClassName: "h-8 w-8 rounded bg-black/10 object-contain",
  },
  {
    target: "site.defaultShareImage",
    label: "Imagem de compartilhamento",
    description: "Imagem padrão de cards sociais quando a página não define uma própria.",
    frameClassName: "h-20",
    imageClassName: "h-full w-full rounded bg-black/10 object-cover",
  },
  {
    target: "branding.overrides.navbarWordmarkUrl",
    label: "Override de wordmark da navbar",
    description: "Opcional. Se vazio, a navbar usa o logotipo principal.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-full object-contain",
    optional: true,
  },
  {
    target: "branding.overrides.footerWordmarkUrl",
    label: "Override de wordmark do footer",
    description: "Opcional. Se vazio, o footer usa o logotipo principal.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-full object-contain",
    optional: true,
  },
  {
    target: "branding.overrides.navbarSymbolUrl",
    label: "Override de símbolo da navbar",
    description: "Opcional. Se vazio, a navbar usa o símbolo principal.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-10 rounded bg-black/10 object-contain",
    optional: true,
  },
  {
    target: "branding.overrides.footerSymbolUrl",
    label: "Override de símbolo do footer",
    description: "Opcional. Se vazio, o footer usa o símbolo principal.",
    frameClassName: "h-16",
    imageClassName: "h-10 w-10 rounded bg-black/10 object-contain",
    optional: true,
  },
];

const readLogoField = (nextSettings: SiteSettings, target: LogoLibraryTarget) => {
  if (target === "branding.assets.symbolUrl") {
    return nextSettings.branding.assets.symbolUrl || "";
  }
  if (target === "branding.assets.wordmarkUrl") {
    return nextSettings.branding.assets.wordmarkUrl || "";
  }
  if (target === "site.faviconUrl") {
    return nextSettings.site.faviconUrl || "";
  }
  if (target === "site.defaultShareImage") {
    return nextSettings.site.defaultShareImage || "";
  }
  if (target === "branding.overrides.navbarWordmarkUrl") {
    return nextSettings.branding.overrides.navbarWordmarkUrl || "";
  }
  if (target === "branding.overrides.footerWordmarkUrl") {
    return nextSettings.branding.overrides.footerWordmarkUrl || "";
  }
  if (target === "branding.overrides.navbarSymbolUrl") {
    return nextSettings.branding.overrides.navbarSymbolUrl || "";
  }
  if (target === "branding.overrides.footerSymbolUrl") {
    return nextSettings.branding.overrides.footerSymbolUrl || "";
  }
  return "";
};

const writeLogoField = (nextSettings: SiteSettings, target: LogoLibraryTarget, url: string) => {
  if (target === "branding.assets.symbolUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        assets: { ...nextSettings.branding.assets, symbolUrl: url },
      },
    };
  }
  if (target === "branding.assets.wordmarkUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        assets: { ...nextSettings.branding.assets, wordmarkUrl: url },
      },
    };
  }
  if (target === "site.faviconUrl") {
    return { ...nextSettings, site: { ...nextSettings.site, faviconUrl: url } };
  }
  if (target === "site.defaultShareImage") {
    return { ...nextSettings, site: { ...nextSettings.site, defaultShareImage: url } };
  }
  if (target === "branding.overrides.navbarWordmarkUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        overrides: { ...nextSettings.branding.overrides, navbarWordmarkUrl: url },
      },
    };
  }
  if (target === "branding.overrides.footerWordmarkUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        overrides: { ...nextSettings.branding.overrides, footerWordmarkUrl: url },
      },
    };
  }
  if (target === "branding.overrides.navbarSymbolUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        overrides: { ...nextSettings.branding.overrides, navbarSymbolUrl: url },
      },
    };
  }
  if (target === "branding.overrides.footerSymbolUrl") {
    return {
      ...nextSettings,
      branding: {
        ...nextSettings.branding,
        overrides: { ...nextSettings.branding.overrides, footerSymbolUrl: url },
      },
    };
  }
  return nextSettings;
};

const DashboardSettings = () => {
  usePageMeta({ title: "Configurações", noIndex: true });

  const navigate = useNavigate();
  const apiBase = getApiBase();
  const initialAutosaveEnabledRef = useRef(
    autosaveRuntimeConfig.enabledByDefault &&
      readAutosavePreference(autosaveStorageKeys.settings, true),
  );
  const { settings: publicSettings, refresh } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSettings>(publicSettings);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>({});
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [knownGenres, setKnownGenres] = useState<string[]>([]);
  const [knownStaffRoles, setKnownStaffRoles] = useState<string[]>([]);
  const [linkTypes, setLinkTypes] = useState<LinkTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingAniList, setIsSyncingAniList] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<LogoLibraryTarget>("branding.assets.symbolUrl");
  const [tagQuery, setTagQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [staffRoleQuery, setStaffRoleQuery] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("geral");
  const [footerSocialDragIndex, setFooterSocialDragIndex] = useState<number | null>(null);
  const [footerSocialDragOverIndex, setFooterSocialDragOverIndex] = useState<number | null>(null);
  const hasSyncedAniList = useRef(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [settingsRes, translationsRes, projectsRes, linkTypesRes] = await Promise.all([
          apiFetch(apiBase, "/api/settings", { auth: true }),
          apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" }),
          apiFetch(apiBase, "/api/projects", { auth: true }),
          apiFetch(apiBase, "/api/link-types"),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (isActive && data.settings) {
            setSettings(mergeSettings(defaultSettings, data.settings));
          }
        }
        if (translationsRes.ok) {
          const data = await translationsRes.json();
          if (isActive) {
            setTagTranslations(data.tags || {});
            setGenreTranslations(data.genres || {});
            setStaffRoleTranslations(data.staffRoles || {});
          }
        }
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          if (isActive) {
            const projects = Array.isArray(data.projects) ? data.projects : [];
            const tags = new Set<string>();
            const genres = new Set<string>();
            const staffRoles = new Set<string>();
            projects.forEach((project) => {
              (project.tags || []).forEach((tag: string) => tags.add(tag));
              (project.genres || []).forEach((genre: string) => genres.add(genre));
              if (Array.isArray(project.animeStaff)) {
                project.animeStaff.forEach((staff: { role?: string | null }) => {
                  const role = String(staff?.role || "").trim();
                  if (role) {
                    staffRoles.add(role);
                  }
                });
              }
            });
            setKnownTags(Array.from(tags).sort((a, b) => a.localeCompare(b, "en")));
            setKnownGenres(Array.from(genres).sort((a, b) => a.localeCompare(b, "en")));
            setKnownStaffRoles(Array.from(staffRoles).sort((a, b) => a.localeCompare(b, "en")));
          }
        }
        if (linkTypesRes.ok) {
          const data = await linkTypesRes.json();
          if (isActive) {
            setLinkTypes(Array.isArray(data.items) ? data.items : []);
          }
        }
      } catch {
        if (isActive) {
          setSettings(publicSettings);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, publicSettings]);

  const syncAniListTerms = useCallback(
    async (options?: { silent?: boolean }) => {
      if (isSyncingAniList) {
        return;
      }
      setIsSyncingAniList(true);
      try {
        const response = await apiFetch(apiBase, "/api/tag-translations/anilist-sync", {
          method: "POST",
          auth: true,
        });
        if (!response.ok) {
          throw new Error("sync_failed");
        }
        const data = await response.json();
        setTagTranslations(data.tags || {});
        setGenreTranslations(data.genres || {});
        if (data.staffRoles) {
          setStaffRoleTranslations(data.staffRoles || {});
        }
        if (!options?.silent) {
          toast({
            title: "Termos do AniList atualizados",
            description: "Tags e gêneros foram importados para tradução.",
          });
        }
      } catch {
        if (!options?.silent) {
          toast({
            title: "Não foi possível importar",
            description: "Verifique a conexão ou tente novamente.",
          });
        }
      } finally {
        setIsSyncingAniList(false);
      }
    },
    [apiBase, isSyncingAniList],
  );

  useEffect(() => {
    if (isLoading || hasSyncedAniList.current) {
      return;
    }
    hasSyncedAniList.current = true;
    void syncAniListTerms({ silent: true });
  }, [isLoading, syncAniListTerms]);

  const isIconUrl = (value?: string | null) => {
    if (!value) return false;
    return value.startsWith("http") || value.startsWith("data:") || value.startsWith("/uploads/");
  };

  const clearFooterSocialDragState = () => {
    setFooterSocialDragIndex(null);
    setFooterSocialDragOverIndex(null);
  };

  const handleFooterSocialDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    setFooterSocialDragIndex(index);
    setFooterSocialDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleFooterSocialDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (footerSocialDragIndex === null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (footerSocialDragOverIndex !== index) {
      setFooterSocialDragOverIndex(index);
    }
  };

  const handleFooterSocialDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const from = footerSocialDragIndex;
    if (from === null || from === index) {
      clearFooterSocialDragState();
      return;
    }
    setSettings((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        socialLinks: reorderItems(prev.footer.socialLinks, from, index),
      },
    }));
    clearFooterSocialDragState();
  };

  const openLibrary = (target: LogoLibraryTarget) => {
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  };

  const applyLibraryImage = (url: string) => {
    setSettings((prev) => writeLogoField(prev, libraryTarget, url));
  };

  const clearLibraryImage = (target: LogoLibraryTarget) => {
    setSettings((prev) => writeLogoField(prev, target, ""));
  };

  const currentLibrarySelection = useMemo(() => {
    return readLogoField(settings, libraryTarget);
  }, [libraryTarget, settings]);





  const uploadDownloadIcon = async (file: File, index: number) => {
    setUploadingKey(`download-icon-${index}`);
    try {
      const source = settings.downloads.sources[index];
      const slot = source?.id ? String(source.id) : `download-${index}`;
      const dataUrl = await fileToDataUrl(file);
      const response = await apiFetch(apiBase, "/api/uploads/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          dataUrl,
          filename: file.name,
          folder: "downloads",
          slot,
        }),
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
      const data = await response.json();
      setSettings((prev) => {
        const next = [...prev.downloads.sources];
        next[index] = { ...next[index], icon: data.url };
        return { ...prev, downloads: { ...prev.downloads, sources: next } };
      });
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
  };

  const uploadLinkTypeIcon = async (file: File, index: number) => {
    setUploadingKey(`linktype-icon-${index}`);
    try {
      const link = linkTypes[index];
      const slot = link?.id ? String(link.id) : normalizeLinkTypeId(link?.label || `rede-${index}`);
      const dataUrl = await fileToDataUrl(file);
      const response = await apiFetch(apiBase, "/api/uploads/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          dataUrl,
          filename: file.name,
          folder: "socials",
          slot,
        }),
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
      const data = await response.json();
      setLinkTypes((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], icon: data.url };
        return next;
      });
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
  };

  const saveSettingsResource = useCallback(
    async (snapshot: SiteSettings) => {
      const nextSettings = { ...snapshot };
      const socialDiscord = nextSettings.footer.socialLinks.find(
        (link) => String(link.label || "").toLowerCase() === "discord",
      );
      if (socialDiscord?.href) {
        nextSettings.community.discordUrl = socialDiscord.href;
      }
      const response = await apiFetch(apiBase, "/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ settings: nextSettings }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const normalizedSettings = mergeSettings(defaultSettings, data?.settings || nextSettings);
      setSettings(normalizedSettings);
      return normalizedSettings;
    },
    [apiBase],
  );

  const translationsValue = useMemo<TranslationsPayload>(
    () => ({
      tags: tagTranslations,
      genres: genreTranslations,
      staffRoles: staffRoleTranslations,
    }),
    [genreTranslations, staffRoleTranslations, tagTranslations],
  );

  const saveTranslationsResource = useCallback(
    async (snapshot: TranslationsPayload) => {
      const response = await apiFetch(apiBase, "/api/tag-translations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify(snapshot),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const normalizedTranslations: TranslationsPayload = {
        tags: data?.tags || snapshot.tags,
        genres: data?.genres || snapshot.genres,
        staffRoles: data?.staffRoles || snapshot.staffRoles,
      };
      setTagTranslations(normalizedTranslations.tags);
      setGenreTranslations(normalizedTranslations.genres);
      setStaffRoleTranslations(normalizedTranslations.staffRoles);
      return normalizedTranslations;
    },
    [apiBase],
  );

  const saveLinkTypesResource = useCallback(
    async (snapshot: LinkTypeItem[]) => {
      const normalizedItems = snapshot
        .map((item) => ({
          ...item,
          id: item.id?.trim() ? item.id.trim() : normalizeLinkTypeId(item.label || ""),
          label: String(item.label || "").trim(),
          icon: String(item.icon || "globe").trim(),
        }))
        .filter((item) => item.id && item.label);
      setLinkTypes(normalizedItems);
      const response = await apiFetch(apiBase, "/api/link-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ items: normalizedItems }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const resolvedItems = Array.isArray(data?.items) ? data.items : normalizedItems;
      setLinkTypes(resolvedItems);
      return resolvedItems;
    },
    [apiBase],
  );

  const settingsAutosave = useAutosave<SiteSettings>({
    value: settings,
    onSave: saveSettingsResource,
    isReady: !isLoading,
    enabled: initialAutosaveEnabledRef.current,
    debounceMs: autosaveRuntimeConfig.debounceMs,
    retryMax: autosaveRuntimeConfig.retryMax,
    retryBaseMs: autosaveRuntimeConfig.retryBaseMs,
    onError: (_error, payload) => {
      if (payload.source === "auto" && payload.consecutiveErrors === 1) {
        toast({
          title: "Falha no autosave de ajustes",
          description: "As configurações gerais não foram salvas automaticamente.",
          variant: "destructive",
        });
      }
    },
  });

  const translationsAutosave = useAutosave<TranslationsPayload>({
    value: translationsValue,
    onSave: saveTranslationsResource,
    isReady: !isLoading,
    enabled: initialAutosaveEnabledRef.current,
    debounceMs: autosaveRuntimeConfig.debounceMs,
    retryMax: autosaveRuntimeConfig.retryMax,
    retryBaseMs: autosaveRuntimeConfig.retryBaseMs,
    onError: (_error, payload) => {
      if (payload.source === "auto" && payload.consecutiveErrors === 1) {
        toast({
          title: "Falha no autosave de traduções",
          description: "As traduções não foram salvas automaticamente.",
          variant: "destructive",
        });
      }
    },
  });

  const linkTypesAutosave = useAutosave<LinkTypeItem[]>({
    value: linkTypes,
    onSave: saveLinkTypesResource,
    isReady: !isLoading,
    enabled: initialAutosaveEnabledRef.current,
    debounceMs: autosaveRuntimeConfig.debounceMs,
    retryMax: autosaveRuntimeConfig.retryMax,
    retryBaseMs: autosaveRuntimeConfig.retryBaseMs,
    onError: (_error, payload) => {
      if (payload.source === "auto" && payload.consecutiveErrors === 1) {
        toast({
          title: "Falha no autosave de redes",
          description: "Os tipos de link não foram salvos automaticamente.",
          variant: "destructive",
        });
      }
    },
  });

  const handleAutosaveToggle = useCallback(
    (nextEnabled: boolean) => {
      if (!autosaveRuntimeConfig.enabledByDefault) {
        return;
      }
      settingsAutosave.setEnabled(nextEnabled);
      translationsAutosave.setEnabled(nextEnabled);
      linkTypesAutosave.setEnabled(nextEnabled);
    },
    [linkTypesAutosave, settingsAutosave, translationsAutosave],
  );

  const autosaveEnabled =
    settingsAutosave.enabled && translationsAutosave.enabled && linkTypesAutosave.enabled;

  useEffect(() => {
    writeAutosavePreference(autosaveStorageKeys.settings, autosaveEnabled);
  }, [autosaveEnabled]);

  const combinedAutosaveStatus = useMemo<AutosaveStatus>(() => {
    const statuses: AutosaveStatus[] = [
      settingsAutosave.status,
      translationsAutosave.status,
      linkTypesAutosave.status,
    ];
    if (statuses.includes("saving")) {
      return "saving";
    }
    if (statuses.includes("error")) {
      return "error";
    }
    if (statuses.includes("pending")) {
      return "pending";
    }
    if (statuses.includes("saved")) {
      return "saved";
    }
    return "idle";
  }, [linkTypesAutosave.status, settingsAutosave.status, translationsAutosave.status]);

  const combinedLastSavedAt = useMemo(() => {
    const points = [
      settingsAutosave.lastSavedAt,
      translationsAutosave.lastSavedAt,
      linkTypesAutosave.lastSavedAt,
    ].filter((point): point is number => Number.isFinite(point));
    return points.length ? Math.max(...points) : null;
  }, [
    linkTypesAutosave.lastSavedAt,
    settingsAutosave.lastSavedAt,
    translationsAutosave.lastSavedAt,
  ]);

  const combinedAutosaveErrorMessage = useMemo(() => {
    if (settingsAutosave.status === "error") {
      return "Há falha no salvamento automático dos ajustes gerais.";
    }
    if (translationsAutosave.status === "error") {
      return "Há falha no salvamento automático das traduções.";
    }
    if (linkTypesAutosave.status === "error") {
      return "Há falha no salvamento automático das redes sociais.";
    }
    return null;
  }, [linkTypesAutosave.status, settingsAutosave.status, translationsAutosave.status]);

  const hasPendingChanges =
    settingsAutosave.isDirty ||
    translationsAutosave.isDirty ||
    linkTypesAutosave.isDirty ||
    settingsAutosave.status === "pending" ||
    settingsAutosave.status === "saving" ||
    translationsAutosave.status === "pending" ||
    translationsAutosave.status === "saving" ||
    linkTypesAutosave.status === "pending" ||
    linkTypesAutosave.status === "saving";

  useEffect(() => {
    if (isLoading || !hasPendingChanges) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges, isLoading]);

  const flushAllAutosave = useCallback(() => {
    if (settingsAutosave.enabled) {
      void settingsAutosave.flushNow();
    }
    if (translationsAutosave.enabled) {
      void translationsAutosave.flushNow();
    }
    if (linkTypesAutosave.enabled) {
      void linkTypesAutosave.flushNow();
    }
  }, [linkTypesAutosave, settingsAutosave, translationsAutosave]);

  const handleSaveSettings = useCallback(async () => {
    const ok = await settingsAutosave.flushNow();
    if (!ok) {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
      return;
    }
    await refresh().catch(() => undefined);
    toast({ title: "Configurações salvas" });
  }, [refresh, settingsAutosave]);

  const handleSaveTranslations = useCallback(async () => {
    const ok = await translationsAutosave.flushNow();
    if (!ok) {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as traduções.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Traduções salvas" });
  }, [translationsAutosave]);

  const handleSaveLinkTypes = useCallback(async () => {
    const ok = await linkTypesAutosave.flushNow();
    if (!ok) {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as redes sociais.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Redes sociais salvas" });
  }, [linkTypesAutosave]);

  const isSaving = settingsAutosave.status === "saving";
  const isSavingTranslations = translationsAutosave.status === "saving";
  const isSavingLinkTypes = linkTypesAutosave.status === "saving";

  const filteredTags = useMemo(() => {
    const query = tagQuery.trim().toLowerCase();
    const allTags = Array.from(new Set([...knownTags, ...Object.keys(tagTranslations)]));
    return allTags
      .filter((tag) => !query || tag.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "en"));
  }, [knownTags, tagTranslations, tagQuery]);

  const filteredGenres = useMemo(() => {
    const query = genreQuery.trim().toLowerCase();
    const allGenres = Array.from(new Set([...knownGenres, ...Object.keys(genreTranslations)]));
    return allGenres
      .filter((genre) => !query || genre.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "en"));
  }, [knownGenres, genreTranslations, genreQuery]);

  const filteredStaffRoles = useMemo(() => {
    const query = staffRoleQuery.trim().toLowerCase();
    const allRoles = Array.from(new Set([...knownStaffRoles, ...Object.keys(staffRoleTranslations)]));
    return allRoles
      .filter((role) => !query || role.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "en"));
  }, [knownStaffRoles, staffRoleTranslations, staffRoleQuery]);

  const userLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Carregando usuário...";
    }
    return currentUser?.name ?? "Usuário não conectado";
  }, [currentUser, isLoadingUser]);

  const userSubLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Aguarde";
    }
    return currentUser ? `@${currentUser.username}` : "OAuth Discord pendente";
  }, [currentUser, isLoadingUser]);

  const siteNamePreview = (settings.site.name || "Nekomata").trim() || "Nekomata";

  const branding = resolveBranding(settings);
  const legacySiteSymbol = branding.legacy.siteSymbolUrl;
  const legacyWordmark = branding.legacy.wordmarkUrl;
  const legacyWordmarkNavbar = branding.legacy.navbarWordmarkUrl;
  const legacyWordmarkFooter = branding.legacy.footerWordmarkUrl;
  const symbolAssetDirect = branding.direct.symbolAssetUrl;
  const wordmarkAssetDirect = branding.direct.wordmarkAssetUrl;
  const navbarSymbolOverrideDirect = branding.direct.navbarSymbolOverrideUrl;
  const footerSymbolOverrideDirect = branding.direct.footerSymbolOverrideUrl;
  const navbarWordmarkOverrideDirect = branding.direct.navbarWordmarkOverrideUrl;
  const footerWordmarkOverrideDirect = branding.direct.footerWordmarkOverrideUrl;
  const faviconUrl = settings.site.faviconUrl?.trim() || "";
  const shareImageUrl = settings.site.defaultShareImage?.trim() || "";

  const symbolAssetUrl = branding.assets.symbolUrl;
  const wordmarkAssetUrl = branding.assets.wordmarkUrl;
  const resolvedNavbarSymbolUrl = branding.navbar.symbolUrl;
  const resolvedFooterSymbolUrl = branding.footer.symbolUrl;
  const resolvedNavbarWordmarkUrl = branding.navbar.wordmarkUrl;
  const resolvedFooterWordmarkUrl = branding.footer.wordmarkUrl;
  const navbarMode: NavbarBrandMode = branding.display.navbar;
  const footerMode: FooterBrandMode = branding.display.footer;
  const showWordmarkInNavbarPreview = branding.navbar.showWordmark;
  const showWordmarkInFooterPreview = branding.footer.showWordmark;
  const showNavbarSymbolPreview = navbarMode === "symbol-text" || navbarMode === "symbol";
  const showNavbarTextPreview = navbarMode === "symbol-text" || navbarMode === "text";

  const logoFieldState: Record<LogoLibraryTarget, { value: string; preview: string; status: string }> = {
    "branding.assets.symbolUrl": {
      value: symbolAssetDirect,
      preview: symbolAssetUrl,
      status: symbolAssetDirect
        ? "Símbolo principal ativo."
        : legacySiteSymbol
          ? "Sem valor no modelo novo. Usando fallback legado."
          : "Sem símbolo definido.",
    },
    "branding.assets.wordmarkUrl": {
      value: wordmarkAssetDirect,
      preview: wordmarkAssetUrl,
      status: wordmarkAssetDirect
        ? "Logotipo principal ativo."
        : legacyWordmark || legacyWordmarkNavbar || legacyWordmarkFooter
          ? "Sem valor no modelo novo. Usando fallback legado."
          : "Sem logotipo definido.",
    },
    "site.faviconUrl": {
      value: faviconUrl,
      preview: faviconUrl,
      status: faviconUrl ? "Favicon ativa na aba do navegador." : "Sem favicon definida.",
    },
    "site.defaultShareImage": {
      value: shareImageUrl,
      preview: shareImageUrl,
      status: shareImageUrl
        ? "Imagem padrão de compartilhamento ativa."
        : "Sem imagem padrão de compartilhamento.",
    },
    "branding.overrides.navbarWordmarkUrl": {
      value: navbarWordmarkOverrideDirect,
      preview: resolvedNavbarWordmarkUrl,
      status: navbarWordmarkOverrideDirect
        ? "Override da navbar ativo."
        : resolvedNavbarWordmarkUrl
          ? "Sem override. Navbar usa o logotipo principal."
          : "Sem imagem disponível para a wordmark da navbar.",
    },
    "branding.overrides.footerWordmarkUrl": {
      value: footerWordmarkOverrideDirect,
      preview: resolvedFooterWordmarkUrl,
      status: footerWordmarkOverrideDirect
        ? "Override do footer ativo."
        : resolvedFooterWordmarkUrl
          ? "Sem override. Footer usa o logotipo principal."
          : "Sem imagem disponível para a wordmark do footer.",
    },
    "branding.overrides.navbarSymbolUrl": {
      value: navbarSymbolOverrideDirect,
      preview: resolvedNavbarSymbolUrl,
      status: navbarSymbolOverrideDirect
        ? "Override da navbar ativo."
        : resolvedNavbarSymbolUrl
          ? "Sem override. Navbar usa o símbolo principal."
          : "Sem símbolo disponível para a navbar.",
    },
    "branding.overrides.footerSymbolUrl": {
      value: footerSymbolOverrideDirect,
      preview: resolvedFooterSymbolUrl,
      status: footerSymbolOverrideDirect
        ? "Override do footer ativo."
        : resolvedFooterSymbolUrl
          ? "Sem override. Footer usa o símbolo principal."
          : "Sem símbolo disponível para o footer.",
    },
  };

  if (isLoading) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        userLabel={userLabel}
        userSubLabel={userSubLabel}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-28">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Carregando configurações...
            </div>
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      userLabel={userLabel}
      userSubLabel={userSubLabel}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main
        className="pt-24"
        onBlurCapture={() => {
          flushAllAutosave();
        }}
      >
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                  Configurações
                </div>
                <h1 className="mt-4 text-3xl font-semibold text-foreground animate-slide-up">Painel de ajustes</h1>
                <p
                  className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "0.2s" }}
                >
                  Atualize identidade, traduções e links globais do site.
                </p>
              </div>
              <DashboardAutosaveStatus
                title="Autosave das configurações"
                status={combinedAutosaveStatus}
                enabled={autosaveEnabled}
                onEnabledChange={handleAutosaveToggle}
                toggleDisabled={!autosaveRuntimeConfig.enabledByDefault}
                lastSavedAt={combinedLastSavedAt}
                errorMessage={combinedAutosaveErrorMessage}
                onManualSave={() => {
                  void handleSaveSettings();
                }}
                manualActionLabel={isSaving ? "Salvando..." : "Salvar ajustes"}
                manualActionDisabled={isSaving}
              />
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as SettingsTabKey)}
              className="mt-8 animate-slide-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="downloads">Downloads</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="footer">Footer</TabsTrigger>
                <TabsTrigger value="navbar">Navbar</TabsTrigger>
                <TabsTrigger value="redes-usuarios">Redes sociais</TabsTrigger>
                <TabsTrigger value="traducoes">Traduções</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do site</Label>
                        <Input
                          value={settings.site.name}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, name: event.target.value },
                              footer: { ...prev.footer, brandName: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Separador do título</Label>
                        <Input
                          value={settings.site.titleSeparator || " | "}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, titleSeparator: event.target.value },
                            }))
                          }
                          placeholder=" | "
                        />
                        <p className="text-xs text-muted-foreground">
                          Usado entre o título da página e o nome do site.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição curta</Label>
                        <Textarea
                          value={settings.site.description}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, description: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor de destaque</Label>
                        <div className="flex items-center gap-3">
                          <ColorPicker
                            label=""
                            showSwatch
                            buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/60 shadow-sm transition hover:border-primary/40"
                            value={settings.theme.accent || "#000000"}
                            onChange={(color) =>
                              setSettings((prev) => ({
                                ...prev,
                                theme: { ...prev.theme, accent: color.toString("hex") },
                              }))
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Atualiza a cor principal e o accent do site.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-border/60 bg-background/50 p-4">
                      <div>
                        <h2 className="text-lg font-semibold">Card de comunidade</h2>
                        <p className="text-xs text-muted-foreground">
                          Configure os textos e o botao principal do card de Discord.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="community-card-title">Titulo do card</Label>
                          <Input
                            id="community-card-title"
                            value={settings.community.inviteCard.title}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, title: event.target.value },
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="community-card-button-label">Texto do botao</Label>
                          <Input
                            id="community-card-button-label"
                            value={settings.community.inviteCard.ctaLabel}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, ctaLabel: event.target.value },
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="community-card-subtitle">Subtitulo</Label>
                          <Textarea
                            id="community-card-subtitle"
                            value={settings.community.inviteCard.subtitle}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, subtitle: event.target.value },
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="community-card-panel-title">Titulo do bloco interno</Label>
                          <Input
                            id="community-card-panel-title"
                            value={settings.community.inviteCard.panelTitle}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, panelTitle: event.target.value },
                                },
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="community-card-cta-url">URL do botao</Label>
                          <Input
                            id="community-card-cta-url"
                            value={settings.community.inviteCard.ctaUrl}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, ctaUrl: event.target.value },
                                },
                              }))
                            }
                            placeholder="https://discord.com/invite/..."
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="community-card-panel-description">Texto do bloco interno</Label>
                          <Textarea
                            id="community-card-panel-description"
                            value={settings.community.inviteCard.panelDescription}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                community: {
                                  ...prev.community,
                                  inviteCard: { ...prev.community.inviteCard, panelDescription: event.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">Logos e ícones de marca</h2>
                        <p className="text-xs text-muted-foreground">
                          Todos os ativos visuais em um só lugar, com fallback e prévia rápida.
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {logoEditorFields.map((field) => {
                          const state = logoFieldState[field.target];
                          const hasDirectValue = Boolean(state.value);
                          return (
                            <div
                              key={field.target}
                              className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3"
                            >
                              <div>
                                <p className="text-sm font-semibold">{field.label}</p>
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                              </div>

                              <div
                                className={`flex items-center justify-center rounded-xl border border-border/60 bg-background/60 p-3 ${field.frameClassName}`}
                              >
                                {state.preview ? (
                                  <img
                                    src={state.preview}
                                    alt={field.label}
                                    className={field.imageClassName}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem imagem definida</span>
                                )}
                              </div>

                              <p className="text-[11px] text-muted-foreground">{state.status}</p>

                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => openLibrary(field.target)}
                                >
                                  Biblioteca
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!hasDirectValue}
                                  onClick={() => clearLibraryImage(field.target)}
                                >
                                  Limpar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                          <Label>Exibição da marca na navbar</Label>
                          <Select
                            value={navbarMode}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                branding: {
                                  ...prev.branding,
                                  display: {
                                    ...prev.branding.display,
                                    navbar: value as NavbarBrandMode,
                                  },
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="wordmark">Wordmark</SelectItem>
                              <SelectItem value="symbol-text">Símbolo + texto</SelectItem>
                              <SelectItem value="symbol">Somente símbolo</SelectItem>
                              <SelectItem value="text">Somente texto</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Define como a identidade aparece no topo do site.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                          <Label>Exibição da marca no footer</Label>
                          <Select
                            value={footerMode}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                branding: {
                                  ...prev.branding,
                                  display: {
                                    ...prev.branding.display,
                                    footer: value as FooterBrandMode,
                                  },
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="wordmark">Wordmark</SelectItem>
                              <SelectItem value="symbol-text">Símbolo + texto</SelectItem>
                              <SelectItem value="text">Somente texto</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Define como a identidade aparece no rodapé.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Prévia navbar
                          </p>
                          <div className="mt-3 flex min-h-[68px] items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white">
                            {showWordmarkInNavbarPreview ? (
                              <img
                                src={resolvedNavbarWordmarkUrl}
                                alt={siteNamePreview}
                                className="h-9 w-auto max-w-[220px] object-contain"
                              />
                            ) : (
                              <>
                                {showNavbarSymbolPreview ? (
                                  resolvedNavbarSymbolUrl ? (
                                    <img
                                      src={resolvedNavbarSymbolUrl}
                                      alt="Logo principal"
                                      className="h-9 w-9 rounded-full object-contain"
                                    />
                                  ) : (
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold">
                                      {siteNamePreview.slice(0, 1).toUpperCase()}
                                    </span>
                                  )
                                ) : null}
                                {showNavbarTextPreview ? (
                                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                                    {siteNamePreview}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Prévia footer
                          </p>
                          <div className="mt-3 flex min-h-[68px] items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                            {showWordmarkInFooterPreview ? (
                              <img
                                src={resolvedFooterWordmarkUrl}
                                alt={siteNamePreview}
                                className="h-9 w-auto max-w-[220px] object-contain"
                              />
                            ) : footerMode === "text" ? (
                              <span className="text-lg font-black tracking-widest text-gradient-rainbow">
                                {siteNamePreview}
                              </span>
                            ) : (
                              <>
                                {resolvedFooterSymbolUrl ? (
                                  <img
                                    src={resolvedFooterSymbolUrl}
                                    alt="Logo do footer"
                                    className="h-9 w-9 rounded-full object-contain"
                                  />
                                ) : null}
                                <span className="text-lg font-black tracking-widest text-gradient-rainbow">
                                  {siteNamePreview}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="traducoes" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Tags</h2>
                        <p className="text-xs text-muted-foreground">
                          Termos em inglês importados do AniList com a tradução exibida no site.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncAniListTerms()}
                          disabled={isSyncingAniList}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {isSyncingAniList ? "Importando..." : "Importar AniList"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleSaveTranslations();
                          }}
                          disabled={isSavingTranslations}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Buscar tag"
                        value={tagQuery}
                        onChange={(event) => setTagQuery(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nova tag"
                          value={newTag}
                          onChange={(event) => setNewTag(event.target.value)}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const value = newTag.trim();
                            if (!value || tagTranslations[value] !== undefined) {
                              return;
                            }
                            setTagTranslations((prev) => ({ ...prev, [value]: "" }));
                            setNewTag("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {filteredTags.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma tag encontrada.</p>
                      ) : (
                        <div className="max-h-[420px] overflow-y-auto no-scrollbar">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background/90 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                                <th className="px-4 py-3 text-left font-medium">Tradução</th>
                                <th className="px-4 py-3 text-right font-medium">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {filteredTags.map((tag) => (
                                <tr key={tag} className="bg-background/40">
                                  <td className="px-4 py-3 font-medium text-foreground">{tag}</td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={tagTranslations[tag] || ""}
                                      placeholder={tag}
                                      onChange={(event) =>
                                        setTagTranslations((prev) => ({ ...prev, [tag]: event.target.value }))
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setTagTranslations((prev) => {
                                          const next = { ...prev };
                                          delete next[tag];
                                          return next;
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Gêneros</h2>
                        <p className="text-xs text-muted-foreground">
                          Termos em inglês importados do AniList com a tradução exibida no site.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncAniListTerms()}
                          disabled={isSyncingAniList}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {isSyncingAniList ? "Importando..." : "Importar AniList"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleSaveTranslations();
                          }}
                          disabled={isSavingTranslations}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Buscar gênero"
                        value={genreQuery}
                        onChange={(event) => setGenreQuery(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Novo gênero"
                          value={newGenre}
                          onChange={(event) => setNewGenre(event.target.value)}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const value = newGenre.trim();
                            if (!value || genreTranslations[value] !== undefined) {
                              return;
                            }
                            setGenreTranslations((prev) => ({ ...prev, [value]: "" }));
                            setNewGenre("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {filteredGenres.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum gênero encontrado.</p>
                      ) : (
                        <div className="max-h-[420px] overflow-y-auto no-scrollbar">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background/90 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                                <th className="px-4 py-3 text-left font-medium">Tradução</th>
                                <th className="px-4 py-3 text-right font-medium">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {filteredGenres.map((genre) => (
                                <tr key={genre} className="bg-background/40">
                                  <td className="px-4 py-3 font-medium text-foreground">{genre}</td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={genreTranslations[genre] || ""}
                                      placeholder={genre}
                                      onChange={(event) =>
                                        setGenreTranslations((prev) => ({ ...prev, [genre]: event.target.value }))
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setGenreTranslations((prev) => {
                                          const next = { ...prev };
                                          delete next[genre];
                                          return next;
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Cargos do AniList</h2>
                        <p className="text-xs text-muted-foreground">
                          Traduza funções da equipe do anime exibidas no projeto.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleSaveTranslations();
                        }}
                        disabled={isSavingTranslations}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Buscar cargo"
                        value={staffRoleQuery}
                        onChange={(event) => setStaffRoleQuery(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Novo cargo"
                          value={newStaffRole}
                          onChange={(event) => setNewStaffRole(event.target.value)}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const value = newStaffRole.trim();
                            if (!value || staffRoleTranslations[value] !== undefined) {
                              return;
                            }
                            setStaffRoleTranslations((prev) => ({ ...prev, [value]: "" }));
                            setNewStaffRole("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {filteredStaffRoles.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum cargo encontrado.</p>
                      ) : (
                        <div className="max-h-[420px] overflow-y-auto no-scrollbar">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background/90 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                                <th className="px-4 py-3 text-left font-medium">Tradução</th>
                                <th className="px-4 py-3 text-right font-medium">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {filteredStaffRoles.map((role) => (
                                <tr key={role} className="bg-background/40">
                                  <td className="px-4 py-3 font-medium text-foreground">{role}</td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={staffRoleTranslations[role] || ""}
                                      placeholder={role}
                                      onChange={(event) =>
                                        setStaffRoleTranslations((prev) => ({
                                          ...prev,
                                          [role]: event.target.value,
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setStaffRoleTranslations((prev) => {
                                          const next = { ...prev };
                                          delete next[role];
                                          return next;
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="downloads" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Fontes de download</h2>
                        <p className="text-xs text-muted-foreground">
                          Ajuste nome, cor e envie o SVG do serviço para exibição nos downloads.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            downloads: {
                              ...prev.downloads,
                              sources: [
                                ...prev.downloads.sources,
                                {
                                  id: `fonte-${Date.now()}`,
                                  label: "Nova fonte",
                                  color: "#64748B",
                                  icon: "",
                                  tintIcon: true,
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {settings.downloads.sources.map((source, index) => {
                        const shouldTint = source.tintIcon !== false;
                        return (
                          <div
                            key={`${source.id}-${index}`}
                            className="grid items-center gap-3 md:grid-cols-[1.2fr_0.25fr_0.6fr_1.6fr_auto]"
                          >
                            <Input
                              value={source.label}
                              onChange={(event) =>
                                setSettings((prev) => {
                                  const next = [...prev.downloads.sources];
                                  next[index] = { ...next[index], label: event.target.value };
                                  return { ...prev, downloads: { ...prev.downloads, sources: next } };
                                })
                              }
                              placeholder="Nome"
                            />
                            <div className="flex items-center justify-center">
                              <ColorPicker
                                label=""
                                showSwatch
                                buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/60 shadow-sm transition hover:border-primary/40"
                                value={source.color}
                                onChange={(color) =>
                                  setSettings((prev) => {
                                    const next = [...prev.downloads.sources];
                                    next[index] = { ...next[index], color: color.toString("hex") };
                                    return { ...prev, downloads: { ...prev.downloads, sources: next } };
                                  })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Aplicar ao ícone
                              </span>
                              <Switch
                                checked={shouldTint}
                                onCheckedChange={(checked) =>
                                  setSettings((prev) => {
                                    const next = [...prev.downloads.sources];
                                    next[index] = { ...next[index], tintIcon: checked };
                                    return { ...prev, downloads: { ...prev.downloads, sources: next } };
                                  })
                                }
                                aria-label={`Colorir SVG de ${source.label}`}
                              />
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              {isIconUrl(source.icon) ? (
                                shouldTint ? (
                                  <ThemedSvgLogo
                                    url={source.icon}
                                    label={`Ícone ${source.label}`}
                                    className="h-6 w-6 rounded bg-white/90 p-1"
                                    color={source.color}
                                  />
                                ) : (
                                  <img
                                    src={source.icon}
                                    alt={`Ícone ${source.label}`}
                                    className="h-6 w-6 rounded bg-white/90 p-1"
                                  />
                                )
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[10px]">
                                  SVG
                                </span>
                              )}
                              <span className="truncate">
                                {isIconUrl(source.icon) ? "SVG atual" : "Sem SVG"}
                              </span>
                              <div className="ml-auto flex items-center gap-2">
                                <Input
                                  id={`download-icon-${index}`}
                                  type="file"
                                  accept="image/svg+xml"
                                  className="sr-only"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      uploadDownloadIcon(file, index);
                                    }
                                  }}
                                  disabled={uploadingKey === `download-icon-${index}`}
                                />
                                <Label
                                  htmlFor={`download-icon-${index}`}
                                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background px-3 text-[11px] font-medium text-foreground transition hover:border-primary/50"
                                >
                                  Escolher SVG
                                </Label>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  downloads: {
                                    ...prev.downloads,
                                    sources: prev.downloads.sources.filter((_, idx) => idx !== index),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipe" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Funções do time</h2>
                        <p className="text-xs text-muted-foreground">
                          Ajuste os cargos disponíveis para membros.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            teamRoles: [
                              ...prev.teamRoles,
                              { id: `role-${Date.now()}`, label: "Nova função", icon: "user" },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      {settings.teamRoles.map((role, index) => (
                        <div key={`${role.id}-${index}`} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
                          <Input
                            value={role.label}
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.teamRoles];
                                next[index] = { ...next[index], label: event.target.value };
                                return { ...prev, teamRoles: next };
                              })
                            }
                            placeholder="Nome"
                          />
                          <Select
                            value={role.icon || "user"}
                            onValueChange={(value) =>
                              setSettings((prev) => {
                                const next = [...prev.teamRoles];
                                next[index] = { ...next[index], icon: value };
                                return { ...prev, teamRoles: next };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ícone" />
                            </SelectTrigger>
                            <SelectContent>
                              {roleIconOptions.map((option) => {
                                const Icon = roleIconMap[option.id] || User;
                                return (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span>{option.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                teamRoles: prev.teamRoles.filter((_, idx) => idx !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="redes-usuarios" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Redes sociais (Usuários)</h2>
                        <p className="text-xs text-muted-foreground">
                          Opções exibidas no editor de usuários.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setLinkTypes((prev) => [
                              ...prev,
                              { id: `nova-${Date.now()}`, label: "Nova rede", icon: "globe" },
                            ])
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleSaveLinkTypes();
                          }}
                          disabled={isSavingLinkTypes}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {isSavingLinkTypes ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {linkTypes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma rede cadastrada.</p>
                      ) : null}
                      {linkTypes.map((link, index) => {
                        const isCustomIcon = isIconUrl(link.icon);
                        return (
                          <div
                            key={`${link.id}-${index}`}
                            className="grid items-center gap-3 md:grid-cols-[1fr_1.6fr_auto]"
                          >
                            <Input
                              value={link.label}
                              placeholder="Label"
                              onChange={(event) =>
                                setLinkTypes((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], label: event.target.value };
                                  return next;
                                })
                              }
                            />
                            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              {isCustomIcon ? (
                                <ThemedSvgLogo
                                  url={link.icon}
                                  label={`Ícone ${link.label}`}
                                  className="h-6 w-6 text-primary"
                                />
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[10px]">
                                  SVG
                                </span>
                              )}
                              <span className="truncate">
                                {isCustomIcon ? "SVG atual" : "Sem SVG"}
                              </span>
                              <div className="ml-auto flex items-center gap-2">
                                <Input
                                  id={`linktype-icon-${index}`}
                                  type="file"
                                  accept="image/svg+xml"
                                  className="sr-only"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      uploadLinkTypeIcon(file, index);
                                    }
                                  }}
                                  disabled={uploadingKey === `linktype-icon-${index}`}
                                />
                                <Label
                                  htmlFor={`linktype-icon-${index}`}
                                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background px-3 text-[11px] font-medium text-foreground transition hover:border-primary/50"
                                >
                                  Escolher SVG
                                </Label>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setLinkTypes((prev) => prev.filter((_, idx) => idx !== index))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="navbar" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Links do menu</h2>
                        <p className="text-xs text-muted-foreground">
                          Ordem e URLs usados na navbar do site.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            navbar: {
                              ...prev.navbar,
                              links: [...prev.navbar.links, { label: "Novo link", href: "/", icon: "link" }],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {settings.navbar.links.map((link, index) => (
                        <div key={`${link.label}-${index}`} className="grid gap-3 md:grid-cols-[0.85fr_1fr_1.6fr_auto]">
                          <Select
                            value={link.icon || "link"}
                            onValueChange={(value) =>
                              setSettings((prev) => {
                                const nextLinks = [...prev.navbar.links];
                                nextLinks[index] = { ...nextLinks[index], icon: value };
                                return { ...prev, navbar: { ...prev.navbar, links: nextLinks } };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ícone" />
                            </SelectTrigger>
                            <SelectContent>
                              {navbarIconOptions.map((option) => {
                                const OptionIcon = option.icon;
                                return (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div className="flex items-center gap-2">
                                      <OptionIcon className="h-4 w-4 text-muted-foreground" />
                                      <span>{option.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <Input
                            value={link.label}
                            placeholder="Label"
                            onChange={(event) =>
                              setSettings((prev) => {
                                const nextLinks = [...prev.navbar.links];
                                nextLinks[index] = { ...nextLinks[index], label: event.target.value };
                                return { ...prev, navbar: { ...prev.navbar, links: nextLinks } };
                              })
                            }
                          />
                          <Input
                            value={link.href}
                            placeholder="URL ou rota"
                            onChange={(event) =>
                              setSettings((prev) => {
                                const nextLinks = [...prev.navbar.links];
                                nextLinks[index] = { ...nextLinks[index], href: event.target.value };
                                return { ...prev, navbar: { ...prev.navbar, links: nextLinks } };
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                navbar: {
                                  ...prev.navbar,
                                  links: prev.navbar.links.filter((_, idx) => idx !== index),
                                },
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="footer" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div>
                      <h2 className="text-lg font-semibold">Conteúdo do footer</h2>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={settings.footer.brandDescription}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: { ...prev.footer, brandDescription: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Colunas de links</h2>
                      <p className="text-xs text-muted-foreground">Edite as seções do footer.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              columns: [
                                ...prev.footer.columns,
                                { title: "Nova coluna", links: [] },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-6">
                      {settings.footer.columns.map((column, columnIndex) => (
                        <div key={`${column.title}-${columnIndex}`} className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Input
                              value={column.title}
                              onChange={(event) =>
                                setSettings((prev) => {
                                  const next = [...prev.footer.columns];
                                  next[columnIndex] = { ...next[columnIndex], title: event.target.value };
                                  return { ...prev, footer: { ...prev.footer, columns: next } };
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  footer: {
                                    ...prev.footer,
                                    columns: prev.footer.columns.filter((_, idx) => idx !== columnIndex),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            {column.links.map((link, linkIndex) => (
                              <div key={`${link.label}-${linkIndex}`} className="grid gap-3 md:grid-cols-[1fr_1.6fr_auto]">
                                <Input
                                  value={link.label}
                                  placeholder="Label"
                                  onChange={(event) =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = [...nextColumns[columnIndex].links];
                                      links[linkIndex] = { ...links[linkIndex], label: event.target.value };
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                />
                                <Input
                                  value={link.href}
                                  placeholder="URL"
                                  onChange={(event) =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = [...nextColumns[columnIndex].links];
                                      links[linkIndex] = { ...links[linkIndex], href: event.target.value };
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = nextColumns[columnIndex].links.filter((_, idx) => idx !== linkIndex);
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setSettings((prev) => {
                                  const nextColumns = [...prev.footer.columns];
                                  const links = [...nextColumns[columnIndex].links, { label: "", href: "" }];
                                  nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                  return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                })
                              }
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar link
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Redes sociais</h2>
                        <p className="text-xs text-muted-foreground">Links exibidos no footer.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              socialLinks: [
                                ...prev.footer.socialLinks,
                                {
                                  label: "Nova rede",
                                  href: "",
                                  icon: linkTypes[0]?.icon || "link",
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {settings.footer.socialLinks.map((link, index) => (
                        <div
                          key={`${link.label}-${index}`}
                          data-testid={`footer-social-row-${index}`}
                          className={`grid items-center gap-3 rounded-xl border p-2 transition md:grid-cols-[auto_0.8fr_1.6fr_auto] ${
                            footerSocialDragOverIndex === index
                              ? "border-primary/40 bg-primary/5"
                              : "border-transparent"
                          }`}
                          onDragOver={(event) => handleFooterSocialDragOver(event, index)}
                          onDrop={(event) => handleFooterSocialDrop(event, index)}
                        >
                          <button
                            type="button"
                            draggable
                            className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary active:cursor-grabbing"
                            aria-label={`Arrastar rede ${link.label || index + 1}`}
                            onDragStart={(event) => handleFooterSocialDragStart(event, index)}
                            onDragEnd={clearFooterSocialDragState}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <Select
                            value={link.icon || "link"}
                            onValueChange={(value) =>
                              setSettings((prev) => {
                                const next = [...prev.footer.socialLinks];
                                const matched = linkTypes.find((item) => item.icon === value || item.id === value);
                                next[index] = {
                                  ...next[index],
                                  icon: value,
                                  label: matched?.label || link.label || "Rede social",
                                };
                                return { ...prev, footer: { ...prev.footer, socialLinks: next } };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ícone" />
                            </SelectTrigger>
                            <SelectContent>
                              {linkTypes.length === 0 ? (
                                <SelectItem value="link" disabled>
                                  Cadastre redes sociais na aba acima
                                </SelectItem>
                              ) : null}
                              {linkTypes.map((option) => {
                                const iconValue = option.icon || option.id;
                                const isCustomIcon = isIconUrl(iconValue);
                                const Icon = socialIconMap[option.id] || Link2;
                                return (
                                  <SelectItem key={option.id} value={iconValue}>
                                    <div className="flex items-center gap-2">
                                      {isCustomIcon ? (
                                        <ThemedSvgLogo
                                          url={iconValue}
                                          label={`Ícone ${option.label}`}
                                          className="h-4 w-4 text-primary"
                                        />
                                      ) : (
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>{option.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <Input
                            value={link.href}
                            placeholder="URL"
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.footer.socialLinks];
                                next[index] = { ...next[index], href: event.target.value };
                                return { ...prev, footer: { ...prev.footer, socialLinks: next } };
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  socialLinks: prev.footer.socialLinks.filter((_, idx) => idx !== index),
                                },
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div>
                      <h2 className="text-lg font-semibold">Textos legais</h2>
                      <p className="text-xs text-muted-foreground">Descrição, aviso e copyright.</p>
                    </div>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Parágrafos do aviso</Label>
                        <div className="space-y-3">
                          {settings.footer.disclaimer.map((item, index) => (
                            <div key={`disclaimer-${index}`} className="grid gap-3 md:grid-cols-[1fr_auto]">
                              <Textarea
                                value={item}
                                onChange={(event) =>
                                  setSettings((prev) => {
                                    const next = [...prev.footer.disclaimer];
                                    next[index] = event.target.value;
                                    return { ...prev, footer: { ...prev.footer, disclaimer: next } };
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    footer: {
                                      ...prev.footer,
                                      disclaimer: prev.footer.disclaimer.filter((_, idx) => idx !== index),
                                    },
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: {
                                ...prev.footer,
                                disclaimer: [...prev.footer.disclaimer, ""],
                              },
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar paragrafo
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Titulo do destaque</Label>
                          <Input
                            value={settings.footer.highlightTitle}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: { ...prev.footer, highlightTitle: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição do destaque</Label>
                          <Textarea
                            value={settings.footer.highlightDescription}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: { ...prev.footer, highlightDescription: event.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Copyright</Label>
                        <Input
                          value={settings.footer.copyright}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: { ...prev.footer, copyright: event.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
        </main>
        <ImageLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          apiBase={apiBase}
          description="Selecione uma imagem ja enviada para reutilizar ou exclua itens que nao estejam em uso."
          uploadFolder="branding"
          listFolders={[""]}
          showUrlImport={false}
          allowDeselect
          mode="single"
          currentSelectionUrls={currentLibrarySelection ? [currentLibrarySelection] : []}
          onSave={({ urls }) => applyLibraryImage(urls[0] || "")}
        />
    </DashboardShell>
  );
};

export default DashboardSettings;



