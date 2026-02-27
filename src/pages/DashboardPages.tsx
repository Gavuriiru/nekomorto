import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";
import DashboardShell from "@/components/DashboardShell";
import AsyncState from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  GripVertical,
  Plus,
  Trash2,
  Heart,
  Sparkles,
  Users,
  Wand2,
  Flame,
  Zap,
  Server,
  PiggyBank,
  HelpCircle,
  Info,
  Rocket,
  HeartHandshake,
  QrCode,
  Languages,
  ScanText,
  PenTool,
  Video,
  Paintbrush,
  Layers,
  Timer,
  ShieldCheck,
} from "lucide-react";
import {
  autosaveRuntimeConfig,
  autosaveStorageKeys,
  readAutosavePreference,
  writeAutosavePreference,
} from "@/config/autosave";
import { useAutosave } from "@/hooks/use-autosave";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";
import { toast } from "@/components/ui/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

type AboutHighlight = { label: string; text: string; icon: string };
type AboutValue = { title: string; description: string; icon: string };
type AboutPillar = { title: string; description: string; icon: string };
type DonationsCost = { title: string; description: string; icon: string };
type Donor = { name: string; amount: string; goal: string; date: string };
type FAQItem = { question: string; answer: string };
type FAQGroup = { title: string; icon: string; items: FAQItem[] };
type FAQIntro = { title: string; icon: string; text: string; note: string };
type RecruitmentRole = { title: string; description: string; icon: string };
type PageWithShareImage = { shareImage: string };
type PublicPageKey = "about" | "donations" | "faq" | "team" | "recruitment";

type PagesConfig = {
  home: PageWithShareImage;
  projects: PageWithShareImage;
  about: PageWithShareImage & {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    heroBadges: string[];
    highlights: AboutHighlight[];
    manifestoTitle: string;
    manifestoIcon: string;
    manifestoParagraphs: string[];
    pillars: AboutPillar[];
    values: AboutValue[];
  };
  donations: PageWithShareImage & {
    heroTitle: string;
    heroSubtitle: string;
    costs: DonationsCost[];
    reasonTitle: string;
    reasonIcon: string;
    reasonText: string;
    reasonNote: string;
    pixKey: string;
    pixNote: string;
    qrCustomUrl: string;
    pixIcon: string;
    donorsIcon: string;
    donors: Donor[];
  };
  faq: PageWithShareImage & {
    heroTitle: string;
    heroSubtitle: string;
    introCards: FAQIntro[];
    groups: FAQGroup[];
  };
  team: PageWithShareImage & {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    retiredTitle: string;
    retiredSubtitle: string;
  };
  recruitment: PageWithShareImage & {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    roles: RecruitmentRole[];
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButtonLabel: string;
  };
};

const iconOptions = [
  "Heart",
  "Sparkles",
  "Users",
  "Wand2",
  "Flame",
  "Zap",
  "Server",
  "PiggyBank",
  "HeartHandshake",
  "QrCode",
  "HelpCircle",
  "Info",
  "Rocket",
  "Shield",
  "Languages",
  "ScanText",
  "PenTool",
  "Video",
  "Paintbrush",
  "Layers",
  "Timer",
  "ShieldCheck",
];

const editorIconMap: Record<string, typeof Heart> = {
  Heart,
  Sparkles,
  Users,
  Wand2,
  Flame,
  Zap,
  Server,
  PiggyBank,
  HeartHandshake,
  QrCode,
  HelpCircle,
  Info,
  Rocket,
  Shield,
  Languages,
  ScanText,
  PenTool,
  Video,
  Paintbrush,
  Layers,
  Timer,
  ShieldCheck,
};

const emptyPages: PagesConfig = {
  home: {
    shareImage: "",
  },
  projects: {
    shareImage: "",
  },
  about: {
    shareImage: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    heroBadges: [],
    highlights: [],
    manifestoTitle: "",
    manifestoIcon: "Flame",
    manifestoParagraphs: [],
    pillars: [],
    values: [],
  },
  donations: {
    shareImage: "",
    heroTitle: "",
    heroSubtitle: "",
    costs: [],
    reasonTitle: "",
    reasonIcon: "HeartHandshake",
    reasonText: "",
    reasonNote: "",
    pixKey: "",
    pixNote: "",
    qrCustomUrl: "",
    pixIcon: "QrCode",
    donorsIcon: "PiggyBank",
    donors: [],
  },
  faq: {
    shareImage: "",
    heroTitle: "",
    heroSubtitle: "",
    introCards: [],
    groups: [],
  },
  team: {
    shareImage: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    retiredTitle: "",
    retiredSubtitle: "",
  },
  recruitment: {
    shareImage: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    roles: [],
    ctaTitle: "",
    ctaSubtitle: "",
    ctaButtonLabel: "",
  },
};

const defaultPages: PagesConfig = emptyPages;

const mergePagesConfig = (value: Partial<PagesConfig> | null | undefined): PagesConfig => {
  const incoming = value || {};
  return {
    ...defaultPages,
    ...incoming,
    home: { ...defaultPages.home, ...(incoming.home || {}) },
    projects: { ...defaultPages.projects, ...(incoming.projects || {}) },
    about: { ...defaultPages.about, ...(incoming.about || {}) },
    donations: { ...defaultPages.donations, ...(incoming.donations || {}) },
    faq: { ...defaultPages.faq, ...(incoming.faq || {}) },
    team: { ...defaultPages.team, ...(incoming.team || {}) },
    recruitment: { ...defaultPages.recruitment, ...(incoming.recruitment || {}) },
  };
};

const pageLabels: Record<PublicPageKey, string> = {
  about: "Sobre",
  donations: "Doações",
  faq: "FAQ",
  team: "Equipe",
  recruitment: "Recrutamento",
};

const orderedPageTabs = (Object.entries(pageLabels) as Array<[PublicPageKey, string]>)
  .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, "pt-BR"))
  .map(([key, label]) => ({ key, label }));

const DASHBOARD_PAGES_DEFAULT_TAB: PublicPageKey = orderedPageTabs[0]?.key || "donations";
const DASHBOARD_PAGES_TAB_SET = new Set<PublicPageKey>(orderedPageTabs.map((tab) => tab.key));
const isDashboardPagesTab = (value: string): value is PublicPageKey =>
  DASHBOARD_PAGES_TAB_SET.has(value as PublicPageKey);
const parseDashboardPagesTabParam = (value: string | null): PublicPageKey => {
  const normalized = String(value || "").trim();
  if (isDashboardPagesTab(normalized)) {
    return normalized;
  }
  return DASHBOARD_PAGES_DEFAULT_TAB;
};

const reorder = <T,>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
};

const IconSelect = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) => {
  const CurrentIcon = editorIconMap[value] || Sparkles;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 bg-background/60">
        <SelectValue>
          <span className="inline-flex items-center gap-2 text-sm">
            <CurrentIcon className="h-4 w-4 text-primary" />
            {value}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {iconOptions.map((icon) => {
          const Icon = editorIconMap[icon] || Sparkles;
          return (
            <SelectItem key={icon} value={icon}>
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                {icon}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

const DashboardPages = () => {
  usePageMeta({ title: "Páginas", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAutosaveEnabledRef = useRef(
    autosaveRuntimeConfig.enabledByDefault &&
      readAutosavePreference(autosaveStorageKeys.pages, true),
  );
  const [pages, setPages] = useState<PagesConfig>(defaultPages);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<PublicPageKey>(() =>
    parseDashboardPagesTabParam(searchParams.get("tab")),
  );
  const [dragState, setDragState] = useState<{ list: string; index: number } | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const qrPreview = useMemo(() => {
    if (pages.donations.qrCustomUrl) {
      return pages.donations.qrCustomUrl;
    }
    if (!pages.donations.pixKey) {
      return "/placeholder.svg";
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      pages.donations.pixKey,
    )}`;
  }, [pages.donations.pixKey, pages.donations.qrCustomUrl]);

  useEffect(() => {
    const nextTab = parseDashboardPagesTabParam(searchParams.get("tab"));
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (activeTab === DASHBOARD_PAGES_DEFAULT_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeTab);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setHasLoadError(false);
        const response = await apiFetch(apiBase, "/api/pages", { auth: true });
        if (!response.ok) {
          setPages(defaultPages);
          setHasLoadError(true);
          return;
        }
        const data = await response.json();
        setPages(mergePagesConfig(data.pages));
      } catch {
        setPages(defaultPages);
        setHasLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [apiBase, loadVersion]);

  useEffect(() => {
    const loadUser = async () => {
      setIsLoadingUser(true);
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
    void loadUser();
  }, [apiBase]);

  const savePages = useCallback(
    async (nextPages: PagesConfig) => {
      const response = await apiFetch(apiBase, "/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ pages: nextPages }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const normalizedPages = mergePagesConfig((data?.pages as Partial<PagesConfig> | undefined) || nextPages);
      setPages(normalizedPages);
      return normalizedPages;
    },
    [apiBase],
  );

  const pagesAutosave = useAutosave<PagesConfig>({
    value: pages,
    onSave: savePages,
    isReady: !isLoading,
    enabled: initialAutosaveEnabledRef.current,
    debounceMs: autosaveRuntimeConfig.debounceMs,
    retryMax: autosaveRuntimeConfig.retryMax,
    retryBaseMs: autosaveRuntimeConfig.retryBaseMs,
    onError: (_error, payload) => {
      if (payload.source === "auto" && payload.consecutiveErrors === 1) {
        toast({
          title: "Falha no autosave",
          description: "Não foi possível salvar as páginas automaticamente.",
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    writeAutosavePreference(autosaveStorageKeys.pages, pagesAutosave.enabled);
  }, [pagesAutosave.enabled]);

  const hasPendingChanges =
    pagesAutosave.isDirty ||
    pagesAutosave.status === "pending" ||
    pagesAutosave.status === "saving";

  useEffect(() => {
    if (isLoading || !hasPendingChanges) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadCompatibility(event);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges, isLoading]);

  const handleSave = useCallback(async () => {
    const ok = await pagesAutosave.flushNow();
    if (!ok) {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as alterações agora.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Páginas salvas",
      description: "As alterações foram aplicadas com sucesso.",
      intent: "success",
    });
  }, [pagesAutosave]);

  const updateAbout = (patch: Partial<PagesConfig["about"]>) =>
    setPages((prev) => ({ ...prev, about: { ...prev.about, ...patch } }));
  const updateDonations = (patch: Partial<PagesConfig["donations"]>) =>
    setPages((prev) => ({ ...prev, donations: { ...prev.donations, ...patch } }));
  const updateFaq = (patch: Partial<PagesConfig["faq"]>) =>
    setPages((prev) => ({ ...prev, faq: { ...prev.faq, ...patch } }));
  const updateTeam = (patch: Partial<PagesConfig["team"]>) =>
    setPages((prev) => ({ ...prev, team: { ...prev.team, ...patch } }));
  const updateRecruitment = (patch: Partial<PagesConfig["recruitment"]>) =>
    setPages((prev) => ({ ...prev, recruitment: { ...prev.recruitment, ...patch } }));

  const handleDragStart = (list: string, index: number) => {
    setDragState({ list, index });
  };

  const handleDrop = (list: string, index: number) => {
    if (!dragState || dragState.list !== list) {
      return;
    }
    const from = dragState.index;
    const to = index;
    if (from === to) {
      setDragState(null);
      return;
    }
    if (list === "about.highlights") {
      updateAbout({ highlights: reorder(pages.about.highlights, from, to) });
    } else if (list === "about.values") {
      updateAbout({ values: reorder(pages.about.values, from, to) });
    } else if (list === "about.pillars") {
      updateAbout({ pillars: reorder(pages.about.pillars, from, to) });
    } else if (list === "donations.costs") {
      updateDonations({ costs: reorder(pages.donations.costs, from, to) });
    } else if (list === "donations.donors") {
      updateDonations({ donors: reorder(pages.donations.donors, from, to) });
    } else if (list === "faq.intro") {
      updateFaq({ introCards: reorder(pages.faq.introCards, from, to) });
    } else if (list === "faq.groups") {
      updateFaq({ groups: reorder(pages.faq.groups, from, to) });
    } else if (list === "recruitment.roles") {
      updateRecruitment({ roles: reorder(pages.recruitment.roles, from, to) });
    } else if (list.startsWith("faq.items.")) {
      const groupIndex = Number(list.split(".")[2]);
      if (!Number.isNaN(groupIndex)) {
        const groups = [...pages.faq.groups];
        groups[groupIndex] = {
          ...groups[groupIndex],
          items: reorder(groups[groupIndex].items, from, to),
        };
        updateFaq({ groups });
      }
    }
    setDragState(null);
  };

  if (isLoading) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-24">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <AsyncState
              kind="loading"
              title="Carregando páginas"
              description="Buscando a configuração atual das páginas públicas."
            />
          </section>
        </main>
      </DashboardShell>
    );
  }

  if (hasLoadError) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-24">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <AsyncState
              kind="error"
              title="Não foi possível carregar as páginas"
              description="Tente novamente em instantes."
              action={
                <Button variant="outline" onClick={() => setLoadVersion((previous) => previous + 1)}>
                  Tentar novamente
                </Button>
              }
            />
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
        <main
          className="pt-24"
          onBlurCapture={() => {
            if (pagesAutosave.enabled) {
              void pagesAutosave.flushNow();
            }
          }}
        >
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                  Páginas
                </div>
                <h1 className="mt-4 text-3xl font-semibold lg:text-4xl animate-slide-up">Gerenciar páginas</h1>
                <p
                  className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "0.2s" }}
                >
                  Edite textos, cards, badges e listas das páginas públicas.
                </p>
              </div>
              <DashboardAutosaveStatus
                title="Autosave das páginas"
                status={pagesAutosave.status}
                enabled={pagesAutosave.enabled}
                onEnabledChange={(nextEnabled) => {
                  if (!autosaveRuntimeConfig.enabledByDefault) {
                    return;
                  }
                  pagesAutosave.setEnabled(nextEnabled);
                }}
                toggleDisabled={!autosaveRuntimeConfig.enabledByDefault}
                lastSavedAt={pagesAutosave.lastSavedAt}
                errorMessage={
                  pagesAutosave.status === "error"
                    ? "As alterações continuam pendentes até um novo salvamento."
                    : null
                }
                onManualSave={() => {
                  void handleSave();
                }}
                manualActionLabel={
                  pagesAutosave.status === "saving" ? "Salvando..." : "Salvar alterações"
                }
                manualActionDisabled={pagesAutosave.status === "saving"}
              />
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (isDashboardPagesTab(value)) {
                  setActiveTab(value);
                }
              }}
              className="mt-8 animate-slide-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              <TabsList className="no-scrollbar flex w-full flex-nowrap justify-start overflow-x-auto overscroll-x-contain md:grid md:grid-cols-5 md:overflow-visible">
                {orderedPageTabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} className="shrink-0 md:w-full">
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="about" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Badge</Label>
                      <Input value={pages.about.heroBadge} onChange={(e) => updateAbout({ heroBadge: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Título</Label>
                      <Input value={pages.about.heroTitle} onChange={(e) => updateAbout({ heroTitle: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={pages.about.heroSubtitle}
                        onChange={(e) => updateAbout({ heroSubtitle: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Badges do topo</Label>
                      <div className="flex flex-wrap gap-2">
                        {pages.about.heroBadges.map((badge, index) => (
                          <div key={`${badge}-${index}`} className="flex items-center gap-2">
                            <Input
                              value={badge}
                              onChange={(e) => {
                                const next = [...pages.about.heroBadges];
                                next[index] = e.target.value;
                                updateAbout({ heroBadges: next });
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const next = pages.about.heroBadges.filter((_, i) => i !== index);
                                updateAbout({ heroBadges: next });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateAbout({ heroBadges: [...pages.about.heroBadges, "Nova badge"] })}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar badge
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Destaques
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAbout({
                            highlights: [
                              ...pages.about.highlights,
                              { label: "Novo destaque", text: "", icon: "Sparkles" },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {pages.about.highlights.map((item, index) => (
                        <div
                          key={`${item.label}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("about.highlights", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("about.highlights", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateAbout({
                                  highlights: pages.about.highlights.filter((_, i) => i !== index),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={item.label}
                              onChange={(e) => {
                                const next = [...pages.about.highlights];
                                next[index] = { ...item, label: e.target.value };
                                updateAbout({ highlights: next });
                              }}
                            />
                            <Textarea
                              value={item.text}
                              onChange={(e) => {
                                const next = [...pages.about.highlights];
                                next[index] = { ...item, text: e.target.value };
                                updateAbout({ highlights: next });
                              }}
                            />
                            <div className="grid gap-2">
                              <Label>Ícone</Label>
                              <IconSelect
                                value={item.icon || "Sparkles"}
                                onChange={(nextIcon) => {
                                  const next = [...pages.about.highlights];
                                  next[index] = { ...item, icon: nextIcon };
                                  updateAbout({ highlights: next });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="grid gap-2">
                      <Label>Título do manifesto</Label>
                      <Input
                        value={pages.about.manifestoTitle}
                        onChange={(e) => updateAbout({ manifestoTitle: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ícone do manifesto</Label>
                      <IconSelect
                        value={pages.about.manifestoIcon || "Flame"}
                        onChange={(nextIcon) => updateAbout({ manifestoIcon: nextIcon })}
                      />
                    </div>
                    <div className="grid gap-3">
                      {pages.about.manifestoParagraphs.map((paragraph, index) => (
                        <div key={`${paragraph}-${index}`} className="flex gap-2">
                          <Textarea
                            value={paragraph}
                            onChange={(e) => {
                              const next = [...pages.about.manifestoParagraphs];
                              next[index] = e.target.value;
                              updateAbout({ manifestoParagraphs: next });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const next = pages.about.manifestoParagraphs.filter((_, i) => i !== index);
                              updateAbout({ manifestoParagraphs: next });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAbout({ manifestoParagraphs: [...pages.about.manifestoParagraphs, ""] })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar parágrafo
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Pilares
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAbout({
                            pillars: [...pages.about.pillars, { title: "Novo pilar", description: "", icon: "Sparkles" }],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {pages.about.pillars.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("about.pillars", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("about.pillars", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateAbout({ pillars: pages.about.pillars.filter((_, i) => i !== index) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={item.title}
                              onChange={(e) => {
                                const next = [...pages.about.pillars];
                                next[index] = { ...item, title: e.target.value };
                                updateAbout({ pillars: next });
                              }}
                            />
                            <Textarea
                              value={item.description}
                              onChange={(e) => {
                                const next = [...pages.about.pillars];
                                next[index] = { ...item, description: e.target.value };
                                updateAbout({ pillars: next });
                              }}
                            />
                            <div className="grid gap-2">
                              <Label>Ícone</Label>
                              <IconSelect
                                value={item.icon}
                                onChange={(nextIcon) => {
                                  const next = [...pages.about.pillars];
                                  next[index] = { ...item, icon: nextIcon };
                                  updateAbout({ pillars: next });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Valores
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateAbout({
                            values: [...pages.about.values, { title: "Novo valor", description: "", icon: "Heart" }],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {pages.about.values.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("about.values", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("about.values", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateAbout({ values: pages.about.values.filter((_, i) => i !== index) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={item.title}
                              onChange={(e) => {
                                const next = [...pages.about.values];
                                next[index] = { ...item, title: e.target.value };
                                updateAbout({ values: next });
                              }}
                            />
                            <Textarea
                              value={item.description}
                              onChange={(e) => {
                                const next = [...pages.about.values];
                                next[index] = { ...item, description: e.target.value };
                                updateAbout({ values: next });
                              }}
                            />
                            <div className="grid gap-2">
                              <Label>Ícone</Label>
                              <IconSelect
                                value={item.icon}
                                onChange={(nextIcon) => {
                                  const next = [...pages.about.values];
                                  next[index] = { ...item, icon: nextIcon };
                                  updateAbout({ values: next });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="donations" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Título</Label>
                      <Input
                        value={pages.donations.heroTitle}
                        onChange={(e) => updateDonations({ heroTitle: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={pages.donations.heroSubtitle}
                        onChange={(e) => updateDonations({ heroSubtitle: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Custos
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateDonations({
                            costs: [...pages.donations.costs, { title: "Novo custo", description: "", icon: "Server" }],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {pages.donations.costs.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("donations.costs", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("donations.costs", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateDonations({ costs: pages.donations.costs.filter((_, i) => i !== index) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={item.title}
                              onChange={(e) => {
                                const next = [...pages.donations.costs];
                                next[index] = { ...item, title: e.target.value };
                                updateDonations({ costs: next });
                              }}
                            />
                            <Textarea
                              value={item.description}
                              onChange={(e) => {
                                const next = [...pages.donations.costs];
                                next[index] = { ...item, description: e.target.value };
                                updateDonations({ costs: next });
                              }}
                            />
                            <div className="grid gap-2">
                              <Label>Ícone</Label>
                              <IconSelect
                                value={item.icon}
                                onChange={(nextIcon) => {
                                  const next = [...pages.donations.costs];
                                  next[index] = { ...item, icon: nextIcon };
                                  updateDonations({ costs: next });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Título do bloco</Label>
                      <Input
                        value={pages.donations.reasonTitle}
                        onChange={(e) => updateDonations({ reasonTitle: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ícone do bloco</Label>
                      <IconSelect
                        value={pages.donations.reasonIcon || "HeartHandshake"}
                        onChange={(nextIcon) => updateDonations({ reasonIcon: nextIcon })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Texto</Label>
                      <Textarea
                        value={pages.donations.reasonText}
                        onChange={(e) => updateDonations({ reasonText: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Nota</Label>
                      <Textarea
                        value={pages.donations.reasonNote}
                        onChange={(e) => updateDonations({ reasonNote: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="grid gap-2">
                      <Label>Ícone do Pix</Label>
                      <IconSelect
                        value={pages.donations.pixIcon || "QrCode"}
                        onChange={(nextIcon) => updateDonations({ pixIcon: nextIcon })}
                      />
                      <Label>Chave Pix</Label>
                      <Input
                        value={pages.donations.pixKey}
                        onChange={(e) => updateDonations({ pixKey: e.target.value })}
                      />
                      <Label>Nota da chave</Label>
                      <Input
                        value={pages.donations.pixNote}
                        onChange={(e) => updateDonations({ pixNote: e.target.value })}
                      />
                      <Label>QR Code (URL customizada)</Label>
                      <Input
                        value={pages.donations.qrCustomUrl}
                        onChange={(e) => updateDonations({ qrCustomUrl: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex items-center justify-center rounded-xl border border-border/60 bg-background/60 p-4">
                      <img src={qrPreview} alt="Prévia QR Code" className="h-40 w-40 object-cover" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Doadores
                      </h2>
                      <div className="w-full md:w-56">
                        <IconSelect
                          value={pages.donations.donorsIcon || "PiggyBank"}
                          onChange={(nextIcon) => updateDonations({ donorsIcon: nextIcon })}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateDonations({
                            donors: [
                              ...pages.donations.donors,
                              { name: "Novo doador", amount: "", goal: "", date: "" },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {pages.donations.donors.map((donor, index) => (
                        <div
                          key={`${donor.name}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("donations.donors", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("donations.donors", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateDonations({ donors: pages.donations.donors.filter((_, i) => i !== index) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-4">
                            <Input
                              value={donor.name}
                              onChange={(e) => {
                                const next = [...pages.donations.donors];
                                next[index] = { ...donor, name: e.target.value };
                                updateDonations({ donors: next });
                              }}
                              placeholder="Doador"
                            />
                            <Input
                              value={donor.amount}
                              onChange={(e) => {
                                const next = [...pages.donations.donors];
                                next[index] = { ...donor, amount: e.target.value };
                                updateDonations({ donors: next });
                              }}
                              placeholder="Valor"
                            />
                            <Input
                              value={donor.goal}
                              onChange={(e) => {
                                const next = [...pages.donations.donors];
                                next[index] = { ...donor, goal: e.target.value };
                                updateDonations({ donors: next });
                              }}
                              placeholder="Objetivo"
                            />
                            <Input
                              value={donor.date}
                              onChange={(e) => {
                                const next = [...pages.donations.donors];
                                next[index] = { ...donor, date: e.target.value };
                                updateDonations({ donors: next });
                              }}
                              placeholder="Mês/Ano"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="faq" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Título</Label>
                      <Input value={pages.faq.heroTitle} onChange={(e) => updateFaq({ heroTitle: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={pages.faq.heroSubtitle}
                        onChange={(e) => updateFaq({ heroSubtitle: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Cards introdutórios
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateFaq({
                            introCards: [
                              ...pages.faq.introCards,
                              { title: "Novo card", icon: "Info", text: "", note: "" },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {pages.faq.introCards.map((card, index) => (
                        <div
                          key={`${card.title}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("faq.intro", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("faq.intro", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateFaq({ introCards: pages.faq.introCards.filter((_, i) => i !== index) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={card.title}
                              onChange={(e) => {
                                const next = [...pages.faq.introCards];
                                next[index] = { ...card, title: e.target.value };
                                updateFaq({ introCards: next });
                              }}
                            />
                            <Textarea
                              value={card.text}
                              onChange={(e) => {
                                const next = [...pages.faq.introCards];
                                next[index] = { ...card, text: e.target.value };
                                updateFaq({ introCards: next });
                              }}
                            />
                            <Textarea
                              value={card.note}
                              onChange={(e) => {
                                const next = [...pages.faq.introCards];
                                next[index] = { ...card, note: e.target.value };
                                updateFaq({ introCards: next });
                              }}
                            />
                            <IconSelect
                              value={card.icon}
                              onChange={(nextIcon) => {
                                const next = [...pages.faq.introCards];
                                next[index] = { ...card, icon: nextIcon };
                                updateFaq({ introCards: next });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Grupos de FAQ
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateFaq({
                            groups: [...pages.faq.groups, { title: "Novo grupo", icon: "Info", items: [] }],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar grupo
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {pages.faq.groups.map((group, groupIndex) => (
                        <div
                          key={`${group.title}-${groupIndex}`}
                          draggable
                          onDragStart={() => handleDragStart("faq.groups", groupIndex)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("faq.groups", groupIndex)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateFaq({ groups: pages.faq.groups.filter((_, i) => i !== groupIndex) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <Input
                              value={group.title}
                              onChange={(e) => {
                                const next = [...pages.faq.groups];
                                next[groupIndex] = { ...group, title: e.target.value };
                                updateFaq({ groups: next });
                              }}
                            />
                            <IconSelect
                              value={group.icon}
                              onChange={(nextIcon) => {
                                const next = [...pages.faq.groups];
                                next[groupIndex] = { ...group, icon: nextIcon };
                                updateFaq({ groups: next });
                              }}
                            />
                          </div>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Perguntas
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const next = [...pages.faq.groups];
                                  next[groupIndex] = {
                                    ...group,
                                    items: [...group.items, { question: "Nova pergunta", answer: "" }],
                                  };
                                  updateFaq({ groups: next });
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar
                              </Button>
                            </div>
                            <div className="grid gap-3">
                              {group.items.map((item, itemIndex) => (
                                <div
                                  key={`${item.question}-${itemIndex}`}
                                  draggable
                                  onDragStart={(event) => {
                                    // Avoid parent FAQ group dragstart overriding item drag state.
                                    event.stopPropagation();
                                    handleDragStart(`faq.items.${groupIndex}`, itemIndex);
                                  }}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => handleDrop(`faq.items.${groupIndex}`, itemIndex)}
                                  className="rounded-xl border border-border/60 bg-card/70 p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <GripVertical className="h-4 w-4" />
                                      Arraste para reordenar
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const next = [...pages.faq.groups];
                                        const items = group.items.filter((_, i) => i !== itemIndex);
                                        next[groupIndex] = { ...group, items };
                                        updateFaq({ groups: next });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <Input
                                      value={item.question}
                                      onChange={(e) => {
                                        const next = [...pages.faq.groups];
                                        const items = [...group.items];
                                        items[itemIndex] = { ...item, question: e.target.value };
                                        next[groupIndex] = { ...group, items };
                                        updateFaq({ groups: next });
                                      }}
                                    />
                                    <Textarea
                                      value={item.answer}
                                      onChange={(e) => {
                                        const next = [...pages.faq.groups];
                                        const items = [...group.items];
                                        items[itemIndex] = { ...item, answer: e.target.value };
                                        next[groupIndex] = { ...group, items };
                                        updateFaq({ groups: next });
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Badge</Label>
                      <Input value={pages.team.heroBadge} onChange={(e) => updateTeam({ heroBadge: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Título</Label>
                      <Input value={pages.team.heroTitle} onChange={(e) => updateTeam({ heroTitle: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={pages.team.heroSubtitle}
                        onChange={(e) => updateTeam({ heroSubtitle: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Título aposentados</Label>
                      <Input
                        value={pages.team.retiredTitle}
                        onChange={(e) => updateTeam({ retiredTitle: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo aposentados</Label>
                      <Textarea
                        value={pages.team.retiredSubtitle}
                        onChange={(e) => updateTeam({ retiredSubtitle: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recruitment" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Badge</Label>
                      <Input
                        value={pages.recruitment.heroBadge}
                        onChange={(e) => updateRecruitment({ heroBadge: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Título</Label>
                      <Input
                        value={pages.recruitment.heroTitle}
                        onChange={(e) => updateRecruitment({ heroTitle: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={pages.recruitment.heroSubtitle}
                        onChange={(e) => updateRecruitment({ heroSubtitle: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Funções
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateRecruitment({
                            roles: [
                              ...pages.recruitment.roles,
                              { title: "Nova função", description: "", icon: "Sparkles" },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {pages.recruitment.roles.map((role, index) => (
                        <div
                          key={`${role.title}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart("recruitment.roles", index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop("recruitment.roles", index)}
                          className="rounded-xl border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                              Arraste para reordenar
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateRecruitment({
                                  roles: pages.recruitment.roles.filter((_, i) => i !== index),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <Input
                              value={role.title}
                              onChange={(e) => {
                                const next = [...pages.recruitment.roles];
                                next[index] = { ...role, title: e.target.value };
                                updateRecruitment({ roles: next });
                              }}
                            />
                            <IconSelect
                              value={role.icon}
                              onChange={(nextIcon) => {
                                const next = [...pages.recruitment.roles];
                                next[index] = { ...role, icon: nextIcon };
                                updateRecruitment({ roles: next });
                              }}
                            />
                            <Textarea
                              className="md:col-span-2"
                              value={role.description}
                              onChange={(e) => {
                                const next = [...pages.recruitment.roles];
                                next[index] = { ...role, description: e.target.value };
                                updateRecruitment({ roles: next });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Título do CTA</Label>
                      <Input
                        value={pages.recruitment.ctaTitle}
                        onChange={(e) => updateRecruitment({ ctaTitle: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Texto do CTA</Label>
                      <Input
                        value={pages.recruitment.ctaSubtitle}
                        onChange={(e) => updateRecruitment({ ctaSubtitle: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label>Texto do botão</Label>
                      <Input
                        value={pages.recruitment.ctaButtonLabel}
                        onChange={(e) => updateRecruitment({ ctaButtonLabel: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </section>
        </main>
    </DashboardShell>
  );
};

export default DashboardPages;















