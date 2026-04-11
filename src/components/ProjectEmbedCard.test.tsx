import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectEmbedCard from "@/components/ProjectEmbedCard";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useDynamicSynopsisClampMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-dynamic-synopsis-clamp", () => ({
  useDynamicSynopsisClamp: (...args: unknown[]) => useDynamicSynopsisClampMock(...args),
}));

const buildProject = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const renderProjectEmbedCard = () =>
  render(
    <MemoryRouter>
      <ProjectEmbedCard projectId="project-1" />
    </MemoryRouter>,
  );

describe("ProjectEmbedCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useDynamicSynopsisClampMock.mockReset();
    useDynamicSynopsisClampMock.mockReturnValue({
      rootRef: { current: null },
      lineByKey: {},
    });
  });

  it("ordena tags por traducao exibida, mantem badges no rodape e usa clamp padrao de duas linhas", async () => {
    const project = buildProject();

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

    const { container } = renderProjectEmbedCard();

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
    const cardLink = title.closest("a");
    const cardRoot = cardLink?.firstElementChild as HTMLElement | null;
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
    expect(cardRoot).not.toBeNull();
    expect(cardLink).toHaveClass(
      "project-embed-card",
      "group",
      "block",
      "overflow-hidden",
      "rounded-2xl",
      "border",
      "border-border/60",
      "bg-card",
      "hover:border-primary/60",
      "focus-visible:border-primary/60",
    );
    expect(cardLink).not.toHaveClass(
      "interactive-lift-md",
      "interactive-surface-transition",
      "interactive-media-transition",
    );
    expect(cardRoot).toHaveClass("overflow-hidden", "bg-transparent", "shadow-none");
    expect(cardRoot).not.toHaveClass("border", "border-border");
    expect(cardRoot).not.toHaveClass(
      "group-hover:border-primary/60",
      "group-focus-visible:border-primary/60",
      "group-hover:bg-card/90",
      "group-focus-visible:bg-card/90",
    );
    expect(title).toHaveClass("clamp-safe-2");
    expect(title).not.toHaveClass("sm:line-clamp-none");
    expect(row).toHaveClass("group", "flex", "items-stretch");
    expect(row).not.toHaveClass("gap-4");
    expect(synopsis).toHaveClass(
      "mt-2",
      "clamp-safe-2",
      "break-normal",
      "[overflow-wrap:normal]",
      "[word-break:normal]",
    );
    expect(synopsis).toHaveAttribute("data-synopsis-lines", "2");
    expect(synopsisColumn).toHaveAttribute("data-synopsis-role", "column");
    expect(synopsisColumn).toHaveAttribute("data-synopsis-key", "project-1");
    expect(synopsisColumn).toHaveClass("p-4", "self-stretch");
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
    expect(
      synopsisTitle.compareDocumentPosition(synopsisText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      synopsisText.compareDocumentPosition(synopsisBadges) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("renderiza a capa lateral edge-to-edge com proporcao 9:14 e largura fixa", async () => {
    const project = buildProject({
      tags: ["Drama"],
    });

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/public/projects/project-1") {
        return { ok: true, json: async () => ({ project }) };
      }
      if (endpoint === "/api/public/tag-translations") {
        return {
          ok: true,
          json: async () => ({ tags: {}, genres: {}, staffRoles: {} }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { container } = renderProjectEmbedCard();

    await screen.findByText("Projeto Embed");

    const row = screen.getByTestId("project-embed-row");
    expect(row).toHaveClass("flex", "items-stretch");
    expect(row).not.toHaveClass("items-start", "flex-col", "gap-4");
    expect(row).toHaveStyle({ height: "192px" });

    const contentColumn = container.querySelector<HTMLElement>('[data-synopsis-role="column"]');
    expect(contentColumn).not.toBeNull();
    expect(contentColumn).toHaveClass(
      "min-h-0",
      "min-w-0",
      "flex-1",
      "self-stretch",
      "overflow-hidden",
      "p-4",
    );

    const coverImage = screen.getByRole("img", { name: "Projeto Embed" });
    const coverPicture = coverImage.parentElement as HTMLElement | null;
    const coverWrapper = coverPicture?.parentElement as HTMLElement | null;
    const cardRoot = row.closest("div.rounded-lg") as HTMLElement | null;

    expect(coverPicture).not.toBeNull();
    expect(coverPicture).toHaveClass("block", "h-full", "w-full");
    expect(coverWrapper).not.toBeNull();
    expect(coverWrapper).toHaveClass("h-full", "shrink-0", "self-start", "bg-secondary/60");
    expect(coverWrapper).not.toHaveClass("rounded-xl", "w-full");
    expect(coverWrapper?.style.aspectRatio).toBe("9 / 14");
    expect(coverWrapper?.style.width).toMatch(/^calc\(/);
    expect(coverWrapper?.style.width).not.toBe("100%");
    expect(row.firstElementChild).toBe(coverWrapper);
    expect(cardRoot).not.toBeNull();
    expect(cardRoot).toHaveClass("overflow-hidden");
    expect(coverImage).toHaveAttribute("sizes", "124px");
    expect(coverImage).toHaveClass(
      "project-embed-card__media",
      "h-full",
      "w-full",
      "object-cover",
      "object-center",
    );
    expect(coverImage).not.toHaveClass(
      "interactive-media-transition",
      "group-hover:scale-105",
      "group-focus-visible:scale-105",
    );
  });

  it("mapeia o clamp dinamico para classes explicitas e oculta a sinopse com zero linhas", async () => {
    const project = buildProject({
      tags: ["Drama"],
    });
    let currentLineByKey: Record<string, number> = {
      "project-1": 0,
    };

    useDynamicSynopsisClampMock.mockImplementation(() => ({
      rootRef: { current: null },
      lineByKey: currentLineByKey,
    }));

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/public/projects/project-1") {
        return { ok: true, json: async () => ({ project }) };
      }
      if (endpoint === "/api/public/tag-translations") {
        return {
          ok: true,
          json: async () => ({ tags: {}, genres: {}, staffRoles: {} }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { rerender } = renderProjectEmbedCard();

    const synopsis = await screen.findByText("Sinopse");
    expect(synopsis).toHaveClass("hidden");
    expect(synopsis).toHaveAttribute("data-synopsis-lines", "0");

    currentLineByKey = { "project-1": 1 };
    rerender(
      <MemoryRouter>
        <ProjectEmbedCard projectId="project-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sinopse")).toHaveClass("clamp-safe-1");

    currentLineByKey = { "project-1": 3 };
    rerender(
      <MemoryRouter>
        <ProjectEmbedCard projectId="project-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sinopse")).toHaveClass("clamp-safe-3");

    currentLineByKey = { "project-1": 4 };
    rerender(
      <MemoryRouter>
        <ProjectEmbedCard projectId="project-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sinopse")).toHaveClass("clamp-safe-4");
    expect(screen.getByText("Sinopse")).toHaveAttribute("data-synopsis-lines", "4");
  });

  it("renderiza posterThumb com fallback semantico para poster quando a API entrega apenas poster", async () => {
    const project = buildProject({
      tags: ["Drama"],
      cover: "/uploads/projects/embed-cover.png",
    });

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/public/projects/project-1") {
        return {
          ok: true,
          json: async () => ({
            project,
            mediaVariants: {
              "/uploads/projects/embed-cover.png": {
                variantsVersion: 2,
                variants: {
                  poster: {
                    formats: {
                      avif: { url: "/uploads/_variants/p1/poster-v2.avif" },
                      webp: { url: "/uploads/_variants/p1/poster-v2.webp" },
                      fallback: {
                        url: "/uploads/_variants/p1/poster-v2.jpeg",
                      },
                    },
                  },
                },
              },
            },
          }),
        };
      }
      if (endpoint === "/api/public/tag-translations") {
        return {
          ok: true,
          json: async () => ({ tags: {}, genres: {}, staffRoles: {} }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { container } = renderProjectEmbedCard();

    const coverImage = await screen.findByRole("img", {
      name: "Projeto Embed",
    });
    const sources = Array.from(container.querySelectorAll("source"));

    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/poster-v2.avif"));
    expect(sources[1]).toHaveAttribute("srcset", expect.stringContaining("/poster-v2.webp"));
    expect(coverImage).toHaveAttribute("src", expect.stringContaining("/poster-v2.jpeg"));
    expect(coverImage).toHaveAttribute("sizes", "124px");
  });
});
