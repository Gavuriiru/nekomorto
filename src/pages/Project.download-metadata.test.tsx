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

describe("Project downloads metadata", () => {
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

  it("shows episode metadata in the unified meta line and keeps links working", async () => {
    const fullHash =
      "SHA-256: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
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
          synopsis: "Sinopse do episodio",
          releaseDate: "2025-01-01",
          duration: "24 min",
          sourceType: "TV",
          hash: fullHash,
          sizeBytes: 734003200,
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/source-1",
            },
          ],
        },
        {
          number: 2,
          title: "Episodio 2",
          synopsis: "Sem metadados adicionais",
          releaseDate: "2025-01-08",
          duration: "24 min",
          sourceType: "Web",
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/source-2",
            },
          ],
        },
      ],
      staff: [],
      animeStaff: [],
      relations: [],
    };

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: { method?: string }) => {
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
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Projeto Teste" })).toBeInTheDocument();
    expect(screen.queryByText("Source:")).not.toBeInTheDocument();
    expect(screen.queryByText(/\bRAW\b/i)).not.toBeInTheDocument();
    expect(screen.getByText("TV")).toBeInTheDocument();
    expect(screen.getByText("Tamanho:")).toBeInTheDocument();
    expect(screen.getByText("700 MB")).toBeInTheDocument();
    const hashNode = await screen.findByTitle(fullHash);
    expect(hashNode).toBeInTheDocument();
    expect(hashNode.textContent).toMatch(/^SHA-256: 0123456789abcdef0123456789a.*\.\.\.$/);
    expect(hashNode.textContent).not.toBe(fullHash);
    expect(screen.getAllByText(/Tamanho:/i)).toHaveLength(1);
    expect(screen.getAllByText(/Hash:/i)).toHaveLength(1);
    expect(screen.queryByText(/Sem metadados do arquivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Sinopse do episodio")).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Google Drive/i });
    expect(links.some((item) => item.getAttribute("href") === "https://example.com/source-1")).toBe(true);
    expect(links.some((item) => item.getAttribute("href") === "https://example.com/source-2")).toBe(true);
    expect(links.every((item) => item.getAttribute("target") === "_blank")).toBe(true);
    expect(links.every((item) => item.getAttribute("rel") === "noreferrer")).toBe(true);
  });
});
