import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBootstrapProvider } from "@/hooks/public-bootstrap-provider";
import ProjectPage from "@/pages/Project";
import type {
  PublicBootstrapPayload,
  PublicBootstrapProject,
  PublicRouteProjectDetailPayload,
} from "@/types/public-bootstrap";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFetchBestEffort: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: {
        defaultShareImage: "",
        defaultShareImageAlt: "",
      },
      downloads: { sources: [] },
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-public-current-user", () => ({
  usePublicCurrentUser: () => ({
    currentUser: null,
  }),
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createProjectFixture = (
  overrides: Partial<PublicBootstrapProject> = {},
): PublicBootstrapProject => ({
  id: "project-1",
  title: "Projeto Inicial",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse inicial",
  description: "Descricao inicial",
  type: "Anime",
  status: "Em andamento",
  year: "2026",
  tags: [],
  genres: [],
  cover: "/uploads/project-initial-cover.jpg",
  coverAlt: "",
  banner: "/uploads/project-initial-banner.jpg",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  heroImageUrl: "",
  heroImageAlt: "",
  heroLogoUrl: "",
  heroLogoAlt: "",
  forceHero: false,
  trailerUrl: "",
  studio: "Studio Inicial",
  animationStudios: [],
  episodes: "12 episodios",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  staff: [],
  animeStaff: [],
  relations: [],
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: 0,
  viewsDaily: {},
  commentsCount: 0,
  ...overrides,
});

const projectOneFixture = createProjectFixture();
const projectTwoFixture = createProjectFixture({
  id: "project-2",
  title: "Projeto Seguinte",
  synopsis: "Sinopse seguinte",
  description: "Descricao seguinte",
  cover: "/uploads/project-next-cover.jpg",
  banner: "/uploads/project-next-banner.jpg",
  studio: "Studio Seguinte",
});

const bootstrapPayload: PublicBootstrapPayload = {
  settings: {} as PublicBootstrapPayload["settings"],
  pages: {} as PublicBootstrapPayload["pages"],
  projects: [projectOneFixture],
  inProgressItems: [],
  posts: [],
  updates: [],
  teamMembers: [],
  teamLinkTypes: [],
  mediaVariants: {},
  tagTranslations: {
    tags: {},
    genres: {},
    staffRoles: {},
  },
  homeHero: null,
  currentPostDetail: null,
  generatedAt: "2026-05-18T12:00:00.000Z",
  payloadMode: "full",
};

const routePayload: PublicRouteProjectDetailPayload = {
  kind: "project-detail",
  generatedAt: "2026-05-18T12:00:00.000Z",
  project: projectOneFixture,
  revision: "revision-project-1",
  mediaVariants: {},
  relationProjectLookup: {},
  tagTranslations: {
    tags: {},
    genres: {},
    staffRoles: {},
  },
};

const ProjectRouteHarness = () => {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate("/projeto/project-2")}>
        Abrir projeto seguinte
      </button>
      <ProjectPage />
    </>
  );
};

describe("Project route transitions", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("mantem o projeto anterior visivel ate o novo slug resolver", async () => {
    let resolveProjectRequest: ((value: Response) => void) | null = null;

    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();

        if (endpoint === "/api/public/projects/project-2" && method === "GET") {
          return await new Promise<Response>((resolve) => {
            resolveProjectRequest = resolve;
          });
        }

        if (
          endpoint === "/api/public/projects/project-1/view" ||
          endpoint === "/api/public/projects/project-2/view"
        ) {
          return mockJsonResponse(true, { ok: true });
        }

        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    render(
      <PublicBootstrapProvider
        initialPublicBootstrap={bootstrapPayload}
        initialPublicRoutePayload={routePayload}
      >
        <MemoryRouter initialEntries={["/projeto/project-1"]}>
          <Routes>
            <Route path="/projeto/:slug" element={<ProjectRouteHarness />} />
          </Routes>
        </MemoryRouter>
      </PublicBootstrapProvider>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Projeto Inicial" })).toBeInTheDocument();
    expect(screen.getByText("Sinopse inicial")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir projeto seguinte" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("", "/api/public/projects/project-2");
    });
    expect(screen.getByRole("heading", { level: 1, name: "Projeto Inicial" })).toBeInTheDocument();
    expect(screen.getByText("Sinopse inicial")).toBeInTheDocument();
    expect(screen.queryByText("Carregando projeto...")).not.toBeInTheDocument();

    await act(async () => {
      resolveProjectRequest?.(
        mockJsonResponse(true, {
          project: projectTwoFixture,
          revision: "revision-project-2",
          mediaVariants: {},
          translations: {
            tags: {},
            genres: {},
            staffRoles: {},
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Projeto Seguinte" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Sinopse seguinte")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Projeto Inicial" }),
    ).not.toBeInTheDocument();
  });
});
