import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
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

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<{ blur: () => void; focus: () => void }>) => {
      React.useImperativeHandle(ref, () => ({ blur: () => undefined, focus: () => undefined }));
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

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const existingProjectFixture = {
  id: "project-existing",
  anilistId: 1001,
  title: "Projeto Base",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Anime",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Base",
  animationStudios: [],
  episodes: "12",
  tags: ["Action"],
  genres: ["Comedy"],
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
  views: 0,
  commentsCount: 0,
  order: 0,
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
  deletedBy: null,
};

describe("DashboardProjectsEditor taxonomy translations", () => {
  it("mostra sugestoes traduzidas e salva tags e generos no valor canonico", async () => {
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
    grants: { projetos: true },
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
          return mockJsonResponse(true, { projects: [existingProjectFixture] });
        }
        if (path === "/api/project-types" && method === "GET") {
          return mockJsonResponse(true, { types: ["Anime"] });
        }
        if (path === "/api/users" && method === "GET") {
          return mockJsonResponse(true, { users: [] });
        }
        if (path === "/api/public/tag-translations" && method === "GET") {
          return mockJsonResponse(true, {
            tags: {
              action: "A\u00e7\u00e3o",
            },
            genres: {
              comedy: "Com\u00e9dia",
            },
            staffRoles: {},
          });
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

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Informa.*projeto/i }));

    await waitFor(() => {
      expect(dialog.querySelectorAll("input").length).toBeGreaterThan(4);
    });

    const titleInput = dialog.querySelectorAll("input")[2] as HTMLInputElement | undefined;
    const tagInput = dialog.querySelectorAll('input[placeholder="Adicionar tag"]')[0] as
      | HTMLInputElement
      | undefined;
    const genreInput = dialog.querySelectorAll('input[placeholder="Adicionar g\u00eanero"]')[0] as
      | HTMLInputElement
      | undefined;

    expect(titleInput).not.toBeNull();
    expect(tagInput).toBeDefined();
    expect(genreInput).toBeDefined();

    fireEvent.change(titleInput as HTMLInputElement, {
      target: { value: "Projeto Traduzido" },
    });
    fireEvent.change(tagInput as HTMLInputElement, {
      target: { value: "a\u00e7\u00e3" },
    });

    await waitFor(() => {
      expect(
        within(dialog).getAllByRole("button", { name: "A\u00e7\u00e3o" }).length,
      ).toBeGreaterThan(0);
    });
    expect(within(dialog).queryByRole("button", { name: "Action" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getAllByRole("button", { name: "A\u00e7\u00e3o" })[0]);

    await waitFor(() => {
      expect(within(dialog).getAllByText("A\u00e7\u00e3o").length).toBeGreaterThan(0);
    });

    fireEvent.change(tagInput as HTMLInputElement, {
      target: { value: "A\u00e7\u00e3o" },
    });
    fireEvent.keyDown(tagInput as HTMLInputElement, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    fireEvent.change(genreInput as HTMLInputElement, {
      target: { value: "com\u00e9" },
    });

    await waitFor(() => {
      expect(
        within(dialog).getAllByRole("button", { name: "Com\u00e9dia" }).length,
      ).toBeGreaterThan(0);
    });
    expect(within(dialog).queryByRole("button", { name: "Comedy" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Com\u00e9dia" })[0]);

    await waitFor(() => {
      expect(within(dialog).getAllByText("Com\u00e9dia").length).toBeGreaterThan(0);
    });

    fireEvent.change(genreInput as HTMLInputElement, {
      target: { value: "Com\u00e9dia" },
    });
    fireEvent.keyDown(genreInput as HTMLInputElement, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar projeto" }));

    await waitFor(() => {
      expect(savedProject).not.toBeNull();
    });

    expect(savedProject).toEqual(
      expect.objectContaining({
        title: "Projeto Traduzido",
        tags: ["Action"],
        genres: ["Comedy"],
      }),
    );
  });
});
