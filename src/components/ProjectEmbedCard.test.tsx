import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    const { container } = render(
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
    const badgesSection = badgesRow.parentElement;
    const statusBadge = screen.getByTestId("project-embed-status-badge");
    const studioBadge = screen.getByTestId("project-embed-studio-badge");
    const title = screen.getByText("Projeto Embed");
    const synopsis = screen.getByText("Sinopse");
    const row = screen.getByTestId("project-embed-row");
    const synopsisColumn = container.querySelector<HTMLElement>('[data-synopsis-role="column"]');
    const synopsisTitle = container.querySelector<HTMLElement>('[data-synopsis-role="title"]');
    const synopsisText = container.querySelector<HTMLElement>('[data-synopsis-role="synopsis"]');
    const synopsisBadges = container.querySelector<HTMLElement>('[data-synopsis-role="badges"]');

    expect(acao.compareDocumentPosition(comedia) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(comedia.compareDocumentPosition(drama) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(drama.compareDocumentPosition(misterio) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(tagsWrapper).toHaveClass("hidden", "sm:flex");
    expect(episodesBadge).toHaveClass("hidden", "sm:inline-flex");
    expect(badgesRow).toHaveClass("flex-nowrap", "overflow-hidden", "sm:flex-wrap");
    expect(badgesSection).toHaveClass("mt-auto");
    expect(statusBadge).toHaveClass("max-w-[8.5rem]", "truncate");
    expect(studioBadge).toHaveClass("max-w-[8.5rem]", "truncate");
    expect(title).toHaveClass("line-clamp-2");
    expect(title).not.toHaveClass("sm:line-clamp-none");
    expect(row).toHaveClass("group", "flex", "items-stretch", "gap-4");
    expect(synopsis).toHaveClass("mt-2", "break-normal", "[overflow-wrap:normal]", "[word-break:normal]");
    const synopsisLines = Number(synopsis.getAttribute("data-synopsis-lines"));
    expect(Number.isFinite(synopsisLines)).toBe(true);
    expect(synopsisLines).toBeGreaterThanOrEqual(1);
    expect(synopsisLines).toBeLessThanOrEqual(4);
    expect(String(synopsis.getAttribute("style") || "")).toMatch(/display:\s*-webkit-box/i);
    expect(String(synopsis.getAttribute("style") || "")).toMatch(/overflow:\s*hidden/i);
    expect(synopsisColumn).toHaveAttribute("data-synopsis-role", "column");
    expect(synopsisColumn).toHaveAttribute("data-synopsis-key", "project-1");
    expect(synopsisTitle).toHaveAttribute("data-synopsis-role", "title");
    expect(synopsisText).toHaveAttribute("data-synopsis-role", "synopsis");
    expect(synopsisBadges).toHaveAttribute("data-synopsis-role", "badges");
    expect(synopsisBadges).toHaveClass("pt-2");
    expect(synopsisTitle).not.toBeNull();
    expect(synopsisText).not.toBeNull();
    expect(synopsisBadges).not.toBeNull();
    if (!synopsisTitle || !synopsisText || !synopsisBadges) {
      throw new Error("Estrutura de synopsis/title/badges nao encontrada");
    }
    expect(synopsisTitle).not.toContainElement(synopsisText);
    expect(synopsisTitle.compareDocumentPosition(synopsisText) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(synopsisText.compareDocumentPosition(synopsisBadges) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
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

    const row = screen.getByTestId("project-embed-row");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("flex", "items-stretch", "gap-4");
    expect(row).toHaveStyle({ height: "calc(8rem * 65 / 46)" });
    expect(row).not.toHaveClass("items-start");
    expect(row).not.toHaveClass("flex-col");

    const contentColumn = row?.querySelector("div.min-w-0.flex-1");
    expect(contentColumn).not.toBeNull();
    expect(contentColumn).toHaveClass("min-h-0", "min-w-0", "self-stretch", "overflow-hidden");
    expect(contentColumn).toHaveAttribute("data-synopsis-role", "column");
    expect(contentColumn).toHaveAttribute("data-synopsis-key", "project-1");

    const coverImage = screen.getByRole("img", { name: "Projeto Embed" });
    const coverWrapper = coverImage.parentElement;
    expect(coverWrapper).not.toBeNull();
    expect(coverWrapper).toHaveClass("h-full", "w-32", "shrink-0", "self-start");
    expect(coverWrapper).not.toHaveClass("w-full");
    expect(coverWrapper).not.toHaveClass("border", "border-border", "group-hover:border-primary/40");
    expect(String(coverWrapper?.getAttribute("style") || "")).not.toMatch(/aspect-ratio/i);
    expect(String(coverImage.getAttribute("style") || "")).not.toMatch(/aspect-ratio/i);
  });
});
