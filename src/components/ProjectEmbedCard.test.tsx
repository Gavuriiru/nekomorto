import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("ProjectEmbedCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("ordena tags por traducao exibida e faz fallback para tag original", async () => {
    const project = {
      id: "project-1",
      title: "Projeto Embed",
      synopsis: "Sinopse",
      description: "Descricao",
      type: "Anime",
      status: "Em andamento",
      year: "2025",
      studio: "Studio Teste",
      episodes: "12",
      tags: ["Mystery", "Drama", "Action", "Comedy"],
      genres: [],
      cover: "/placeholder.svg",
      banner: "/placeholder.svg",
      season: "",
      schedule: "",
      rating: "",
      episodeDownloads: [],
      staff: [],
    };

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/public/projects/project-1") {
        return { ok: true, json: async () => ({ project }) };
      }
      if (endpoint === "/api/public/tag-translations") {
        return {
          ok: true,
          json: async () => ({
            tags: {
              ACTION: "Acao",
              comedy: "Comedia",
              mYsTeRy: "Misterio",
              drama: "",
            },
            genres: {},
            staffRoles: {},
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    render(
      <MemoryRouter>
        <ProjectEmbedCard projectId="project-1" />
      </MemoryRouter>,
    );

    const acao = await screen.findByText("Acao");
    const comedia = screen.getByText("Comedia");
    const drama = screen.getByText("Drama");
    const misterio = screen.getByText("Misterio");
    const tagsWrapper = screen.getByTestId("project-embed-tags");
    const episodesBadge = screen.getByTestId("project-embed-episodes-badge");
    const badgesRow = screen.getByTestId("project-embed-primary-badges");
    const statusBadge = screen.getByTestId("project-embed-status-badge");
    const studioBadge = screen.getByTestId("project-embed-studio-badge");
    const title = screen.getByText("Projeto Embed");

    expect(acao.compareDocumentPosition(comedia) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(comedia.compareDocumentPosition(drama) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(drama.compareDocumentPosition(misterio) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(tagsWrapper).toHaveClass("hidden", "sm:flex");
    expect(episodesBadge).toHaveClass("hidden", "sm:inline-flex");
    expect(badgesRow).toHaveClass("flex-nowrap", "overflow-hidden", "sm:flex-wrap");
    expect(statusBadge).toHaveClass("max-w-[8.5rem]", "truncate");
    expect(studioBadge).toHaveClass("max-w-[8.5rem]", "truncate");
    expect(title).toHaveClass("line-clamp-3", "sm:line-clamp-none");
  });

  it("mantem thumbnail lateral fixa no mobile sem ocupar largura total", async () => {
    const project = {
      id: "project-1",
      title: "Projeto Embed",
      synopsis: "Sinopse",
      description: "Descricao",
      type: "Anime",
      status: "Em andamento",
      year: "2025",
      studio: "Studio Teste",
      episodes: "12",
      tags: ["Drama"],
      genres: [],
      cover: "/placeholder.svg",
      banner: "/placeholder.svg",
      season: "",
      schedule: "",
      rating: "",
      episodeDownloads: [],
      staff: [],
    };

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/public/projects/project-1") {
        return { ok: true, json: async () => ({ project }) };
      }
      if (endpoint === "/api/public/tag-translations") {
        return { ok: true, json: async () => ({ tags: {}, genres: {}, staffRoles: {} }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { container } = render(
      <MemoryRouter>
        <ProjectEmbedCard projectId="project-1" />
      </MemoryRouter>,
    );

    await screen.findByText("Projeto Embed");

    const row = container.querySelector("div.group");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("flex", "items-start", "gap-4");
    expect(row).not.toHaveClass("flex-col");

    const contentColumn = row?.querySelector("div.min-w-0.flex-1");
    expect(contentColumn).not.toBeNull();
    expect(contentColumn).toHaveClass("min-w-0");

    const coverImage = screen.getByRole("img", { name: "Projeto Embed" });
    const coverWrapper = coverImage.parentElement;
    expect(coverWrapper).not.toBeNull();
    expect(coverWrapper).toHaveClass("w-32", "shrink-0");
    expect(coverWrapper).not.toHaveClass("w-full");
  });
});
