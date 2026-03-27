import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  autosaveRuntimeConfig,
  autosaveStorageKeys,
  readAutosavePreference,
  writeAutosavePreference,
} from "@/config/autosave";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { apiFetch } from "@/lib/api-client";
import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";
import {
  readDashboardSettingsCache,
  writeDashboardSettingsCache,
} from "@/lib/dashboard-settings-cache";
import type { SiteSettings } from "@/types/site-settings";
import { normalizeProjectReaderConfig } from "../../../../shared/project-reader.js";
import {
  DASHBOARD_SETTINGS_DEFAULT_TAB,
  isDashboardSettingsTab,
  normalizeDefaultShareImageSettings,
  normalizeLinkTypeId,
  parseDashboardSettingsTabParam,
  reorderItems,
  sanitizeReaderProjectTypesForDashboardSave,
  type LinkTypeItem,
  type ReaderProjectTypeKey,
  type SettingsTabKey,
  type TranslationsPayload,
} from "./shared";

type UseDashboardSettingsResourceOptions = {
  apiBase: string;
  location: { pathname: string };
  navigate: (to: string, options?: { replace?: boolean }) => void;
  publicSettings: SiteSettings;
  refresh: () => Promise<unknown>;
  searchParams: URLSearchParams;
  setSearchParams: (nextParams: URLSearchParams, options?: { replace?: boolean }) => void;
};

export const useDashboardSettingsResource = ({
  apiBase,
  location,
  navigate,
  publicSettings,
  refresh,
  searchParams,
  setSearchParams,
}: UseDashboardSettingsResourceOptions) => {
  const initialAutosaveEnabledRef = useRef(
    autosaveRuntimeConfig.enabledByDefault &&
      readAutosavePreference(autosaveStorageKeys.settings, true),
  );
  const initialCacheRef = useRef(readDashboardSettingsCache());
  const [settings, setSettings] = useState<SiteSettings>(
    initialCacheRef.current?.settings ?? normalizeDefaultShareImageSettings(publicSettings),
  );
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.tagTranslations ?? {},
  );
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.genreTranslations ?? {},
  );
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.staffRoleTranslations ?? {},
  );
  const [knownTags, setKnownTags] = useState<string[]>(initialCacheRef.current?.knownTags ?? []);
  const [knownGenres, setKnownGenres] = useState<string[]>(
    initialCacheRef.current?.knownGenres ?? [],
  );
  const [knownStaffRoles, setKnownStaffRoles] = useState<string[]>(
    initialCacheRef.current?.knownStaffRoles ?? [],
  );
  const [linkTypes, setLinkTypes] = useState<LinkTypeItem[]>(
    initialCacheRef.current?.linkTypes ?? [],
  );
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedSettings, setHasResolvedSettings] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedTranslations, setHasResolvedTranslations] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedLinkTypes, setHasResolvedLinkTypes] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedProjectMetadata, setHasResolvedProjectMetadata] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [isSyncingAniList, setIsSyncingAniList] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [staffRoleQuery, setStaffRoleQuery] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(() =>
    parseDashboardSettingsTabParam(searchParams.get("tab")),
  );
  const [footerSocialDragIndex, setFooterSocialDragIndex] = useState<number | null>(null);
  const [footerSocialDragOverIndex, setFooterSocialDragOverIndex] = useState<number | null>(null);
  const hasSyncedAniList = useRef(false);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(hasLoadedOnce);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const background = hasLoadedOnceRef.current;

      setHasLoadError(false);
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
        setHasResolvedSettings(false);
      }
      if (!initialCacheRef.current) {
        setHasResolvedTranslations(false);
        setHasResolvedLinkTypes(false);
        setHasResolvedProjectMetadata(false);
      }

      try {
        const settingsPromise = apiFetch(apiBase, "/api/settings", { auth: true });
        const translationsPromise = apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });
        const projectsPromise = apiFetch(apiBase, "/api/projects", { auth: true });
        const linkTypesPromise = apiFetch(apiBase, "/api/link-types");

        const settingsRes = await settingsPromise;
        if (!settingsRes.ok) {
          throw new Error("settings_load_failed");
        }
        const settingsData = await settingsRes.json();
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }
        const nextSettings = settingsData.settings
          ? normalizeDefaultShareImageSettings(
              mergeSettings(defaultSettings, settingsData.settings),
            )
          : normalizeDefaultShareImageSettings(publicSettings);
        setSettings(nextSettings);
        setHasLoadedOnce(true);
        setHasResolvedSettings(true);
        setIsInitialLoading(false);

        const [translationsRes, projectsRes, linkTypesRes] = await Promise.all([
          translationsPromise,
          projectsPromise,
          linkTypesPromise,
        ]);
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        let nextTagTranslations: Record<string, string> = {};
        let nextGenreTranslations: Record<string, string> = {};
        let nextStaffRoleTranslations: Record<string, string> = {};
        if (translationsRes.ok) {
          const translationsData = await translationsRes.json();
          nextTagTranslations = translationsData.tags || {};
          nextGenreTranslations = translationsData.genres || {};
          nextStaffRoleTranslations = translationsData.staffRoles || {};
        }
        setTagTranslations(nextTagTranslations);
        setGenreTranslations(nextGenreTranslations);
        setStaffRoleTranslations(nextStaffRoleTranslations);
        setHasResolvedTranslations(true);

        let nextKnownTags: string[] = [];
        let nextKnownGenres: string[] = [];
        let nextKnownStaffRoles: string[] = [];
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const projects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
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
          nextKnownTags = Array.from(tags).sort((a, b) => a.localeCompare(b, "en"));
          nextKnownGenres = Array.from(genres).sort((a, b) => a.localeCompare(b, "en"));
          nextKnownStaffRoles = Array.from(staffRoles).sort((a, b) => a.localeCompare(b, "en"));
        }
        setKnownTags(nextKnownTags);
        setKnownGenres(nextKnownGenres);
        setKnownStaffRoles(nextKnownStaffRoles);
        setHasResolvedProjectMetadata(true);

        let nextLinkTypes: LinkTypeItem[] = [];
        if (linkTypesRes.ok) {
          const linkTypesData = await linkTypesRes.json();
          nextLinkTypes = Array.isArray(linkTypesData.items) ? linkTypesData.items : [];
        }
        setLinkTypes(nextLinkTypes);
        setHasResolvedLinkTypes(true);

        writeDashboardSettingsCache({
          settings: nextSettings,
          tagTranslations: nextTagTranslations,
          genreTranslations: nextGenreTranslations,
          staffRoleTranslations: nextStaffRoleTranslations,
          knownTags: nextKnownTags,
          knownGenres: nextKnownGenres,
          knownStaffRoles: nextKnownStaffRoles,
          linkTypes: nextLinkTypes,
        });
      } catch {
        if (isActive && requestIdRef.current === requestId) {
          if (!hasLoadedOnceRef.current) {
            setSettings(normalizeDefaultShareImageSettings(publicSettings));
            setTagTranslations({});
            setGenreTranslations({});
            setStaffRoleTranslations({});
            setKnownTags([]);
            setKnownGenres([]);
            setKnownStaffRoles([]);
            setLinkTypes([]);
            setHasResolvedTranslations(false);
            setHasResolvedLinkTypes(false);
            setHasResolvedProjectMetadata(false);
          }
          setHasLoadError(true);
        }
      } finally {
        if (isActive && requestIdRef.current === requestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, loadVersion, publicSettings]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes")) {
      return;
    }
    const rawTab = String(searchParams.get("tab") || "").trim();
    if (rawTab !== "preview-paginas") {
      return;
    }
    navigate("/dashboard/paginas?tab=preview", { replace: true });
  }, [location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes") || !hasResolvedSettings) {
      return;
    }
    const requestedTab = parseDashboardSettingsTabParam(searchParams.get("tab"));
    setActiveTab((previous) => (previous === requestedTab ? previous : requestedTab));
  }, [hasResolvedSettings, location.pathname, searchParams]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes") || !hasResolvedSettings) {
      return;
    }
    const rawTab = String(searchParams.get("tab") || "").trim();
    if (rawTab !== "navbar" && rawTab !== "footer") {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "layout");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [hasResolvedSettings, location.pathname, searchParams, setSearchParams]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes") || !hasResolvedSettings) {
      return;
    }
    const rawTab = String(searchParams.get("tab") || "").trim();
    if (!rawTab || rawTab === "navbar" || rawTab === "footer" || isDashboardSettingsTab(rawTab)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tab");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [hasResolvedSettings, location.pathname, searchParams, setSearchParams]);

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard/configuracoes") || !hasResolvedSettings) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (activeTab === DASHBOARD_SETTINGS_DEFAULT_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeTab);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, hasResolvedSettings, location.pathname, searchParams, setSearchParams]);

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
    if (!hasResolvedTranslations || hasSyncedAniList.current) {
      return;
    }
    hasSyncedAniList.current = true;
    void syncAniListTerms({ silent: true });
  }, [hasResolvedTranslations, syncAniListTerms]);

  const clearFooterSocialDragState = useCallback(() => {
    setFooterSocialDragIndex(null);
    setFooterSocialDragOverIndex(null);
  }, []);

  const handleFooterSocialDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, index: number) => {
      setFooterSocialDragIndex(index);
      setFooterSocialDragOverIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleFooterSocialDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, index: number) => {
      if (footerSocialDragIndex === null) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (footerSocialDragOverIndex !== index) {
        setFooterSocialDragOverIndex(index);
      }
    },
    [footerSocialDragIndex, footerSocialDragOverIndex],
  );

  const handleFooterSocialDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, index: number) => {
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
    },
    [clearFooterSocialDragState, footerSocialDragIndex],
  );

  const moveFooterSocialLink = useCallback((from: number, to: number) => {
    setSettings((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        socialLinks: reorderItems(prev.footer.socialLinks, from, to),
      },
    }));
  }, []);

  const saveSettingsResource = useCallback(
    async (snapshot: SiteSettings) => {
      const nextSettings = normalizeDefaultShareImageSettings(snapshot);
      const sanitizedSettings: SiteSettings = {
        ...nextSettings,
        reader: {
          ...nextSettings.reader,
          projectTypes: sanitizeReaderProjectTypesForDashboardSave(nextSettings.reader.projectTypes),
        },
      };
      const socialDiscord = sanitizedSettings.footer.socialLinks.find(
        (link) => String(link.label || "").toLowerCase() === "discord",
      );
      if (socialDiscord?.href) {
        sanitizedSettings.community.discordUrl = socialDiscord.href;
      }
      const response = await apiFetch(apiBase, "/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ settings: sanitizedSettings }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const normalizedSettings = normalizeDefaultShareImageSettings(
        mergeSettings(defaultSettings, data?.settings || sanitizedSettings),
      );
      setSettings(normalizedSettings);
      writeDashboardSettingsCache({
        settings: normalizedSettings,
        tagTranslations,
        genreTranslations,
        staffRoleTranslations,
        knownTags,
        knownGenres,
        knownStaffRoles,
        linkTypes,
      });
      return normalizedSettings;
    },
    [
      apiBase,
      genreTranslations,
      knownGenres,
      knownStaffRoles,
      knownTags,
      linkTypes,
      staffRoleTranslations,
      tagTranslations,
    ],
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
      writeDashboardSettingsCache({
        settings,
        tagTranslations: normalizedTranslations.tags,
        genreTranslations: normalizedTranslations.genres,
        staffRoleTranslations: normalizedTranslations.staffRoles,
        knownTags,
        knownGenres,
        knownStaffRoles,
        linkTypes,
      });
      return normalizedTranslations;
    },
    [apiBase, knownGenres, knownStaffRoles, knownTags, linkTypes, settings],
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
      writeDashboardSettingsCache({
        settings,
        tagTranslations,
        genreTranslations,
        staffRoleTranslations,
        knownTags,
        knownGenres,
        knownStaffRoles,
        linkTypes: resolvedItems,
      });
      return resolvedItems;
    },
    [
      apiBase,
      genreTranslations,
      knownGenres,
      knownStaffRoles,
      knownTags,
      settings,
      staffRoleTranslations,
      tagTranslations,
    ],
  );

  const settingsAutosave = useAutosave<SiteSettings>({
    value: settings,
    onSave: saveSettingsResource,
    isReady: hasResolvedSettings,
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
    isReady: hasResolvedTranslations,
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
    isReady: hasResolvedLinkTypes,
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

  const autosaveEnabled = useMemo(
    () => settingsAutosave.enabled && translationsAutosave.enabled && linkTypesAutosave.enabled,
    [linkTypesAutosave.enabled, settingsAutosave.enabled, translationsAutosave.enabled],
  );

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
    if (!hasResolvedSettings || !hasPendingChanges) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadCompatibility(event);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges, hasResolvedSettings]);

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
  }, [knownTags, tagQuery, tagTranslations]);

  const filteredGenres = useMemo(() => {
    const query = genreQuery.trim().toLowerCase();
    const allGenres = Array.from(new Set([...knownGenres, ...Object.keys(genreTranslations)]));
    return allGenres
      .filter((genre) => !query || genre.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "en"));
  }, [genreQuery, genreTranslations, knownGenres]);

  const filteredStaffRoles = useMemo(() => {
    const query = staffRoleQuery.trim().toLowerCase();
    const allRoles = Array.from(
      new Set([...knownStaffRoles, ...Object.keys(staffRoleTranslations)]),
    );
    return allRoles
      .filter((role) => !query || role.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "en"));
  }, [knownStaffRoles, staffRoleQuery, staffRoleTranslations]);

  const readerPresets = useMemo(
    () => ({
      manga: normalizeProjectReaderConfig(settings.reader?.projectTypes?.manga, {
        projectType: "manga",
      }),
      webtoon: normalizeProjectReaderConfig(settings.reader?.projectTypes?.webtoon, {
        projectType: "webtoon",
      }),
    }),
    [settings.reader?.projectTypes?.manga, settings.reader?.projectTypes?.webtoon],
  );

  const updateReaderPreset = useCallback(
    (
      key: ReaderProjectTypeKey,
      updater: (
        current: SiteSettings["reader"]["projectTypes"][ReaderProjectTypeKey],
      ) => SiteSettings["reader"]["projectTypes"][ReaderProjectTypeKey],
    ) => {
      setSettings((prev) => ({
        ...prev,
        reader: {
          ...prev.reader,
          projectTypes: {
            ...prev.reader.projectTypes,
            [key]: updater(prev.reader.projectTypes[key]),
          },
        },
      }));
    },
    [],
  );

  const hasBlockingLoadError = !hasLoadedOnce && hasLoadError;
  const hasRetainedLoadError = hasLoadedOnce && hasLoadError;

  useDashboardRefreshToast({
    active: isRefreshing && hasLoadedOnce,
    title: "Atualizando configurações",
    description: "Buscando ajustes globais mais recentes.",
  });

  const requestReload = useCallback(() => {
    setLoadVersion((previous) => previous + 1);
  }, []);

  return {
    activeTab,
    autosaveEnabled,
    clearFooterSocialDragState,
    combinedAutosaveErrorMessage,
    combinedAutosaveStatus,
    combinedLastSavedAt,
    filteredGenres,
    filteredStaffRoles,
    filteredTags,
    flushAllAutosave,
    footerSocialDragOverIndex,
    genreQuery,
    genreTranslations,
    handleAutosaveToggle,
    handleFooterSocialDragOver,
    handleFooterSocialDragStart,
    handleFooterSocialDrop,
    handleSaveLinkTypes,
    handleSaveSettings,
    handleSaveTranslations,
    hasBlockingLoadError,
    hasLoadError,
    hasResolvedLinkTypes,
    hasResolvedProjectMetadata,
    hasResolvedSettings,
    hasResolvedTranslations,
    hasRetainedLoadError,
    isInitialLoading,
    isRefreshing,
    isSaving,
    isSavingLinkTypes,
    isSavingTranslations,
    isSyncingAniList,
    knownGenres,
    knownStaffRoles,
    knownTags,
    linkTypes,
    moveFooterSocialLink,
    newGenre,
    newStaffRole,
    newTag,
    readerPresets,
    requestReload,
    setActiveTab,
    setGenreQuery,
    setGenreTranslations,
    setLinkTypes,
    setNewGenre,
    setNewStaffRole,
    setNewTag,
    setSettings,
    setStaffRoleQuery,
    setStaffRoleTranslations,
    setTagQuery,
    setTagTranslations,
    settings,
    staffRoleQuery,
    staffRoleTranslations,
    syncAniListTerms,
    tagQuery,
    tagTranslations,
    updateReaderPreset,
  };
};