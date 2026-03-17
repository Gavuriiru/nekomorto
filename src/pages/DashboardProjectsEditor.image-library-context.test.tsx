import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock, imageLibraryPropsSpy, lexicalPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
  lexicalPropsSpy: vi.fn(),
}));

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
  default: (props: unknown) => {
    imageLibraryPropsSpy(props);
    return <div data-testid="image-library-dialog" />;
  },
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
      lexicalPropsSpy(props);
      React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
      return <div data-testid="lexical-editor" />;
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

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

const projectFixtureBase = {
  id: "project-1",
  anilistId: 1001,
  title: "Projeto Teste",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Light Novel",
  status: "Em andamento",
  year: "2025",
  studio: "Studio Teste",
  episodes: "1",
  tags: [],
  genres: [],
  cover: "",
  banner: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
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
  episodeDownloads: [
    {
      number: 1,
      title: "Capitulo 1",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      content:
        '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      contentFormat: "lexical",
    },
  ],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const buildProjectFixture = (
  overrides: Partial<typeof projectFixtureBase> = {},
): typeof projectFixtureBase => ({
  ...projectFixtureBase,
  ...overrides,
  episodeDownloads: Array.isArray(overrides.episodeDownloads)
    ? overrides.episodeDownloads
    : [...projectFixtureBase.episodeDownloads],
});

const setupApiMock = (projectOverrides: Partial<typeof projectFixtureBase> = {}) => {
  apiFetchMock.mockReset();
  imageLibraryPropsSpy.mockReset();
  lexicalPropsSpy.mockReset();
  const projectFixture = buildProjectFixture(projectOverrides);
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
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [projectFixture] });
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

describe("DashboardProjectsEditor image library context", () => {
  it("renderiza um unico botao acessivel para abrir o projeto", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    const projectCardButtons = await screen.findAllByRole("button", {
      name: "Abrir projeto Projeto Teste",
    });

    expect(projectCardButtons).toHaveLength(1);
    expect(projectCardButtons[0]).not.toHaveAttribute("aria-hidden");
    expect(projectCardButtons[0]).not.toHaveAttribute("tabindex", "-1");
  });

  it("passa contexto por projeto e leva light novel ao editor dedicado", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    const projectCardButtons = await screen.findAllByRole("button", {
      name: "Abrir projeto Projeto Teste",
    });
    expect(projectCardButtons).toHaveLength(1);
    const projectCardButton = projectCardButtons[0];
    expect(
      screen.queryByRole("button", { name: "Editar projeto Projeto Teste" }),
    ).not.toBeInTheDocument();
    fireEvent.click(projectCardButton);
    await screen.findByText("Editar projeto");

    await waitFor(() => {
      const latestImageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
        uploadFolder?: string;
      };
      expect(latestImageLibraryProps?.uploadFolder).toBe("projects/project-1");
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      uploadFolder?: string;
      listFolders?: string[];
      listAll?: boolean;
      includeProjectImages?: boolean;
      projectImageProjectIds?: string[];
      projectImagesView?: "flat" | "by-project";
    };
    expect(imageLibraryProps.uploadFolder).toBe("projects/project-1");
    expect(imageLibraryProps.listFolders).toEqual([
      "projects/project-1",
      "projects/project-1/episodes",
    ]);
    expect(imageLibraryProps.listAll).toBe(false);
    expect(imageLibraryProps.includeProjectImages).toBe(true);
    expect(imageLibraryProps.projectImageProjectIds).toEqual(["project-1"]);
    expect(imageLibraryProps.projectImagesView).toBe("by-project");
    expect(screen.queryByTestId("volume-group-none")).not.toBeInTheDocument();
    expect(lexicalPropsSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Conte.do/i })).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-1/capitulos",
    );
  });

  it("aplica pasta de capitulo tambem para manga na biblioteca da capa", async () => {
    setupApiMock({ type: "Manga" });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    const projectCardButton = await screen.findByRole("button", {
      name: "Abrir projeto Projeto Teste",
    });
    fireEvent.click(projectCardButton);
    await screen.findByText("Editar projeto");

    const [episodesSectionTrigger] = await screen.findAllByRole("button", { name: /Conte.do/i });
    fireEvent.click(episodesSectionTrigger);
    const volumeGroup = await screen.findByTestId("volume-group-none");
    const volumeGroupTrigger = volumeGroup.querySelector("button");
    expect(volumeGroupTrigger).toBeTruthy();
    fireEvent.click(volumeGroupTrigger as HTMLButtonElement);

    const episodeCard = await screen.findByTestId("episode-card-0");
    const episodeToggleButton = episodeCard.querySelector("button");
    expect(episodeToggleButton).toBeTruthy();
    fireEvent.click(episodeToggleButton as HTMLButtonElement);

    const episodeLibraryButton = within(episodeCard).getAllByRole("button", {
      name: "Biblioteca",
    })[0];
    fireEvent.click(episodeLibraryButton);

    await waitFor(() => {
      const latestImageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
        uploadFolder?: string;
      };
      expect(latestImageLibraryProps?.uploadFolder).toBe(
        "projects/project-1/capitulos/volume-sem-volume/capitulo-1",
      );
    });

    const latestImageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
    };
    expect(latestImageLibraryProps.listFolders).toEqual([
      "projects/project-1/capitulos/volume-sem-volume/capitulo-1",
      "projects/project-1/capitulos",
      "projects/project-1/episodes",
      "projects/project-1",
    ]);
  });
});
