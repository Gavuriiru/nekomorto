import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
      downloads: { sources: [] },
    },
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const classTokens = (element: Element | null) =>
  String((element as HTMLElement | null)?.className || "")
    .split(/\s+/)
    .filter(Boolean);

const createProject = (
  overrides: Partial<{
    id: string;
    title: string;
    synopsis: string;
    type: string;
    status: string;
    studio: string;
    tags: string[];
    genres: string[];
    views: number;
    commentsCount: number;
    order: number;
  }> = {},
) => ({
  id: overrides.id ?? "project-1",
  anilistId: 1001,
  title: overrides.title ?? "Projeto 1",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: overrides.synopsis ?? "Sinopse curta.",
  description: overrides.synopsis ?? "Sinopse curta.",
  type: overrides.type ?? "Anime",
  status: overrides.status ?? "Finalizado",
  year: "2025",
  studio: overrides.studio ?? "Doga Kobo",
  episodes: "12",
  tags: overrides.tags ?? [],
  genres: overrides.genres ?? [],
  cover: "",
  coverAlt: "",
  banner: "",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  discordRoleId: "",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  relations: [],
  staff: [],
  animeStaff: [],
  trailerUrl: "",
  forceHero: false,
  heroImageUrl: "",
  heroImageAlt: "",
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: overrides.views ?? 119,
  commentsCount: overrides.commentsCount ?? 0,
  order: overrides.order ?? 1,
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
  deletedBy: null,
});

const setupApiMock = ({
  projects = [createProject()],
}: {
  projects?: ReturnType<typeof createProject>[];
} = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "1",
        name: "Admin",
        username: "admin",
        permissions: ["projetos"],
      });
    }
    if (path === "/api/contracts/v1.json" && method === "GET") {
      return mockJsonResponse(true, {
        capabilities: {
          project_epub_import: false,
          project_epub_export: false,
        },
        build: null,
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, { users: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/projetos"]}>
      <DashboardProjectsEditor />
    </MemoryRouter>,
  );

describe("DashboardProjectsEditor card layout", () => {
  it("ancora a linha de meta no fundo quando o card possui tags e generos", async () => {
    setupApiMock({
      projects: [
        createProject({
          id: "project-layout",
          title: "Oshi no Ko",
          synopsis:
            "When a pregnant young starlet appears in Gorou Amemiya's clinic, the doctor takes it upon himself to help.",
          tags: ["Atualizacao", "Gemeos"],
          genres: ["Drama", "Misterio"],
          commentsCount: 4,
        }),
      ],
    });

    renderEditor();

    await screen.findByRole("heading", { name: "Gerenciar projetos" });

    const card = await screen.findByTestId("dashboard-project-card-project-layout");
    const cover = card.querySelector('[data-slot="project-card-cover"]');
    const content = card.querySelector('[data-slot="project-card-content"]');
    const middle = card.querySelector('[data-slot="project-card-middle"]');
    const meta = card.querySelector('[data-slot="project-card-meta"]');

    expect(cover).not.toBeNull();
    expect(classTokens(card)).toContain("bg-card");
    expect(classTokens(card)).not.toContain("lift-hover");
    expect(
      within(cover as HTMLElement).getByRole("img", { name: "Oshi no Ko" }),
    ).toBeInTheDocument();
    expect(within(cover as HTMLElement).queryByText("Atualizacao")).toBeNull();
    expect(content).not.toBeNull();
    expect(classTokens(content)).toContain("flex");
    expect(classTokens(content)).toContain("flex-col");
    expect(middle).not.toBeNull();
    expect(classTokens(middle)).toContain("flex-1");
    expect(meta).not.toBeNull();
    expect(classTokens(meta)).toContain("mt-auto");
    expect(middle?.lastElementChild).toBe(meta);
    expect(card.querySelector('[data-slot="project-card-tags"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="project-card-genres"]')).not.toBeNull();
    expect(within(meta as HTMLElement).getByText("119 visualizações")).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("4 comentários")).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("ID project-layout")).toBeInTheDocument();
  });

  it("mantem a linha de meta no fundo mesmo sem tags e generos", async () => {
    setupApiMock({
      projects: [
        createProject({
          id: "project-no-taxonomy",
          title: "Projeto Limpo",
          tags: [],
          genres: [],
          commentsCount: 2,
        }),
      ],
    });

    renderEditor();

    const card = await screen.findByTestId("dashboard-project-card-project-no-taxonomy");
    const middle = card.querySelector('[data-slot="project-card-middle"]');
    const meta = card.querySelector('[data-slot="project-card-meta"]');

    expect(middle).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(card.querySelector('[data-slot="project-card-tags"]')).toBeNull();
    expect(card.querySelector('[data-slot="project-card-genres"]')).toBeNull();
    expect(classTokens(meta)).toContain("mt-auto");
    expect(middle?.lastElementChild).toBe(meta);
    expect(within(meta as HTMLElement).getByText("ID project-no-taxonomy")).toBeInTheDocument();
  });

  it("preserva o clamp da sinopse e as acoes do topo no card reestruturado", async () => {
    const longTitle =
      "Rekishi ni Nokoru Akujo ni Naruzo: Akuyaku Reijou ni Naru hodo Ouji no Dekiai wa Kasoku Suru you desu!";

    setupApiMock({
      projects: [
        createProject({
          id: "project-long",
          title: longTitle,
          synopsis:
            "Uma sinopse longa o suficiente para ocupar varias linhas e validar que a estrutura do card continua usando line-clamp-3 enquanto o rodape segue ancorado no fundo da coluna direita.",
          tags: ["Atualizacao"],
          genres: [],
          commentsCount: 7,
        }),
      ],
    });

    renderEditor();

    const card = await screen.findByTestId("dashboard-project-card-project-long");
    const top = card.querySelector('[data-slot="project-card-top"]');
    const synopsis = card.querySelector('[data-slot="project-card-synopsis"]');
    const meta = card.querySelector('[data-slot="project-card-meta"]');
    const title = within(card).getByRole("heading", {
      level: 3,
      name: /Rekishi ni Nokoru Akujo/i,
    });
    const titleBlock = title.parentElement;
    const dedicatedEditorLink = within(card).getByRole("link", {
      name: /Abrir editor dedicado de Rekishi ni Nokoru Akujo/i,
    });
    const actions = dedicatedEditorLink.parentElement;

    expect(top).not.toBeNull();
    expect(classTokens(top)).toContain("flex-col");
    expect(classTokens(top)).toContain("md:flex-row");
    expect(synopsis).not.toBeNull();
    expect(classTokens(synopsis)).toContain("line-clamp-3");
    expect(meta).not.toBeNull();
    expect(classTokens(meta)).toContain("mt-auto");
    expect(titleBlock).not.toBeNull();
    expect(classTokens(titleBlock)).toContain("min-w-0");
    expect(classTokens(titleBlock)).toContain("flex-1");
    expect(classTokens(title)).toContain("line-clamp-2");
    expect(classTokens(title)).toContain("break-words");
    expect(actions).not.toBeNull();
    expect(classTokens(actions)).toContain("shrink-0");
    expect(classTokens(actions)).toContain("flex-wrap");
    expect(classTokens(actions)).toContain("justify-end");
    expect(dedicatedEditorLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-long/episodios",
    );
    expect(within(card).getByTitle("Editor dedicado")).toBeInTheDocument();
    expect(within(card).queryByText("Editor dedicado")).not.toBeInTheDocument();
    expect(within(card).getByTitle("Visualizar")).toBeInTheDocument();
    expect(within(card).getByTitle("Copiar link")).toBeInTheDocument();
    expect(within(card).getByTitle("Excluir")).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("7 comentários")).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("ID project-long")).toBeInTheDocument();
  });
});
