import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  default: ({
    title,
    actions,
  }: {
    title: string;
    actions?: ReactNode;
  }) => (
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
  const MockEditor = React.forwardRef((props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
    lexicalPropsSpy(props);
    React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
    return <div data-testid="lexical-editor" />;
  });
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

const projectFixture = {
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
      content: "{\"root\":{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}",
      contentFormat: "lexical",
    },
  ],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  imageLibraryPropsSpy.mockReset();
  lexicalPropsSpy.mockReset();
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
  it("passa contexto por projeto para biblioteca e editor de episodio", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    const projectTitle = await screen.findByText("Projeto Teste");
    fireEvent.click(projectTitle);
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
    };
    expect(imageLibraryProps.uploadFolder).toBe("projects/project-1");
    expect(imageLibraryProps.listFolders).toEqual([
      "projects/project-1",
      "projects/project-1/episodes",
    ]);
    expect(imageLibraryProps.listAll).toBe(false);
    expect(imageLibraryProps.includeProjectImages).toBe(true);
    expect(imageLibraryProps.projectImageProjectIds).toEqual(["project-1"]);

    const episodesSectionTrigger = await screen.findByText("Capítulos");
    fireEvent.click(episodesSectionTrigger);

    const episodeCard = await screen.findByTestId("episode-card-0");
    const episodeToggleButton = episodeCard.querySelector("button");
    expect(episodeToggleButton).toBeTruthy();
    fireEvent.click(episodeToggleButton as HTMLButtonElement);

    await waitFor(() => {
      expect(lexicalPropsSpy).toHaveBeenCalled();
    });

    const lexicalWithEpisodeContext = lexicalPropsSpy.mock.calls
      .map((call) => call[0] as { imageLibraryOptions?: { uploadFolder?: string; listFolders?: string[]; listAll?: boolean } })
      .find((props) => props.imageLibraryOptions?.uploadFolder === "projects/project-1/episodes");

    expect(lexicalWithEpisodeContext).toBeTruthy();
    expect(lexicalWithEpisodeContext?.imageLibraryOptions).toEqual({
      uploadFolder: "projects/project-1/episodes",
      listFolders: ["projects/project-1/episodes", "projects/project-1"],
      listAll: false,
      includeProjectImages: true,
      projectImageProjectIds: ["project-1"],
    });
  });
});
