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

    expect(acao.compareDocumentPosition(comedia) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(comedia.compareDocumentPosition(drama) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(drama.compareDocumentPosition(misterio) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});
