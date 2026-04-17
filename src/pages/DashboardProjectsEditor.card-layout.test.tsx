import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
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
  it("keeps the card stacked until lg and separates actions from the headline", async () => {
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
    const layout = card.querySelector('[data-slot="project-card-layout"]');
    const coverShell = card.querySelector('[data-slot="project-card-cover-shell"]');
    const cover = card.querySelector('[data-slot="project-card-cover"]');
    const content = card.querySelector('[data-slot="project-card-content"]');
    const top = card.querySelector('[data-slot="project-card-top"]');
    const headline = card.querySelector('[data-slot="project-card-headline"]');
    const actions = card.querySelector('[data-slot="project-card-actions"]');
    const synopsis = card.querySelector('[data-slot="project-card-synopsis"]');
    const meta = card.querySelector('[data-slot="project-card-meta"]');

    expect(classTokens(card)).toEqual(
      expect.arrayContaining(["bg-card", "animate-fade-in", "opacity-0"]),
    );
    expect(classTokens(card)).not.toContain("lift-hover");
    expect(layout).not.toBeNull();
    expect(classTokens(layout)).toEqual(
      expect.arrayContaining([
        "grid",
        "min-h-[360px]",
        "lg:h-[342px]",
        "lg:min-h-0",
        "lg:grid-cols-[220px_1fr]",
      ]),
    );
    expect(coverShell).not.toBeNull();
    expect(classTokens(coverShell)).toEqual(
      expect.arrayContaining(["flex", "justify-center", "px-4", "pt-4", "lg:block"]),
    );
    expect(cover).not.toBeNull();
    expect(cover).toHaveStyle({ aspectRatio: "9 / 14" });
    expect(classTokens(cover)).toEqual(
      expect.arrayContaining([
        "w-[180px]",
        "max-w-full",
        "overflow-hidden",
        "lg:h-full",
        "lg:w-full",
      ]),
    );
    expect(classTokens(cover)).not.toContain("h-52");
    expect(classTokens(cover)).not.toContain("w-full");
    expect(
      within(cover as HTMLElement).getByRole("img", { name: "Oshi no Ko" }),
    ).toBeInTheDocument();
    expect(content).not.toBeNull();
    expect(classTokens(content)).toEqual(
      expect.arrayContaining([
        "grid",
        "min-h-0",
        "overflow-hidden",
        "grid-rows-[auto_auto_minmax(0,1fr)_auto]",
      ]),
    );
    expect(top).not.toBeNull();
    expect(classTokens(top)).toEqual(expect.arrayContaining(["items-start", "justify-between"]));
    expect(headline).not.toBeNull();
    expect(within(top as HTMLElement).queryByText("Oshi no Ko")).toBeNull();
    expect(within(headline as HTMLElement).getByText("Oshi no Ko")).toBeInTheDocument();
    expect(actions).not.toBeNull();
    expect(classTokens(actions)).toEqual(expect.arrayContaining(["shrink-0", "flex-wrap"]));
    expect(
      within(actions as HTMLElement).getByRole("link", {
        name: "Abrir editor dedicado de Oshi no Ko",
      }),
    ).toBeInTheDocument();
    expect(synopsis).not.toBeNull();
    expect(classTokens(synopsis)).toEqual(
      expect.arrayContaining(["min-h-0", "max-h-[7.5rem]", "overflow-hidden", "leading-5"]),
    );
    expect(classTokens(synopsis)).not.toContain("clamp-safe-3");
    expect((synopsis as HTMLElement).getAttribute("style") || "").toContain(
      "-webkit-line-clamp: 6",
    );
    expect(meta).not.toBeNull();
    expect(classTokens(meta)).toEqual(
      expect.arrayContaining(["flex-wrap", "gap-y-1", "lg:flex-nowrap", "lg:gap-y-0"]),
    );
    expect(within(meta as HTMLElement).getByText(/119 visualiza/i)).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText(/4 coment/i)).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("ID project-layout")).toBeInTheDocument();
    expect(within(card).queryByText("Atualizacao")).toBeNull();
    expect(within(card).queryByText("Drama")).toBeNull();
    expect(card.querySelector('[data-slot="project-card-tags"]')).toBeNull();
    expect(card.querySelector('[data-slot="project-card-genres"]')).toBeNull();
  });

  it("keeps fallback synopsis and wrapped meta when taxonomy is missing", async () => {
    setupApiMock({
      projects: [
        createProject({
          id: "project-no-taxonomy",
          title: "Projeto Limpo",
          synopsis: "",
          tags: [],
          genres: [],
          commentsCount: 2,
        }),
      ],
    });

    renderEditor();

    const card = await screen.findByTestId("dashboard-project-card-project-no-taxonomy");
    const synopsis = card.querySelector('[data-slot="project-card-synopsis"]');
    const cover = card.querySelector('[data-slot="project-card-cover"]');
    const meta = card.querySelector('[data-slot="project-card-meta"]');

    expect(synopsis).not.toBeNull();
    expect(
      within(synopsis as HTMLElement).getByText("Sem sinopse cadastrada."),
    ).toBeInTheDocument();
    expect(classTokens(synopsis)).toEqual(
      expect.arrayContaining(["max-h-[7.5rem]", "overflow-hidden", "leading-5"]),
    );
    expect((synopsis as HTMLElement).getAttribute("style") || "").toContain(
      "-webkit-line-clamp: 6",
    );
    expect(cover).not.toBeNull();
    expect(cover).toHaveStyle({ aspectRatio: "9 / 14" });
    expect(card.querySelector('[data-slot="project-card-tags"]')).toBeNull();
    expect(card.querySelector('[data-slot="project-card-genres"]')).toBeNull();
    expect(meta).not.toBeNull();
    expect(classTokens(meta)).toEqual(
      expect.arrayContaining(["flex-wrap", "gap-y-1", "lg:flex-nowrap", "lg:gap-y-0"]),
    );
    expect(within(meta as HTMLElement).getByText(/2 coment/i)).toBeInTheDocument();
    expect(within(meta as HTMLElement).getByText("ID project-no-taxonomy")).toBeInTheDocument();
  });
});
