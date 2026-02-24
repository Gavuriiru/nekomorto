import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPosts from "@/pages/DashboardPosts";

const apiFetchMock = vi.hoisted(() => vi.fn());

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
  default: () => null,
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef((_props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
    React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
    return <div data-testid="lexical-editor" />;
  });
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

describe("DashboardPosts tags translation", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, {
          posts: [
            {
              id: "post-1",
              title: "Post de Teste",
              slug: "post-de-teste",
              excerpt: "Resumo",
              content: "",
              coverImageUrl: "/uploads/posts/capa-vertical-9x16.jpg",
              author: "Admin",
              publishedAt: "2026-02-10T12:00:00.000Z",
              status: "published",
              projectId: "project-1",
              tags: ["Action", "Mystery", "Comedy"],
              views: 10,
              commentsCount: 2,
            },
          ],
        });
      }
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, {
          projects: [
            {
              id: "project-1",
              title: "Projeto Relacionado",
              synopsis: "Sinopse",
              description: "Descricao",
              type: "Anime",
              status: "Em andamento",
              year: "2026",
              studio: "Studio",
              episodes: "12",
              tags: ["Adventure"],
              genres: [],
              cover: "/placeholder.svg",
              banner: "/placeholder.svg",
              season: "",
              schedule: "",
              rating: "",
              episodeDownloads: [],
              staff: [],
            },
          ],
        });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, {
          tags: {
            action: "ZZZ",
            MYSTERY: "AAA",
            comedy: "BBB",
            AdVeNtUrE: "MMM",
          },
          genres: {},
          staffRoles: {},
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("aplica traducoes nas chips, mantem ordem manual e remove por valor original", async () => {
    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    const card = await screen.findByTestId("post-card-post-1");
    const coverImage = within(card).getByRole("img", { name: "Post de Teste" });
    expect(coverImage).toHaveClass("absolute", "inset-0", "block", "h-full", "w-full", "object-cover", "object-center");
    const coverContainer = coverImage.parentElement;
    expect(coverContainer).not.toBeNull();
    expect(coverContainer).toHaveClass("relative", "h-52", "w-full", "overflow-hidden", "lg:h-full");
    const cardLayoutContainer = Array.from(card.querySelectorAll("div")).find((element) =>
      element.className.includes("lg:h-[280px]"),
    );
    expect(cardLayoutContainer).toBeDefined();
    const rightContentColumn = Array.from(card.querySelectorAll("div")).find((element) =>
      element.className.includes("grid-rows-[auto_auto_minmax(0,1fr)_auto]"),
    );
    expect(rightContentColumn).toBeDefined();
    expect(rightContentColumn?.className).toContain("lg:pb-5");
    expect(within(card).getByText("Publicado")).toBeInTheDocument();
    expect(within(card).queryByText("published")).not.toBeInTheDocument();
    expect(within(card).getByText("AAA")).toBeInTheDocument();
    expect(within(card).getByText("BBB")).toBeInTheDocument();
    expect(within(card).getByText("MMM")).toBeInTheDocument();
    expect(within(card).getByText("+1")).toBeInTheDocument();
    expect(within(card).getByText("Admin")).toBeInTheDocument();
    expect(within(card).getByText("10 visualizações")).toBeInTheDocument();
    expect(within(card).getByText("2 comentários")).toBeInTheDocument();
    expect(card.querySelector('[data-slot="top"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="headline"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="excerpt"]')).not.toBeNull();
    expect(card.querySelector('[data-slot="tags"]')).not.toBeNull();
    const metaSlot = card.querySelector('[data-slot="meta"]') as HTMLDivElement | null;
    expect(metaSlot).not.toBeNull();
    const metaTokens = String(metaSlot?.className || "")
      .split(/\s+/)
      .filter(Boolean);
    expect(metaTokens).toContain("flex-wrap");
    expect(metaTokens).toContain("lg:flex-nowrap");
    expect(metaTokens).not.toContain("flex-nowrap");
    const slugElement = within(card).getByText("/post-de-teste");
    const slugTokens = String(slugElement.className)
      .split(/\s+/)
      .filter(Boolean);
    expect(slugTokens).toContain("hidden");
    expect(slugTokens).toContain("lg:block");
    const translatedTag = within(card).getByText("AAA");
    expect(`${translatedTag.className} ${translatedTag.parentElement?.className || ""}`).toContain("bg-secondary");
    expect(translatedTag.className).toContain("truncate");
    const translatedTagBadge = translatedTag.parentElement as HTMLDivElement | null;
    expect(translatedTagBadge).not.toBeNull();
    expect(translatedTagBadge?.className).toContain("max-w-34");
    expect(translatedTagBadge?.className).toContain("overflow-hidden");
    const extraTag = within(card).getByText("+1");
    expect(`${extraTag.className} ${extraTag.parentElement?.className || ""}`).toContain("bg-secondary");

    fireEvent.click(await screen.findByText("Post de Teste"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Editar postagem")).toBeInTheDocument();

    const getChipLabels = () =>
      Array.from(dialog.querySelectorAll('button[draggable="true"]')).map((button) =>
        String(button.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/[^a-z0-9]+$/i, ""),
      );

    expect(getChipLabels()).toEqual(["ZZZ", "AAA", "BBB", "MMM"]);

    const optionValues = Array.from(dialog.querySelectorAll("#post-tag-options option")).map((option) =>
      option.getAttribute("value"),
    );
    expect(optionValues).toEqual(["Mystery", "Comedy", "Adventure", "Action"]);

    const mysteryButton = Array.from(dialog.querySelectorAll('button[draggable="true"]')).find((button) =>
      button.textContent?.includes("AAA"),
    );
    expect(mysteryButton).not.toBeUndefined();
    fireEvent.click(mysteryButton as HTMLButtonElement);

    expect(within(dialog).queryByText("AAA")).not.toBeInTheDocument();
    expect(getChipLabels()).toEqual(["ZZZ", "BBB", "MMM"]);
  });

  it("mantem rodape fixo com resumo longo sem tags e aplica fallback de clamp", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, {
          posts: [
            {
              id: "post-long",
              title: "Post com resumo longo",
              slug: "post-longo-sem-tags",
              excerpt:
                "Resumo muito longo para validar clamp e fixacao do rodape. ".repeat(14).trim(),
              content: "",
              coverImageUrl: "/uploads/posts/capa-longa.jpg",
              author: "Admin",
              publishedAt: "2026-02-10T12:00:00.000Z",
              status: "published",
              projectId: "",
              tags: [],
              views: 99,
              commentsCount: 7,
            },
          ],
        });
      }
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    const card = await screen.findByTestId("post-card-post-long");

    expect(within(card).getByText("99 visualizações")).toBeInTheDocument();
    expect(within(card).getByText("7 comentários")).toBeInTheDocument();
    expect(within(card).getByText("/post-longo-sem-tags")).toBeInTheDocument();

    const tagsSlot = card.querySelector('[data-slot="tags"]');
    expect(tagsSlot).not.toBeNull();
    expect(tagsSlot?.querySelector("span.invisible")).not.toBeNull();

    const excerptSlot = card.querySelector('[data-slot="excerpt"]') as HTMLParagraphElement | null;
    expect(excerptSlot).not.toBeNull();
    const excerptTokens = String(excerptSlot?.className || "")
      .split(/\s+/)
      .filter(Boolean);
    expect(excerptTokens).toContain("line-clamp-2");
    expect(excerptTokens).toContain("lg:line-clamp-1");
    expect(excerptTokens).toContain("[display:-webkit-box]");
    expect(excerptTokens).toContain("[-webkit-box-orient:vertical]");
    expect(excerptTokens).toContain("[-webkit-line-clamp:2]");
    expect(excerptTokens).toContain("lg:[-webkit-line-clamp:1]");

    const rightContentColumn = Array.from(card.querySelectorAll("div")).find((element) =>
      element.className.includes("grid-rows-[auto_auto_minmax(0,1fr)_auto]"),
    );
    expect(rightContentColumn).toBeDefined();
    expect(rightContentColumn?.className).toContain("overflow-hidden");

    const metaSlot = card.querySelector('[data-slot="meta"]') as HTMLDivElement | null;
    expect(metaSlot).not.toBeNull();
    const footerWrapperTokens = String(metaSlot?.parentElement?.className || "")
      .split(/\s+/)
      .filter(Boolean);
    expect(footerWrapperTokens).toContain("shrink-0");
  });
});

