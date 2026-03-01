import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/pages/Project";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "projeto-teste" }),
  };
});

vi.mock("@/components/CommentsSection", () => ({
  default: () => <div data-testid="comments-section" />,
}));

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const findAncestor = (
  element: HTMLElement,
  predicate: (candidate: HTMLElement) => boolean,
): HTMLElement | null => {
  let current = element.parentElement;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

describe("Project mobile download card layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useSiteSettingsMock.mockReset();

    useSiteSettingsMock.mockReturnValue({
      settings: {
        site: { defaultShareImage: "" },
        downloads: {
          sources: [
            {
              id: "drive",
              label: "Google Drive",
              color: "#34A853",
              icon: "google-drive",
              tintIcon: true,
            },
          ],
        },
      },
    });
  });

  it("keeps the source badge inside the content column and compacts source chips on mobile", async () => {
    const project = {
      id: "projeto-teste",
      title: "Projeto Teste",
      synopsis: "Sinopse",
      description: "Descricao",
      type: "Anime",
      status: "Em andamento",
      year: "2025",
      studio: "Studio Teste",
      episodes: "12 episodios",
      tags: [],
      genres: [],
      cover: "/placeholder.svg",
      banner: "/placeholder.svg",
      season: "Temporada 1",
      schedule: "Sabado",
      rating: "14",
      episodeDownloads: [
        {
          number: 1,
          title: "Episodio 1",
          releaseDate: "2025-01-01",
          duration: "24 min",
          sourceType: "TV",
          sizeBytes: 734003200,
          hash: "ABC123",
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/source-1",
            },
          ],
        },
      ],
      staff: [],
      animeStaff: [],
      relations: [],
    };

    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: { method?: string }) => {
        if (endpoint === "/api/public/projects/projeto-teste") {
          return { ok: true, json: async () => ({ project }) };
        }
        if (endpoint === "/api/public/projects") {
          return { ok: true, json: async () => ({ projects: [project] }) };
        }
        if (endpoint === "/api/public/tag-translations") {
          return { ok: true, json: async () => ({ tags: {}, genres: {}, staffRoles: {} }) };
        }
        if (endpoint === `/api/public/projects/${project.id}/view` && options?.method === "POST") {
          return { ok: true, json: async () => ({ ok: true }) };
        }
        return { ok: false, json: async () => ({}) };
      },
    );

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Projeto Teste" })).toBeInTheDocument();

    const sourceTypeBadge = screen.getByText("TV");
    expect(sourceTypeBadge).toBeInTheDocument();
    expect(classTokens(sourceTypeBadge)).toContain("md:absolute");
    expect(classTokens(sourceTypeBadge)).not.toContain("absolute");

    const contentColumn = findAncestor(sourceTypeBadge, (candidate) =>
      classTokens(candidate).includes("md:min-h-[153px]"),
    );
    expect(contentColumn).not.toBeNull();
    expect(classTokens(contentColumn as HTMLElement)).toContain("md:min-h-[153px]");
    expect(classTokens(contentColumn as HTMLElement)).not.toContain("min-h-[153px]");
    expect(contentColumn).toContain(sourceTypeBadge);

    const previewImage = screen.getByRole("img", { name: "Prévia de Episodio 1" });
    const imageShell = findAncestor(
      previewImage,
      (candidate) =>
        classTokens(candidate).includes("shadow-inner") &&
        classTokens(candidate).includes("rounded-xl"),
    );
    expect(imageShell).not.toBeNull();
    expect(imageShell).not.toContain(sourceTypeBadge);
    expect(sourceTypeBadge.parentElement).not.toBe(imageShell?.parentElement);

    const metaShell = findAncestor(sourceTypeBadge, (candidate) =>
      classTokens(candidate).includes("space-y-2.5"),
    );
    expect(metaShell).not.toBeNull();
    expect(classTokens(metaShell as HTMLElement)).toContain("md:pb-[52px]");
    expect(classTokens(metaShell as HTMLElement)).not.toContain("pb-12");

    const sourceLink = screen.getByRole("link", { name: /Google Drive/i });
    const actionsRow = findAncestor(sourceLink, (candidate) =>
      classTokens(candidate).includes("justify-end") && classTokens(candidate).includes("flex-wrap"),
    );
    expect(actionsRow).not.toBeNull();
    expect(classTokens(actionsRow as HTMLElement)).toContain("mt-2");
    expect(classTokens(actionsRow as HTMLElement)).toContain("justify-end");
    expect(classTokens(actionsRow as HTMLElement)).toContain("md:justify-end");
    expect(classTokens(actionsRow as HTMLElement)).toContain("flex-wrap");
    expect(classTokens(actionsRow as HTMLElement)).toContain("md:absolute");
    expect(classTokens(actionsRow as HTMLElement)).toContain("md:mt-0");

    expect(sourceLink).toHaveAttribute("aria-label", "Google Drive");
    expect(classTokens(sourceLink)).toContain("w-9");
    expect(classTokens(sourceLink)).toContain("px-0");
    expect(classTokens(sourceLink)).toContain("md:w-auto");
    expect(classTokens(sourceLink)).toContain("md:px-4");
    expect(classTokens(sourceLink)).toContain("justify-center");
    expect(classTokens(sourceLink)).toContain("gap-0");
    expect(classTokens(sourceLink)).toContain("md:gap-2");

    const sourceLabel = sourceLink.querySelector("span");
    expect(sourceLabel).not.toBeNull();
    expect(sourceLabel?.textContent).toBe("Google Drive");
    expect(classTokens(sourceLabel as HTMLElement)).toContain("sr-only");
    expect(classTokens(sourceLabel as HTMLElement)).toContain("md:not-sr-only");
  });
});
