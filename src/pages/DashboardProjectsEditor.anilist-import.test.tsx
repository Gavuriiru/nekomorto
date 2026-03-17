import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
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

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const anilistMediaFixture = {
  id: 21878,
  title: {
    romaji: "New Game!",
    english: "NEW GAME!",
    native: "NEW GAME!",
  },
  description: "<p>Descricao</p>",
  episodes: 12,
  genres: ["Comedy"],
  format: "TV",
  status: "FINISHED",
  countryOfOrigin: "JP",
  season: "SUMMER",
  seasonYear: 2016,
  startDate: { year: 2016, month: 7, day: 4 },
  endDate: { year: 2016, month: 9, day: 19 },
  source: "MANGA",
  averageScore: 76,
  bannerImage: "",
  coverImage: { large: "", extraLarge: "" },
  studios: {
    edges: [
      {
        isMain: true,
        node: {
          id: 1,
          name: "Doga Kobo",
          isAnimationStudio: true,
        },
      },
      {
        isMain: false,
        node: {
          id: 2,
          name: "Kadokawa Media House",
          isAnimationStudio: false,
        },
      },
      {
        isMain: false,
        node: {
          id: 3,
          name: "AT-X",
          isAnimationStudio: false,
        },
      },
      {
        isMain: false,
        node: {
          id: 4,
          name: "Sony Music Communications",
          isAnimationStudio: false,
        },
      },
      {
        isMain: false,
        node: {
          id: 5,
          name: "KADOKAWA",
          isAnimationStudio: false,
        },
      },
    ],
  },
  tags: [],
  trailer: null,
  relations: { edges: [], nodes: [] },
  staff: { edges: [], nodes: [] },
};

describe("DashboardProjectsEditor AniList import", () => {
  it("salva studio, animationStudios e producers em campos separados", async () => {
    let savedProject: Record<string, unknown> | null = null;
    apiFetchMock.mockReset();
    toastMock.mockReset();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
    }

    apiFetchMock.mockImplementation(
      async (_base: string, path: string, options?: RequestInit & { json?: unknown }) => {
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
          return mockJsonResponse(true, { projects: [] });
        }
        if (path === "/api/users" && method === "GET") {
          return mockJsonResponse(true, { users: [] });
        }
        if (path === "/api/public/tag-translations" && method === "GET") {
          return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
        }
        if (path === "/api/tag-translations/sync" && method === "POST") {
          return mockJsonResponse(true, { ok: true });
        }
        if (path === "/api/anilist/21878" && method === "GET") {
          return mockJsonResponse(true, { data: { Media: anilistMediaFixture } });
        }
        if (path === "/api/projects" && method === "POST") {
          savedProject = (options?.json || null) as Record<string, unknown> | null;
          return mockJsonResponse(true, { project: options?.json });
        }

        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    fireEvent.click(screen.getByRole("button", { name: "Novo projeto" }));

    await screen.findByRole("heading", { name: "Novo projeto" });
    fireEvent.change(screen.getByLabelText(/ID ou URL do AniList/i), {
      target: { value: "21878" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Importar do AniList$/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/anilist/21878",
        expect.objectContaining({ auth: true }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar projeto" }));

    await waitFor(() => {
      expect(savedProject).not.toBeNull();
    });

    expect(savedProject).toEqual(
      expect.objectContaining({
        anilistId: 21878,
        title: "New Game!",
        studio: "Doga Kobo",
        animationStudios: ["Doga Kobo"],
        producers: ["Kadokawa Media House", "AT-X", "Sony Music Communications", "KADOKAWA"],
      }),
    );
  });
});
