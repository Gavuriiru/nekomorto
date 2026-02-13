import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";
import DashboardShell from "@/components/DashboardShell";
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
  FileText,
  FolderCog,
  LayoutGrid,
  MessageSquare,
  Settings,
  Shield,
  UserRound,
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

type PagesConfig = {
  about: {
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
  donations: {
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
  faq: {
    heroTitle: string;
    heroSubtitle: string;
    introCards: FAQIntro[];
    groups: FAQGroup[];
  };
  team: {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    retiredTitle: string;
    retiredSubtitle: string;
  };
  recruitment: {
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
  about: {
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
    heroTitle: "",
    heroSubtitle: "",
    introCards: [],
    groups: [],
  },
  team: {
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    retiredTitle: "",
    retiredSubtitle: "",
  },
  recruitment: {
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    roles: [],
    ctaTitle: "",
    ctaSubtitle: "",
    ctaButtonLabel: "",
  },
};

const seedPages: PagesConfig = {
  about: {
    heroBadge: "Sobre",
    heroTitle: "Uma fansub com identidade própria",
    heroSubtitle:
      "A Nekomata nasceu para entregar traduções naturais, visual marcante e um fluxo de trabalho que respeita a obra e o público. Cada etapa é feita com cuidado editorial e atenção aos detalhes.",
    heroBadges: ["Legendado com carinho", "Sem propaganda", "Gratuito"],
    highlights: [
      {
        label: "Somos movidos por histórias",
        icon: "Sparkles",
        text: "Trabalhamos em equipe para traduzir, adaptar e manter a identidade de cada obra com cuidado editorial.",
      },
      {
        label: "Processo claro e constante",
        icon: "Sparkles",
        text: "Fluxo colaborativo, revisão dupla e ajustes finos fazem parte da nossa rotina.",
      },
      {
        label: "Respeito à obra",
        icon: "Sparkles",
        text: "Apoiamos o consumo legal e preservamos a experiência original, com o toque da comunidade.",
      },
    ],
    manifestoTitle: "Manifesto",
    manifestoIcon: "Flame",
    manifestoParagraphs: [
      "Fazemos tudo por paixão, sem fins lucrativos, priorizando qualidade e uma entrega que dê orgulho à comunidade. Cada projeto é um convite para sentir a obra como ela merece.",
      "Nossas escolhas são orientadas por clareza, estilo e consistência. O resultado precisa ser bonito, legível e fiel ao tom da história.",
    ],
    pillars: [
      { title: "Pipeline", description: "Tradução → Revisão → Timing → Typesetting → Qualidade → Encode.", icon: "Zap" },
      { title: "Comunidade", description: "Feedbacks ajudam a evoluir o padrão e manter a identidade da equipe.", icon: "Users" },
      { title: "Estilo", description: "Tipografia, ritmo e efeitos visuais criam uma experiência memorável.", icon: "Sparkles" },
    ],
    values: [
      {
        title: "Paixão pelo que fazemos",
        description:
          "Cada projeto é tratado com carinho e respeito à obra original, sempre buscando a melhor experiência possível.",
        icon: "Heart",
      },
      {
        title: "Qualidade em cada etapa",
        description: "Do timing ao encode, mantemos um fluxo cuidadoso para entregar consistência e leitura confortável.",
        icon: "Sparkles",
      },
      {
        title: "Comunidade em primeiro lugar",
        description:
          "A equipe cresce junto da comunidade. Feedbacks ajudam a lapidar escolhas e manter a identidade do grupo.",
        icon: "Users",
      },
      {
        title: "Criatividade e estilo",
        description: "Tipografia, efeitos e ritmo contam história. O typesetting é parte essencial da narrativa visual.",
        icon: "Wand2",
      },
    ],
  },
  donations: {
    heroTitle: "Ajude a Nekomata a seguir no ar",
    heroSubtitle:
      "Cada doação mantém o site vivo, fortalece nossos lançamentos e garante qualidade no que entregamos. Se quiser apoiar, qualquer valor faz diferença.",
    costs: [
      { title: "Hospedagem e domínio", description: "Manter o site no ar com estabilidade.", icon: "Server" },
      { title: "Armazenamento", description: "Arquivos, backups e infraestrutura dos projetos.", icon: "PiggyBank" },
      { title: "Incentivo por projeto", description: "Apoio pontual para demandas específicas.", icon: "Sparkles" },
    ],
    reasonTitle: "Por que doar?",
    reasonIcon: "HeartHandshake",
    reasonText:
      "Somos um projeto feito por fãs, sem fins lucrativos. Doações ajudam com custos reais e permitem que a equipe invista tempo e cuidado em cada etapa.",
    reasonNote: "Toda ajuda é bem-vinda. Se quiser apoiar, faça isso por gostar do nosso trabalho.",
    pixKey: "707e9869-0160-4a88-8332-31eac7cee73f",
    pixNote: "Cole a chave no app do seu banco.",
    qrCustomUrl: "",
    pixIcon: "QrCode",
    donorsIcon: "PiggyBank",
    donors: [
      { name: "IgorBKRY", amount: "R$ 10,00", goal: "Fansub Geral", date: "Mar/2024" },
      { name: "Anônimo", amount: "R$ 25,00", goal: "Fansub Geral", date: "Mar/2024" },
      { name: "Anônimo", amount: "R$ 60,00", goal: "Fansub Geral", date: "Mar/2024" },
      { name: "Fabiana A.", amount: "R$ 40,00", goal: "Fansub Geral", date: "Abr/2024" },
      { name: "Rafa Chaves", amount: "R$ 120,00", goal: "Projeto especial", date: "Mai/2024" },
    ],
  },
  faq: {
    heroTitle: "Perguntas frequentes",
    heroSubtitle: "Respostas rápidas para dúvidas comuns sobre projetos, lançamentos e equipe.",
    introCards: [
      {
        title: "Antes de perguntar",
        icon: "HelpCircle",
        text: "Se sua dúvida não estiver aqui, fale com a equipe no Discord. Responderemos assim que possível.",
        note: "A equipe é pequena e trabalha no tempo livre. Obrigado pela compreensão!",
      },
      {
        title: "Dica rápida",
        icon: "Sparkles",
        text: "Para melhor experiência, use players como MPV ou VLC e mantenha o arquivo na mesma pasta da legenda.",
        note: "Sugestões de projetos são bem-vindas, mas dependem de disponibilidade.",
      },
    ],
    groups: [
      {
        title: "Detalhes gerais",
        icon: "Info",
        items: [
          {
            question: "O que é a Nekomata Fansub?",
            answer:
              "Somos um grupo de fãs que traduz e adapta conteúdos com foco em qualidade, estilo e respeito à obra.",
          },
          {
            question: "Vocês cobram pelos lançamentos?",
            answer: "Não. Nosso trabalho é feito por paixão e sem fins lucrativos.",
          },
          {
            question: "Qual a prioridade da equipe?",
            answer: "Entregar algo bonito, legível e consistente, mesmo que isso leve mais tempo.",
          },
        ],
      },
      {
        title: "Recrutamento",
        icon: "Users",
        items: [
          {
            question: "Posso entrar para a equipe?",
            answer: "Sim! Sempre buscamos pessoas comprometidas. Entre em contato pelo Discord.",
          },
          {
            question: "Preciso ter experiência?",
            answer: "Ajuda, mas não é obrigatório. O principal é vontade de aprender e consistência.",
          },
        ],
      },
      {
        title: "Projetos e lançamentos",
        icon: "Rocket",
        items: [
          {
            question: "Quando sai o próximo episódio?",
            answer: "Quando estiver pronto. Evitamos datas exatas para priorizar qualidade.",
          },
          {
            question: "Posso sugerir um projeto?",
            answer: "Pode sim! Levamos em conta a demanda e a capacidade da equipe.",
          },
        ],
      },
      {
        title: "Qualidade e suporte",
        icon: "Shield",
        items: [
          { question: "Como reporto um erro?", answer: "Fale com a equipe pelo Discord. Quanto mais detalhes, melhor." },
          {
            question: "A legenda não aparece. O que faço?",
            answer: "Verifique o player e o arquivo. Recomendamos players como MPV e VLC.",
          },
        ],
      },
    ],
  },
  team: {
    heroBadge: "Equipe",
    heroTitle: "Conheça quem faz o projeto acontecer",
    heroSubtitle:
      "Os perfis e redes sociais serão gerenciados pela dashboard. Este layout antecipa como a equipe aparecerá para o público.",
    retiredTitle: "Membros aposentados",
    retiredSubtitle: "Agradecemos por todas as contribuições.",
  },
  recruitment: {
    heroBadge: "Recrutamento",
    heroTitle: "Venha fazer parte da equipe",
    heroSubtitle:
      "Buscamos pessoas comprometidas e curiosas. Se você gosta de traduções, edição ou produção visual, há um lugar para você aqui.",
    roles: [
      {
        title: "Tradutor",
        description: "Adapta o texto original para português mantendo tom, contexto e naturalidade.",
        icon: "Languages",
      },
      {
        title: "Revisor",
        description: "Garante coerência, gramática e fluidez do texto antes da etapa visual.",
        icon: "ScanText",
      },
      {
        title: "Typesetter",
        description: "Integra o texto à arte, ajustando tipografia, efeitos e legibilidade.",
        icon: "PenTool",
      },
      {
        title: "Quality Check",
        description: "Revisa o resultado final buscando erros visuais, timing e consistência.",
        icon: "ShieldCheck",
      },
      {
        title: "Encoder",
        description: "Responsável por exportação e ajustes finais de qualidade do vídeo/arquivo.",
        icon: "Video",
      },
      {
        title: "Cleaner",
        description: "Remove textos da arte original preparando o material para o typesetting.",
        icon: "Paintbrush",
      },
      {
        title: "Redrawer",
        description: "Reconstrói partes da arte removidas pelo cleaning para preservar o visual.",
        icon: "Layers",
      },
      {
        title: "Timer",
        description: "Sincroniza falas com o tempo, garantindo leitura confortável e precisa.",
        icon: "Timer",
      },
      {
        title: "Karaoke/FX",
        description: "Cria efeitos especiais e animações para openings/endings quando necessário.",
        icon: "Sparkles",
      },
    ],
    ctaTitle: "Pronto para participar?",
    ctaSubtitle: "Entre no nosso servidor e fale com a equipe.",
    ctaButtonLabel: "Entrar no Discord",
  },
};

const defaultPages: PagesConfig = import.meta.env.DEV ? seedPages : emptyPages;

const pageLabels: Record<string, string> = {
  about: "Sobre",
  donations: "Doações",
  faq: "FAQ",
  team: "Equipe",
  recruitment: "Recrutamento",
};

const orderedPageTabs = Object.entries(pageLabels)
  .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, "pt-BR"))
  .map(([key, label]) => ({ key, label }));

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
  const initialAutosaveEnabledRef = useRef(
    autosaveRuntimeConfig.enabledByDefault &&
      readAutosavePreference(autosaveStorageKeys.pages, true),
  );
  const [pages, setPages] = useState<PagesConfig>(defaultPages);
  const [isLoading, setIsLoading] = useState(true);
  const [dragState, setDragState] = useState<{ list: string; index: number } | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);

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
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/pages", { auth: true });
        if (!response.ok) {
          setPages(defaultPages);
          return;
        }
        const data = await response.json();
        setPages({ ...defaultPages, ...(data.pages || {}) });
      } catch {
        setPages(defaultPages);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [apiBase]);

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
      }
    };
    loadUser();
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
      const normalizedPages = { ...defaultPages, ...(data?.pages || nextPages) };
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
      event.preventDefault();
      event.returnValue = "";
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
    }
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
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="mx-auto w-full max-w-5xl px-6 pt-20 text-sm text-muted-foreground">
          Carregando páginas...
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
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
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
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
              defaultValue={orderedPageTabs[0]?.key || "donations"}
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
                                  onDragStart={() => handleDragStart(`faq.items.${groupIndex}`, itemIndex)}
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














