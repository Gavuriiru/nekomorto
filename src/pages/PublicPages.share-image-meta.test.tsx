import {
  publicInteractiveStackedSurfaceClassName,
  publicStackedSurfaceClassName,
} from "@/components/public-page-tokens";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import About from "@/pages/About";
import Donations from "@/pages/Donations";
import FAQ from "@/pages/FAQ";
import Index from "@/pages/Index";
import Projects from "@/pages/Projects";
import Recruitment from "@/pages/Recruitment";
import Team from "@/pages/Team";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

const apiFetchMock = vi.hoisted(() => vi.fn());
const usePageMetaMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: (...args: unknown[]) => usePageMetaMock(...args),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-dynamic-synopsis-clamp", () => ({
  useDynamicSynopsisClamp: () => ({
    rootRef: { current: null },
    lineByKey: {},
  }),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: {
        name: "Nekomata",
        description: "Descricao padrao do site",
      },
      footer: {
        brandName: "",
      },
      community: {
        discordUrl: "#",
      },
      theme: {
        accent: "#3173ff",
      },
    },
  }),
}));

vi.mock("@/hooks/use-pix-qr-code", () => ({
  usePixQrCode: () => ({
    imageDataUrl: "",
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/HeroSection", () => ({
  default: () => null,
}));

vi.mock("@/components/ReleasesSection", () => ({
  default: () => null,
}));

vi.mock("@/components/PublicPageHero", () => ({
  default: () => null,
}));

vi.mock("@/components/PublicUserProfileCard", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const bootstrapPayload = {
  settings: {
    site: {
      name: "Nekomata",
      description: "Descricao padrao do site",
    },
    footer: {
      brandName: "",
    },
    community: {
      discordUrl: "#",
    },
    theme: {
      accent: "#3173ff",
    },
  },
  pages: {
    home: {
      shareImage: "/uploads/home-og.jpg",
      shareImageAlt: "Capa da pagina inicial",
    },
    projects: {
      shareImage: "/uploads/projects-og.jpg",
      shareImageAlt: "Capa da pagina de projetos",
    },
    about: {
      shareImage: "/uploads/about-og.jpg",
      shareImageAlt: "Capa da pagina sobre",
      heroSubtitle: "Conheca melhor a equipe e a proposta editorial da Nekomata.",
      heroBadges: [],
      highlights: [
        {
          label: "Somos movidos por historias",
          icon: "Sparkles",
          text: "Trabalhamos em equipe para traduzir, adaptar e manter a identidade de cada obra.",
        },
      ],
      manifestoTitle: "Manifesto",
      manifestoIcon: "Flame",
      manifestoParagraphs: ["Fazemos tudo por paixao, sem fins lucrativos, priorizando qualidade."],
      pillars: [
        {
          title: "Pipeline",
          description: "Traducao, revisao e qualidade.",
          icon: "Zap",
        },
      ],
      values: [
        {
          title: "Qualidade em cada etapa",
          description: "Mantemos um fluxo cuidadoso para entregar consistencia.",
          icon: "Sparkles",
        },
      ],
    },
    donations: {
      shareImage: "/uploads/donations-og.jpg",
      shareImageAlt: "Capa da pagina de doacoes",
      heroSubtitle: "Ajude a manter o projeto no ar.",
    },
    faq: {
      shareImage: "/uploads/faq-og.jpg",
      shareImageAlt: "Capa da pagina FAQ",
      heroSubtitle: "Respostas para as duvidas mais comuns.",
      introCards: [
        {
          title: "Antes de perguntar",
          icon: "HelpCircle",
          text: "Se sua duvida nao estiver aqui, fale com a equipe.",
          note: "Obrigado pela compreensao.",
        },
      ],
      groups: [
        {
          title: "Detalhes gerais",
          icon: "Info",
          items: [
            {
              question: "O que e a Nekomata Fansub?",
              answer: "Somos um grupo de fas que traduz e adapta conteudos.",
            },
          ],
        },
      ],
    },
    team: {
      shareImage: "/uploads/team-og.jpg",
      shareImageAlt: "Capa da pagina equipe",
      heroSubtitle: "Conheca quem faz tudo acontecer.",
    },
    recruitment: {
      shareImage: "/uploads/recruitment-og.jpg",
      shareImageAlt: "Capa da pagina recrutamento",
      heroSubtitle: "Venha fazer parte da equipe.",
    },
  },
  projects: [],
  posts: [],
  updates: [],
  teamMembers: [],
  teamLinkTypes: [],
  tagTranslations: {
    tags: {},
    genres: {},
    staffRoles: {},
  },
  generatedAt: "2026-03-03T20:00:00.000Z",
  mediaVariants: {},
  payloadMode: "full",
};

const getInstitutionalImage = (pageKey: string) =>
  buildVersionedInstitutionalOgImagePath({
    pageKey,
    revision: buildInstitutionalOgRevision({
      pageKey,
      pages: bootstrapPayload.pages,
      settings: bootstrapPayload.settings,
    }),
  });

const hasMetaCall = (matcher: (arg: Record<string, unknown>) => boolean) =>
  usePageMetaMock.mock.calls.some(([arg]) => matcher(arg as Record<string, unknown>));

const setWindowBootstrap = (payload: unknown) => {
  (
    window as Window &
      typeof globalThis & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
  ).__BOOTSTRAP_PUBLIC__ = payload;
};

describe("Public pages share image meta", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    usePageMetaMock.mockReset();
    setWindowBootstrap(bootstrapPayload);
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/public/projects") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (path === "/api/public/users") {
        return mockJsonResponse(true, { users: [], mediaVariants: {} });
      }
      if (path === "/api/link-types") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  afterEach(() => {
    delete (
      window as Window &
        typeof globalThis & {
          __BOOTSTRAP_PUBLIC__?: unknown;
        }
    ).__BOOTSTRAP_PUBLIC__;
  });

  it("Index mantem pages.home.shareImage no metadata", async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.image === "/uploads/home-og.jpg" && arg.imageAlt === "Capa da pagina inicial",
        ),
      ).toBe(true);
    });
  });

  it("Projects publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.title === "Projetos" &&
            arg.image === getInstitutionalImage("projects") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("projects"),
        ),
      ).toBe(true);
    });

    expect(apiFetchMock.mock.calls.some((call) => call[1] === "/api/public/pages")).toBe(false);
  });

  it("About publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/sobre"]}>
        <About />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.title === "Sobre" &&
            arg.image === getInstitutionalImage("about") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("about"),
        ),
      ).toBe(true);
    });
  });

  it("About restaura hover visual nos cards publicos", () => {
    render(
      <MemoryRouter initialEntries={["/sobre"]}>
        <About />
      </MemoryRouter>,
    );

    const highlightCard = screen.getByText(/Somos movidos/).closest(".group");
    expect(highlightCard).toHaveClass(
      "group",
      ...publicInteractiveStackedSurfaceClassName.split(" "),
      "hover:border-primary/60",
      "hover:bg-background/80",
    );
    expect(screen.getByText(/Trabalhamos em equipe/)).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover:text-foreground/80",
    );

    for (const label of ["Manifesto", "Pipeline", "Qualidade em cada etapa"]) {
      expect(screen.getByText(label).closest(".group")).toHaveClass(
        "group",
        ...publicInteractiveStackedSurfaceClassName.split(" "),
        "hover:border-primary/60",
        "hover:bg-card/90",
      );
    }

    expect(screen.getByText(/Fazemos tudo por/)).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover:text-foreground/80",
    );
  });

  it("Donations publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/doacoes"]}>
        <Donations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            String(arg.image || "") === getInstitutionalImage("donations") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("donations"),
        ),
      ).toBe(true);
    });
  });

  it("Donations restaura hover visual nos cards sem botoes", () => {
    setWindowBootstrap({
      ...bootstrapPayload,
      pages: {
        ...bootstrapPayload.pages,
        donations: {
          ...bootstrapPayload.pages.donations,
          heroTitle: "Doacoes",
          costs: [
            {
              title: "Hospedagem",
              icon: "Server",
              description: "Mantem servidor, storage e trafego das leituras.",
            },
          ],
          reasonTitle: "Por que apoiar",
          reasonIcon: "HeartHandshake",
          reasonText: "Sua ajuda mantem a operacao sem anuncios invasivos.",
          reasonNote: "Toda ajuda vira infraestrutura para as obras.",
          pixKey: "pix-chave-teste",
          pixIcon: "QrCode",
          donorsIcon: "PiggyBank",
          donors: [
            {
              name: "Apoiador",
              amount: "R$ 25,00",
              goal: "Servidor",
              date: "04/2026",
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/doacoes"]}>
        <Donations />
      </MemoryRouter>,
    );

    const costTitle = screen.getByText("Hospedagem");
    expect(costTitle.closest(".group")).toHaveClass(
      "group",
      ...publicInteractiveStackedSurfaceClassName.split(" "),
      "hover:border-primary/60",
      "hover:bg-card/90",
    );
    expect(costTitle).toHaveClass("transition-colors", "duration-300", "group-hover:text-primary");
    expect(screen.getByText(/Mantem servidor/)).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover:text-foreground/80",
    );

    const reasonTitle = screen.getByText("Por que apoiar");
    expect(screen.getByTestId("donations-reason-panel")).toHaveClass(
      "space-y-4",
      "rounded-2xl",
      "p-2",
    );
    expect(reasonTitle).toHaveClass("flex", "items-center", "gap-3", "text-sm");
    expect(screen.getByText(/sem anuncios/)).toHaveClass(
      "text-sm",
      "text-muted-foreground",
      "md:text-base",
    );
    expect(screen.getByText(/Toda ajuda/)).toHaveClass(
      "rounded-2xl",
      "border",
      "border-border/60",
      "bg-background/60",
      "p-4",
    );

    const donorsTitle = screen.getByText("Lista de doadores");
    expect(screen.getByTestId("donations-donors-card")).toHaveClass(
      "bg-card/80",
      ...publicStackedSurfaceClassName.split(" "),
    );
    expect(donorsTitle).toHaveClass("flex", "items-center", "gap-3", "text-xl", "font-semibold");

    expect(screen.getByText(/^Pix$/).closest("#pix-doacoes")).not.toHaveClass(
      "hover:-translate-y-1",
    );
  });

  it("FAQ publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/faq"]}>
        <FAQ />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.title === "FAQ" &&
            arg.image === getInstitutionalImage("faq") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("faq"),
        ),
      ).toBe(true);
    });
  });

  it("FAQ restaura hover visual nos cards publicos", () => {
    render(
      <MemoryRouter initialEntries={["/faq"]}>
        <FAQ />
      </MemoryRouter>,
    );

    const introTitle = screen.getByText("Antes de perguntar");
    expect(introTitle.closest(".group")).toHaveClass(
      "group",
      ...publicInteractiveStackedSurfaceClassName.split(" "),
      "hover:border-primary/60",
      "hover:bg-card/90",
    );
    expect(introTitle).toHaveClass("transition-colors", "duration-300", "group-hover:text-primary");
    expect(screen.getByText(/Se sua/)).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover:text-foreground/80",
    );

    const question = screen.getByText(/Nekomata Fansub/);
    const questionCard = question.closest(".group\\/item");
    expect(questionCard).toHaveClass(
      "group/item",
      "hover:-translate-y-1",
      "hover:border-primary/60",
      "hover:bg-background/70",
    );
    expect(questionCard).not.toHaveClass("hover:shadow-public-card");
    expect(question).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover/item:text-primary",
    );
    expect(screen.getByText(/Somos um grupo/)).toHaveClass(
      "transition-colors",
      "duration-300",
      "group-hover/item:text-foreground/80",
    );
  });

  it("Team publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/equipe"]}>
        <Team />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.title === "Equipe" &&
            arg.image === getInstitutionalImage("team") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("team"),
        ),
      ).toBe(true);
    });
  });

  it("Recruitment publica o card OG institucional versionado", async () => {
    render(
      <MemoryRouter initialEntries={["/recrutamento"]}>
        <Recruitment />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            arg.title === "Recrutamento" &&
            arg.image === getInstitutionalImage("recruitment") &&
            arg.imageAlt === buildInstitutionalOgImageAlt("recruitment"),
        ),
      ).toBe(true);
    });
  });
});
