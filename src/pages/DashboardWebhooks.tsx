import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import {
  dashboardAnimationDelay,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { Plus, Save, Send, Trash2 } from "lucide-react";

type ChannelKey = "posts" | "projects";
type EventKey = "post_create" | "post_update" | "project_release" | "project_adjust";
type SaveSectionKey = "types" | "posts" | "projects";

const SECTION_REVEAL_DELAYS: Record<SaveSectionKey, number> = {
  types: 0,
  posts: dashboardMotionDelays.sectionStepMs,
  projects: dashboardMotionDelays.sectionStepMs * 2,
};

type TemplateField = { name: string; value: string; inline: boolean };
type TemplateEmbed = {
  title: string;
  description: string;
  footerText: string;
  footerIconUrl: string;
  url: string;
  color: string;
  authorName: string;
  authorIconUrl: string;
  authorUrl: string;
  thumbnailUrl: string;
  imageUrl: string;
  fields: TemplateField[];
};
type Template = { content: string; embed: TemplateEmbed };
type TypeRole = { type: string; roleId: string; enabled: boolean; order: number };
type DashboardCurrentUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  permissions?: string[];
  grants?: Partial<Record<string, boolean>>;
};

type EditorialSettings = {
  version: 1;
  mentionMode: "role_id";
  mentionFallback: "skip";
  generalReleaseRoleId: string;
  typeRoles: TypeRole[];
  channels: {
    posts: {
      enabled: boolean;
      webhookUrl: string;
      timeoutMs: number;
      retries: number;
      events: { post_create: boolean; post_update: boolean };
      templates: { post_create: Template; post_update: Template };
    };
    projects: {
      enabled: boolean;
      webhookUrl: string;
      timeoutMs: number;
      retries: number;
      events: { project_release: boolean; project_adjust: boolean };
      templates: { project_release: Template; project_adjust: Template };
    };
  };
};

const CHANNEL_EVENTS: Record<ChannelKey, EventKey[]> = {
  posts: ["post_create", "post_update"],
  projects: ["project_release", "project_adjust"],
};

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  posts: "Posts",
  projects: "Projetos",
};

const EVENT_LABELS: Record<EventKey, string> = {
  post_create: "Novo post",
  post_update: "Post atualizado",
  project_release: "Novo lançamento",
  project_adjust: "Ajuste em capítulo/episódio",
};

const COMMON_PLACEHOLDERS = [
  "event.key",
  "event.label",
  "event.occurredAt",
  "site.name",
  "site.url",
  "site.logoUrl",
  "site.coverImageUrl",
  "site.faviconUrl",
  "mention.type",
  "mention.project",
  "mention.release",
  "mention.all",
  "author.name",
  "author.avatarUrl",
];

const POST_PLACEHOLDERS = [
  "post.id",
  "post.title",
  "post.slug",
  "post.url",
  "post.status",
  "post.author",
  "post.authorAvatarUrl",
  "post.publishedAt",
  "post.updatedAt",
  "post.excerpt",
  "post.tags",
  "post.coverImageUrl",
  "post.coverAlt",
  "post.imageUrl",
  "post.ogImageUrl",
];

const PROJECT_PLACEHOLDERS = [
  "project.id",
  "project.title",
  "project.type",
  "project.category",
  "project.url",
  "project.cover",
  "project.banner",
  "project.heroImageUrl",
  "project.imageUrl",
  "project.backdropImageUrl",
  "project.ogImageUrl",
  "project.synopsis",
  "project.tags",
  "project.genres",
];

const CHAPTER_PLACEHOLDERS = [
  "chapter.number",
  "chapter.volume",
  "chapter.title",
  "chapter.synopsis",
  "chapter.releaseDate",
  "chapter.updatedAt",
  "chapter.coverImageUrl",
  "chapter.imageUrl",
  "chapter.ogImageUrl",
];

const UPDATE_PLACEHOLDERS = [
  "update.kind",
  "update.reason",
  "update.unit",
  "update.episodeNumber",
  "update.volume",
];

const PLACEHOLDERS: Record<EventKey, string[]> = {
  post_create: [...COMMON_PLACEHOLDERS, ...POST_PLACEHOLDERS, ...PROJECT_PLACEHOLDERS],
  post_update: [...COMMON_PLACEHOLDERS, ...POST_PLACEHOLDERS, ...PROJECT_PLACEHOLDERS],
  project_release: [
    ...COMMON_PLACEHOLDERS,
    ...PROJECT_PLACEHOLDERS,
    ...CHAPTER_PLACEHOLDERS,
    ...UPDATE_PLACEHOLDERS,
  ],
  project_adjust: [
    ...COMMON_PLACEHOLDERS,
    ...PROJECT_PLACEHOLDERS,
    ...CHAPTER_PLACEHOLDERS,
    ...UPDATE_PLACEHOLDERS,
  ],
};

const DEFAULT_PROJECT_TYPES = ["Anime", "Manga", "Light Novel"];
const ROLE_ID_PATTERN = /^\d+$/;
const WEBHOOK_URL_PATTERN = /^https?:\/\/.+/i;
const DEFAULT_EVENT_COLORS: Record<EventKey, string> = {
  post_create: "#3b82f6",
  post_update: "#f59e0b",
  project_release: "#10b981",
  project_adjust: "#f59e0b",
};

const defaultTemplate = (eventKey: EventKey): Template => ({
  content: "{{mention.all}}",
  embed: {
    title: eventKey.startsWith("post") ? "{{post.title}}" : "{{project.title}}",
    description: eventKey.startsWith("post")
      ? "{{post.excerpt}}\n{{post.url}}"
      : "{{update.reason}}\n{{project.url}}",
    footerText: "{{site.name}}",
    footerIconUrl: "{{site.logoUrl}}",
    url: eventKey.startsWith("post") ? "{{post.url}}" : "{{project.url}}",
    color:
      eventKey === "post_create"
        ? "#3b82f6"
        : eventKey === "project_release"
          ? "#10b981"
          : "#f59e0b",
    authorName: eventKey.startsWith("post") ? "{{author.name}}" : "{{event.label}}",
    authorIconUrl: eventKey.startsWith("post") ? "{{author.avatarUrl}}" : "{{site.logoUrl}}",
    authorUrl: "{{site.url}}",
    thumbnailUrl: eventKey.startsWith("post") ? "{{post.imageUrl}}" : "{{project.imageUrl}}",
    imageUrl: eventKey.startsWith("post") ? "{{project.backdropImageUrl}}" : "{{chapter.imageUrl}}",
    fields: eventKey.startsWith("post")
      ? [
          { name: "Status", value: "{{post.status}}", inline: true },
          { name: "Projeto", value: "{{project.title}}", inline: true },
        ]
      : [
          { name: "{{update.unit}}", value: "{{chapter.number}}", inline: true },
          { name: "Título", value: "{{chapter.title}}", inline: true },
        ],
  },
});

const makeDefaultSettings = (
  projectTypes: string[] = DEFAULT_PROJECT_TYPES,
): EditorialSettings => ({
  version: 1,
  mentionMode: "role_id",
  mentionFallback: "skip",
  generalReleaseRoleId: "",
  typeRoles: projectTypes.map((type, order) => ({ type, roleId: "", enabled: true, order })),
  channels: {
    posts: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: 5000,
      retries: 1,
      events: { post_create: true, post_update: true },
      templates: {
        post_create: defaultTemplate("post_create"),
        post_update: defaultTemplate("post_update"),
      },
    },
    projects: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: 5000,
      retries: 1,
      events: { project_release: true, project_adjust: true },
      templates: {
        project_release: defaultTemplate("project_release"),
        project_adjust: defaultTemplate("project_adjust"),
      },
    },
  },
});

const asSettings = (value: unknown, projectTypes: string[]): EditorialSettings => {
  const fallback = makeDefaultSettings(projectTypes);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const parsed = value as Partial<EditorialSettings>;
  return {
    ...fallback,
    ...parsed,
    generalReleaseRoleId: String(parsed.generalReleaseRoleId || "").replace(/\D/g, ""),
    typeRoles: projectTypes.map((type, order) => {
      const existing = (Array.isArray(parsed.typeRoles) ? parsed.typeRoles : []).find(
        (item) =>
          String(item?.type || "")
            .trim()
            .toLowerCase() === type.toLowerCase(),
      );
      return {
        type,
        roleId: String(existing?.roleId || "").replace(/\D/g, ""),
        enabled: existing?.enabled !== false,
        order,
      };
    }),
  };
};

const isValidWebhookUrl = (value: string) => {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }
  if (!WEBHOOK_URL_PATTERN.test(text)) {
    return false;
  }
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const cloneSettings = (value: EditorialSettings): EditorialSettings =>
  JSON.parse(JSON.stringify(value)) as EditorialSettings;

const WEBHOOKS_CACHE_TTL_MS = 60_000;

type EditorialSettingsCacheEntry = {
  projectTypes: string[];
  settings: EditorialSettings;
  savedSettings: EditorialSettings;
  expiresAt: number;
};

let editorialSettingsCache: EditorialSettingsCacheEntry | null = null;

const readEditorialSettingsCache = () => {
  if (!editorialSettingsCache) {
    return null;
  }
  if (editorialSettingsCache.expiresAt <= Date.now()) {
    editorialSettingsCache = null;
    return null;
  }
  return {
    projectTypes: [...editorialSettingsCache.projectTypes],
    settings: cloneSettings(editorialSettingsCache.settings),
    savedSettings: cloneSettings(editorialSettingsCache.savedSettings),
  };
};

const writeEditorialSettingsCache = (value: {
  projectTypes: string[];
  settings: EditorialSettings;
  savedSettings: EditorialSettings;
}) => {
  editorialSettingsCache = {
    projectTypes: [...value.projectTypes],
    settings: cloneSettings(value.settings),
    savedSettings: cloneSettings(value.savedSettings),
    expiresAt: Date.now() + WEBHOOKS_CACHE_TTL_MS,
  };
};

const settingsMatch = (left: EditorialSettings, right: EditorialSettings) =>
  JSON.stringify(left) === JSON.stringify(right);

export const __testing = {
  clearEditorialSettingsCache: () => {
    editorialSettingsCache = null;
  },
};

const normalizeHexColor = (value: string, fallback: string) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(prefixed)) {
    return prefixed.toLowerCase();
  }
  return fallback;
};

const WebhookPlaceholderField = ({ label, wide = false }: { label: string; wide?: boolean }) => (
  <div className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}>
    <Label>{label}</Label>
    <Skeleton className="h-10 w-full" />
  </div>
);

const WebhookTypesPlaceholder = () => (
  <div className="space-y-4 min-h-[19rem]" data-testid="dashboard-webhooks-placeholder-types">
    <div className="space-y-2.5" data-testid="dashboard-webhooks-general-role-placeholder-field">
      <Label className="leading-tight">Role geral de lancamentos (ID)</Label>
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`dashboard-webhooks-placeholder-type-${index}`}
          className={`grid gap-3 ${dashboardPageLayoutTokens.surfaceInset} rounded-xl p-3 md:grid-cols-[1fr_280px]`}
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  </div>
);

const WebhookChannelPlaceholder = ({
  channelKey,
  testId,
}: {
  channelKey: ChannelKey;
  testId: string;
}) => (
  <div className="space-y-4 min-h-[39rem]" data-testid={testId}>
    <div className="grid gap-3 md:grid-cols-3">
      <WebhookPlaceholderField label="Webhook URL" wide />
      <WebhookPlaceholderField label="Timeout (ms)" />
      <WebhookPlaceholderField label="Tentativas" />
    </div>
    <div
      className={`flex w-fit items-center gap-2 ${dashboardPageLayoutTokens.cardActionSurface} px-3 py-2`}
    >
      <Skeleton className="h-5 w-10 rounded-full" />
      <span className="text-xs text-muted-foreground">Canal ativo</span>
    </div>
    <div className="space-y-3">
      {CHANNEL_EVENTS[channelKey].map((eventKey) => (
        <section
          key={`dashboard-webhooks-placeholder-${channelKey}-${eventKey}`}
          className={`${dashboardPageLayoutTokens.surfaceInset} rounded-xl px-3 py-4`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{EVENT_LABELS[eventKey]}</span>
            <Badge variant="outline">{eventKey}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Evento ativo</span>
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-9 w-28" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-2 md:grid-cols-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
        </section>
      ))}
    </div>
  </div>
);

const DashboardWebhooks = () => {
  usePageMeta({ title: "Webhooks", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const initialCacheRef = useRef(readEditorialSettingsCache());
  const { currentUser, isLoadingUser } = useDashboardCurrentUser<DashboardCurrentUser>({
    revalidateBootstrap: false,
  });
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [loadError, setLoadError] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [projectTypes, setProjectTypes] = useState<string[]>(
    initialCacheRef.current?.projectTypes ?? DEFAULT_PROJECT_TYPES,
  );
  const [settings, setSettings] = useState<EditorialSettings>(
    initialCacheRef.current?.settings ?? makeDefaultSettings(DEFAULT_PROJECT_TYPES),
  );
  const [savedSettings, setSavedSettings] = useState<EditorialSettings>(
    initialCacheRef.current?.savedSettings ?? makeDefaultSettings(DEFAULT_PROJECT_TYPES),
  );
  const [openSections, setOpenSections] = useState<string[]>(["types", "posts", "projects"]);
  const [savingBySection, setSavingBySection] = useState<Record<SaveSectionKey, boolean>>({
    types: false,
    posts: false,
    projects: false,
  });
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [testingByEvent, setTestingByEvent] = useState<Record<EventKey, boolean>>({
    post_create: false,
    post_update: false,
    project_release: false,
    project_adjust: false,
  });
  const loadRequestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const settingsRef = useRef(settings);
  const savedSettingsRef = useRef(savedSettings);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    savedSettingsRef.current = savedSettings;
  }, [savedSettings]);

  const canManageIntegrations = useMemo(() => {
    const grants =
      currentUser?.grants && typeof currentUser.grants === "object" ? currentUser.grants : {};
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    const hasPermission = (permission: "integracoes" | "configuracoes" | "projetos") =>
      grants[permission] === true || permissions.includes(permission) || permissions.includes("*");

    return (
      hasPermission("integracoes") || hasPermission("configuracoes") || hasPermission("projetos")
    );
  }, [currentUser]);

  const isSectionOpen = useCallback(
    (sectionKey: SaveSectionKey | ChannelKey) => openSections.includes(sectionKey),
    [openSections],
  );

  const loadSettings = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background ?? hasLoadedOnceRef.current;
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
      setLoadError("");
      try {
        const response = await apiFetch(apiBase, "/api/integrations/webhooks/editorial", {
          auth: true,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("load_failed");
        }
        const payload = await response.json();
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        const remoteTypes = Array.isArray(payload?.projectTypes)
          ? payload.projectTypes.map((item: unknown) => String(item || "").trim()).filter(Boolean)
          : DEFAULT_PROJECT_TYPES;
        const nextSettings = asSettings(payload?.settings, remoteTypes);
        const currentSettings = settingsRef.current;
        const currentSavedSettings = savedSettingsRef.current;
        const shouldPreserveDrafts =
          background && settingsMatch(currentSettings, currentSavedSettings) === false;
        const nextDraftSettings = shouldPreserveDrafts ? currentSettings : nextSettings;
        setProjectTypes(remoteTypes);
        setSavedSettings(nextSettings);
        setSettings(nextDraftSettings);
        writeEditorialSettingsCache({
          projectTypes: remoteTypes,
          settings: nextDraftSettings,
          savedSettings: nextSettings,
        });
        setHasLoadedOnce(true);
      } catch {
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        setLoadError("Nao foi possivel atualizar os webhooks editoriais.");
      } finally {
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    void loadSettings({ background: Boolean(initialCacheRef.current) });
  }, [loadSettings]);

  const patchChannel = useCallback(
    (
      channelKey: ChannelKey,
      updater: (
        value: EditorialSettings["channels"][ChannelKey],
      ) => EditorialSettings["channels"][ChannelKey],
    ) => {
      setSettings((previous) => ({
        ...previous,
        channels: {
          ...previous.channels,
          [channelKey]: updater(previous.channels[channelKey]),
        },
      }));
    },
    [],
  );

  const setTemplate = useCallback(
    (channelKey: ChannelKey, eventKey: EventKey, updater: (value: Template) => Template) => {
      patchChannel(
        channelKey,
        (channel) =>
          ({
            ...channel,
            templates: {
              ...channel.templates,
              [eventKey]: updater((channel.templates as Record<string, Template>)[eventKey]),
            },
          }) as EditorialSettings["channels"][ChannelKey],
      );
    },
    [patchChannel],
  );

  const setEmbedValue = useCallback(
    (
      channelKey: ChannelKey,
      eventKey: EventKey,
      key: keyof Omit<TemplateEmbed, "fields">,
      value: string,
    ) => {
      setTemplate(channelKey, eventKey, (template) => ({
        ...template,
        embed: {
          ...template.embed,
          [key]: value,
        },
      }));
    },
    [setTemplate],
  );

  const validateSection = useCallback((sectionKey: SaveSectionKey, value: EditorialSettings) => {
    const errors: string[] = [];
    if (sectionKey === "types") {
      if (value.generalReleaseRoleId && !ROLE_ID_PATTERN.test(value.generalReleaseRoleId)) {
        errors.push("Role geral inválida.");
      }
      value.typeRoles.forEach((item) => {
        if (item.roleId && !ROLE_ID_PATTERN.test(item.roleId)) {
          errors.push(`ID de cargo inválido em ${item.type}.`);
        }
      });
      return errors;
    }

    const channelKey = sectionKey as ChannelKey;
    const channel = value.channels[channelKey];
    const channelLabel = CHANNEL_LABELS[channelKey];
    if (channel.enabled && !String(channel.webhookUrl || "").trim()) {
      errors.push(`Webhook URL obrigatória em ${channelLabel}.`);
    }
    if (!isValidWebhookUrl(channel.webhookUrl || "")) {
      errors.push(`Webhook URL inválida em ${channelLabel}.`);
    }
    return errors;
  }, []);

  const buildSettingsPayloadForSection = useCallback(
    (
      sectionKey: SaveSectionKey,
      draftSettings: EditorialSettings,
      savedBase: EditorialSettings,
    ) => {
      const next = cloneSettings(savedBase);
      if (sectionKey === "types") {
        next.generalReleaseRoleId = draftSettings.generalReleaseRoleId;
        next.typeRoles = cloneSettings(draftSettings).typeRoles;
        return next;
      }
      if (sectionKey === "posts") {
        next.channels.posts = cloneSettings(draftSettings).channels.posts;
        return next;
      }
      next.channels.projects = cloneSettings(draftSettings).channels.projects;
      return next;
    },
    [],
  );

  const mergeServerWithUnsavedDrafts = useCallback(
    (
      sectionKey: SaveSectionKey,
      serverSettings: EditorialSettings,
      draftBeforeSave: EditorialSettings,
    ) => {
      const next = cloneSettings(serverSettings);
      if (sectionKey !== "types") {
        next.generalReleaseRoleId = draftBeforeSave.generalReleaseRoleId;
        next.typeRoles = cloneSettings(draftBeforeSave).typeRoles;
      }
      if (sectionKey !== "posts") {
        next.channels.posts = cloneSettings(draftBeforeSave).channels.posts;
      }
      if (sectionKey !== "projects") {
        next.channels.projects = cloneSettings(draftBeforeSave).channels.projects;
      }
      return next;
    },
    [],
  );

  const handleSaveSection = useCallback(
    async (sectionKey: SaveSectionKey) => {
      const errors = validateSection(sectionKey, settings);
      if (errors.length > 0) {
        toast({
          title: "Configuração inválida",
          description: errors[0],
          variant: "destructive",
        });
        return;
      }

      const draftBeforeSave = cloneSettings(settings);
      const payloadSettings = buildSettingsPayloadForSection(
        sectionKey,
        draftBeforeSave,
        savedSettings,
      );

      setSavingBySection((previous) => ({ ...previous, [sectionKey]: true }));
      try {
        const response = await apiFetch(apiBase, "/api/integrations/webhooks/editorial", {
          method: "PUT",
          auth: true,
          json: { settings: payloadSettings },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (payload?.error === "invalid_placeholders" && Array.isArray(payload?.placeholders)) {
            const first = payload.placeholders[0];
            toast({
              title: "Placeholder inválido",
              description: first
                ? `${first.placeholder} em ${first.eventKey} (${first.templatePath})`
                : "Revise os placeholders configurados.",
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Falha ao salvar",
            description: payload?.error || "Não foi possível atualizar os webhooks.",
            variant: "destructive",
          });
          return;
        }

        const remoteTypes = Array.isArray(payload?.projectTypes)
          ? payload.projectTypes.map((item: unknown) => String(item || "").trim()).filter(Boolean)
          : projectTypes;
        const serverSettings = asSettings(payload?.settings, remoteTypes);
        const nextDraft = mergeServerWithUnsavedDrafts(sectionKey, serverSettings, draftBeforeSave);

        setProjectTypes(remoteTypes);
        setSavedSettings(serverSettings);
        setSettings(nextDraft);
        writeEditorialSettingsCache({
          projectTypes: remoteTypes,
          settings: nextDraft,
          savedSettings: serverSettings,
        });
        toast({
          title: "Seção salva",
          description:
            sectionKey === "types"
              ? "Tipos e menções atualizados com sucesso."
              : sectionKey === "posts"
                ? "Configurações de posts atualizadas com sucesso."
                : "Configurações de projetos atualizadas com sucesso.",
          intent: "success",
        });
      } finally {
        setSavingBySection((previous) => ({ ...previous, [sectionKey]: false }));
      }
    },
    [
      apiBase,
      buildSettingsPayloadForSection,
      mergeServerWithUnsavedDrafts,
      projectTypes,
      savedSettings,
      settings,
      validateSection,
    ],
  );

  const handleSaveAll = useCallback(async () => {
    const errors = [
      ...validateSection("types", settings),
      ...validateSection("posts", settings),
      ...validateSection("projects", settings),
    ];
    if (errors.length > 0) {
      toast({
        title: "Configuração inválida",
        description: errors[0],
        variant: "destructive",
      });
      return;
    }

    setIsSavingAll(true);
    try {
      const response = await apiFetch(apiBase, "/api/integrations/webhooks/editorial", {
        method: "PUT",
        auth: true,
        json: { settings },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.error === "invalid_placeholders" && Array.isArray(payload?.placeholders)) {
          const first = payload.placeholders[0];
          toast({
            title: "Placeholder inválido",
            description: first
              ? `${first.placeholder} em ${first.eventKey} (${first.templatePath})`
              : "Revise os placeholders configurados.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Falha ao salvar",
          description: payload?.error || "Não foi possível atualizar os webhooks.",
          variant: "destructive",
        });
        return;
      }

      const remoteTypes = Array.isArray(payload?.projectTypes)
        ? payload.projectTypes.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : projectTypes;
      const serverSettings = asSettings(payload?.settings, remoteTypes);
      setProjectTypes(remoteTypes);
      setSavedSettings(serverSettings);
      setSettings(serverSettings);
      writeEditorialSettingsCache({
        projectTypes: remoteTypes,
        settings: serverSettings,
        savedSettings: serverSettings,
      });
      toast({
        title: "Configurações salvas",
        description: "Webhooks editoriais atualizados com sucesso.",
        intent: "success",
      });
    } finally {
      setIsSavingAll(false);
    }
  }, [apiBase, projectTypes, settings, validateSection]);

  const handleTest = useCallback(
    async (eventKey: EventKey) => {
      setTestingByEvent((previous) => ({ ...previous, [eventKey]: true }));
      try {
        const response = await apiFetch(apiBase, "/api/integrations/webhooks/editorial/test", {
          method: "POST",
          auth: true,
          json: { eventKey },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          toast({
            title: "Teste falhou",
            description:
              payload?.errorDetail || payload?.error || payload?.code || "Falha ao enviar teste.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Teste enviado",
          description: `${EVENT_LABELS[eventKey]} enviado com sucesso.`,
          intent: "success",
        });
      } finally {
        setTestingByEvent((previous) => ({ ...previous, [eventKey]: false }));
      }
    },
    [apiBase],
  );

  const hasBlockingLoadError = !hasLoadedOnce && Boolean(loadError);
  const showStableShell = isInitialLoading && !hasLoadedOnce;

  useDashboardRefreshToast({
    active: isRefreshing && hasLoadedOnce,
    title: "Atualizando webhooks editoriais",
    description: "Buscando a configuracao mais recente dos webhooks editoriais.",
  });

  if (!isLoadingUser && !canManageIntegrations) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer reveal={false}>
          <AsyncState
            kind="error"
            title="Acesso negado"
            description="Sua conta não tem permissão para gerenciar integrações."
            action={<Button onClick={() => navigate("/dashboard")}>Voltar</Button>}
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer maxWidth="7xl" reveal={false}>
        <DashboardPageHeader
          badge="Integrações"
          title="Webhooks editoriais"
          description="Configure canais para posts e projetos com templates por evento."
          actions={
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleSaveAll()}
              disabled={isSavingAll || showStableShell || hasBlockingLoadError}
            >
              <Save className="h-4 w-4" />
              {isSavingAll ? "Salvando..." : "Salvar"}
            </Button>
          }
        />
        {loadError && !hasBlockingLoadError ? (
          <Alert className="mb-4 border-border/70 bg-background text-foreground/70">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>Mantendo os ultimos dados carregados.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadSettings({ background: true })}
              >
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {hasBlockingLoadError ? (
          <AsyncState
            kind="error"
            title="Falha ao carregar"
            description="Não foi possível buscar os webhooks editoriais."
            action={
              <Button onClick={() => void loadSettings({ background: false })}>
                Tentar novamente
              </Button>
            }
          />
        ) : (
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={(value) => setOpenSections(Array.isArray(value) ? value : [])}
            className="space-y-4"
          >
            <AccordionItem
              value="types"
              className={`${dashboardPageLayoutTokens.surfaceSolid} rounded-xl px-4 animate-slide-up opacity-0`}
              style={dashboardAnimationDelay(SECTION_REVEAL_DELAYS.types)}
              data-testid="dashboard-webhooks-section-types"
            >
              <div className="relative">
                <AccordionTrigger className="hover:no-underline">Tipos e menções</AccordionTrigger>
                {isSectionOpen("types") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="absolute right-10 top-1/2 -translate-y-1/2 gap-2"
                    aria-label="Salvar tipos e menções"
                    onClick={() => void handleSaveSection("types")}
                    disabled={savingBySection.types || showStableShell}
                  >
                    <Save className="h-4 w-4" />
                    {savingBySection.types ? "Salvando..." : "Salvar"}
                  </Button>
                ) : null}
              </div>
              <AccordionContent className="space-y-4">
                {showStableShell ? (
                  <WebhookTypesPlaceholder />
                ) : (
                  <div className="space-y-4" data-testid="dashboard-webhooks-section-content-types">
                    <div
                      className="space-y-2.5"
                      data-testid="dashboard-webhooks-general-role-field"
                    >
                      <Label className="leading-tight">Role geral de lançamentos (ID)</Label>
                      <Input
                        value={settings.generalReleaseRoleId}
                        onChange={(event) =>
                          setSettings((previous) => ({
                            ...previous,
                            generalReleaseRoleId: event.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="Opcional: usada em project_release"
                      />
                    </div>

                    <div className="space-y-3">
                      {settings.typeRoles.map((typeRole, index) => (
                        <div
                          key={`${typeRole.type}-${index}`}
                          className={`grid gap-3 ${dashboardPageLayoutTokens.surfaceInset} rounded-xl p-3 md:grid-cols-[1fr_280px]`}
                        >
                          <div>
                            <p className="text-sm font-medium">{typeRole.type}</p>
                            <p className="text-xs text-muted-foreground">
                              ID do cargo do Discord para este tipo.
                            </p>
                          </div>
                          <Input
                            value={typeRole.roleId}
                            onChange={(event) =>
                              setSettings((previous) => ({
                                ...previous,
                                typeRoles: previous.typeRoles.map((item, itemIndex) =>
                                  itemIndex !== index
                                    ? item
                                    : {
                                        ...item,
                                        roleId: event.target.value.replace(/\D/g, ""),
                                      },
                                ),
                              }))
                            }
                            placeholder="ID do cargo do Discord"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {(Object.keys(CHANNEL_EVENTS) as ChannelKey[]).map((channelKey) => {
              const channel = settings.channels[channelKey];
              const sectionKey = channelKey as Extract<SaveSectionKey, ChannelKey>;
              return (
                <AccordionItem
                  key={channelKey}
                  value={channelKey}
                  className={`${dashboardPageLayoutTokens.surfaceSolid} rounded-xl px-4 animate-slide-up opacity-0`}
                  style={dashboardAnimationDelay(SECTION_REVEAL_DELAYS[sectionKey])}
                  data-testid={`dashboard-webhooks-section-${sectionKey}`}
                >
                  <div className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      {CHANNEL_LABELS[channelKey]}
                    </AccordionTrigger>
                    {isSectionOpen(sectionKey) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-10 top-1/2 -translate-y-1/2 gap-2"
                        aria-label={sectionKey === "posts" ? "Salvar posts" : "Salvar projetos"}
                        onClick={() => void handleSaveSection(sectionKey)}
                        disabled={savingBySection[sectionKey] || showStableShell}
                      >
                        <Save className="h-4 w-4" />
                        {savingBySection[sectionKey] ? "Salvando..." : "Salvar"}
                      </Button>
                    ) : null}
                  </div>
                  <AccordionContent className="space-y-4">
                    {showStableShell ? (
                      <WebhookChannelPlaceholder
                        channelKey={channelKey}
                        testId={`dashboard-webhooks-placeholder-${sectionKey}`}
                      />
                    ) : (
                      <div
                        className="space-y-4"
                        data-testid={`dashboard-webhooks-section-content-${sectionKey}`}
                      >
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Webhook URL</Label>
                            <Input
                              value={channel.webhookUrl}
                              onChange={(event) =>
                                patchChannel(channelKey, (item) => ({
                                  ...item,
                                  webhookUrl: event.target.value,
                                }))
                              }
                              placeholder="https://discord.com/api/webhooks/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Timeout (ms)</Label>
                            <Input
                              type="number"
                              min={1000}
                              max={30000}
                              value={channel.timeoutMs}
                              onChange={(event) =>
                                patchChannel(channelKey, (item) => ({
                                  ...item,
                                  timeoutMs: Number(event.target.value || 5000),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tentativas</Label>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              value={channel.retries}
                              onChange={(event) =>
                                patchChannel(channelKey, (item) => ({
                                  ...item,
                                  retries: Number(event.target.value || 0),
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div
                          className={`flex w-fit items-center gap-2 ${dashboardPageLayoutTokens.cardActionSurface} px-3 py-2`}
                        >
                          <Switch
                            checked={channel.enabled}
                            onCheckedChange={(checked) =>
                              patchChannel(channelKey, (item) => ({
                                ...item,
                                enabled: checked,
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">Canal ativo</span>
                        </div>

                        <Accordion type="multiple" className="space-y-3">
                          {CHANNEL_EVENTS[channelKey].map((eventKey) => {
                            const template = channel.templates[eventKey];
                            const displayEmbedColor = normalizeHexColor(
                              template.embed.color,
                              DEFAULT_EVENT_COLORS[eventKey],
                            );
                            return (
                              <AccordionItem
                                key={eventKey}
                                value={`${channelKey}-${eventKey}`}
                                className={`${dashboardPageLayoutTokens.surfaceInset} rounded-xl px-3`}
                                data-testid={`dashboard-webhooks-event-${channelKey}-${eventKey}`}
                              >
                                <AccordionTrigger className="hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">
                                      {EVENT_LABELS[eventKey]}
                                    </span>
                                    <Badge variant="outline">{eventKey}</Badge>
                                  </div>
                                </AccordionTrigger>

                                <AccordionContent className="space-y-4">
                                  <div
                                    className="space-y-4"
                                    data-testid={`dashboard-webhooks-event-content-${channelKey}-${eventKey}`}
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        Evento ativo
                                      </span>
                                      <Switch
                                        checked={Boolean(channel.events[eventKey])}
                                        onCheckedChange={(checked) =>
                                          patchChannel(
                                            channelKey,
                                            (item) =>
                                              ({
                                                ...item,
                                                events: {
                                                  ...item.events,
                                                  [eventKey]: checked,
                                                },
                                              }) as EditorialSettings["channels"][ChannelKey],
                                          )
                                        }
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={testingByEvent[eventKey]}
                                        onClick={() => void handleTest(eventKey)}
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                        {testingByEvent[eventKey] ? "Enviando..." : "Enviar teste"}
                                      </Button>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Conteúdo da mensagem</Label>
                                      <Textarea
                                        value={template.content}
                                        onChange={(event) =>
                                          setTemplate(channelKey, eventKey, (item) => ({
                                            ...item,
                                            content: event.target.value,
                                          }))
                                        }
                                        placeholder="{{mention.all}}"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                                        Autor e miniatura
                                      </h4>
                                      <div className="grid gap-2 md:grid-cols-3">
                                        <div className="space-y-2">
                                          <Label>URL do ícone do autor</Label>
                                          <Input
                                            value={template.embed.authorIconUrl}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "authorIconUrl",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Nome do autor</Label>
                                          <Input
                                            value={template.embed.authorName}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "authorName",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>URL da miniatura</Label>
                                          <Input
                                            value={template.embed.thumbnailUrl}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "thumbnailUrl",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                          <Label>URL do autor</Label>
                                          <Input
                                            value={template.embed.authorUrl}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "authorUrl",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                                        Título e URL da embed
                                      </h4>
                                      <div className="grid gap-2 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <Label>Título</Label>
                                          <Input
                                            value={template.embed.title}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "title",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>URL da embed</Label>
                                          <Input
                                            value={template.embed.url}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "url",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Descrição</Label>
                                      <Textarea
                                        value={template.embed.description}
                                        onChange={(event) =>
                                          setEmbedValue(
                                            channelKey,
                                            eventKey,
                                            "description",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label>Campos da embed</Label>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="gap-2"
                                          onClick={() =>
                                            setTemplate(channelKey, eventKey, (item) => ({
                                              ...item,
                                              embed: {
                                                ...item.embed,
                                                fields: [
                                                  ...item.embed.fields,
                                                  { name: "", value: "", inline: false },
                                                ],
                                              },
                                            }))
                                          }
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                          Adicionar campo
                                        </Button>
                                      </div>

                                      {template.embed.fields.map((field, index) => (
                                        <div
                                          key={`${eventKey}-field-${index}`}
                                          className="grid gap-2 rounded-lg border border-border/50 p-2 md:grid-cols-[1fr_1fr_auto_auto]"
                                        >
                                          <Input
                                            value={field.name}
                                            onChange={(event) =>
                                              setTemplate(channelKey, eventKey, (item) => {
                                                const fields = [...item.embed.fields];
                                                fields[index] = {
                                                  ...fields[index],
                                                  name: event.target.value,
                                                };
                                                return {
                                                  ...item,
                                                  embed: { ...item.embed, fields },
                                                };
                                              })
                                            }
                                            placeholder="Nome"
                                          />
                                          <Input
                                            value={field.value}
                                            onChange={(event) =>
                                              setTemplate(channelKey, eventKey, (item) => {
                                                const fields = [...item.embed.fields];
                                                fields[index] = {
                                                  ...fields[index],
                                                  value: event.target.value,
                                                };
                                                return {
                                                  ...item,
                                                  embed: { ...item.embed, fields },
                                                };
                                              })
                                            }
                                            placeholder="Valor"
                                          />
                                          <div className="flex items-center gap-2 rounded-md border border-border/50 px-2">
                                            <Switch
                                              checked={field.inline}
                                              onCheckedChange={(checked) =>
                                                setTemplate(channelKey, eventKey, (item) => {
                                                  const fields = [...item.embed.fields];
                                                  fields[index] = {
                                                    ...fields[index],
                                                    inline: checked,
                                                  };
                                                  return {
                                                    ...item,
                                                    embed: { ...item.embed, fields },
                                                  };
                                                })
                                              }
                                            />
                                            <span className="text-xs text-muted-foreground">
                                              Em linha
                                            </span>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              setTemplate(channelKey, eventKey, (item) => ({
                                                ...item,
                                                embed: {
                                                  ...item.embed,
                                                  fields: item.embed.fields.filter(
                                                    (_, itemIndex) => itemIndex !== index,
                                                  ),
                                                },
                                              }))
                                            }
                                            aria-label={`Remover campo ${index + 1}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="space-y-2">
                                      <Label>URL da imagem</Label>
                                      <Input
                                        value={template.embed.imageUrl}
                                        onChange={(event) =>
                                          setEmbedValue(
                                            channelKey,
                                            eventKey,
                                            "imageUrl",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                                        Rodapé
                                      </h4>
                                      <div className="grid gap-2 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <Label>URL do ícone do rodapé</Label>
                                          <Input
                                            value={template.embed.footerIconUrl}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "footerIconUrl",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Texto do rodapé</Label>
                                          <Input
                                            value={template.embed.footerText}
                                            onChange={(event) =>
                                              setEmbedValue(
                                                channelKey,
                                                eventKey,
                                                "footerText",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2 md:max-w-xs">
                                      <Label>Cor da embed (#RRGGBB)</Label>
                                      <div className="flex items-center gap-3">
                                        <ColorPicker
                                          aria-label="Selecionar cor da embed"
                                          label=""
                                          showSwatch
                                          buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background shadow-xs transition hover:border-primary/40"
                                          value={displayEmbedColor}
                                          onChange={(color) =>
                                            setEmbedValue(
                                              channelKey,
                                              eventKey,
                                              "color",
                                              color.toString("hex"),
                                            )
                                          }
                                        />
                                        <p
                                          className="text-xs font-medium text-muted-foreground"
                                          aria-label="Valor hexadecimal da cor da embed"
                                        >
                                          {displayEmbedColor.toUpperCase()}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                                        Placeholders disponíveis
                                      </h4>
                                      <div className="flex flex-wrap gap-2">
                                        {PLACEHOLDERS[eventKey].map((placeholder) => (
                                          <Badge
                                            key={`${eventKey}-${placeholder}`}
                                            variant="secondary"
                                          >
                                            {`{{${placeholder}}}`}
                                          </Badge>
                                        ))}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Aliases legados de menção são convertidos automaticamente ao
                                        salvar.
                                      </p>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardWebhooks;
