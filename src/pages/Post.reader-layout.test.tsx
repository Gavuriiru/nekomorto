import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Post from "@/pages/Post";

const apiFetchMock = vi.hoisted(() => vi.fn());

const classTokens = (element: HTMLElement) =>
  new Set(
    String(element.getAttribute("class") || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: { defaultShareImage: "" },
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "post-teste" }),
  };
});

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => null,
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => null,
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalViewer", () => ({
  default: () => <div data-testid="lexical-viewer" />,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const postFixture = {
  id: "post-1",
  title: "Post de Teste",
  slug: "post-teste",
  coverImageUrl: "/uploads/capa-post.jpg",
  coverAlt: "Capa de teste",
  excerpt: "Resumo",
  content: "<p>Conteudo</p>",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  views: 10,
  commentsCount: 2,
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
      return mockJsonResponse(true, { post: postFixture });
    }
    if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
      return mockJsonResponse(true, { views: 11 });
    }
    if (endpoint === "/api/public/me" && method === "GET") {
      return mockJsonResponse(true, { user: null });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Post reader layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("mantem estrutura editorial do hero e sidebar sticky sem bloco glass no texto", async () => {
    setupApiMock();

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });

    const hero = screen.getByTestId("post-reader-hero");
    const heroLayout = screen.getByTestId("post-reader-hero-layout");
    const heroInfo = screen.getByTestId("post-reader-hero-info");
    const coverBridge = screen.getByTestId("post-reader-cover-bridge");
    const coverShell = screen.getByTestId("post-reader-cover-shell");
    const coverFrame = screen.getByTestId("post-reader-cover-frame");
    const readerLayout = screen.getByTestId("post-reader-layout");
    const readerMain = screen.getByTestId("post-reader-main");
    const readerSidebar = screen.getByTestId("post-reader-sidebar");

    expect(hero).toBeInTheDocument();
    expect(heroLayout).toBeInTheDocument();
    expect(heroInfo).toBeInTheDocument();
    expect(coverBridge).toBeInTheDocument();
    expect(coverShell).toBeInTheDocument();
    expect(coverFrame).toBeInTheDocument();
    expect(readerLayout).toBeInTheDocument();
    expect(readerMain).toBeInTheDocument();
    expect(readerSidebar).toBeInTheDocument();

    const heroLayoutClasses = classTokens(heroLayout);
    expect(heroLayoutClasses).toContain("grid");
    expect(heroLayoutClasses).toContain("gap-8");
    expect(within(heroLayout).queryByTestId("post-reader-cover-shell")).not.toBeInTheDocument();

    const heroInnerContainer = heroLayout.parentElement as HTMLElement | null;
    expect(heroInnerContainer).not.toBeNull();
    const heroInnerTokens = classTokens(heroInnerContainer as HTMLElement);
    expect(heroInnerTokens).toContain("pt-24");
    expect(heroInnerTokens).toContain("pb-10");
    expect(heroInnerTokens).toContain("md:pt-20");
    expect(heroInnerTokens).toContain("lg:pt-24");
    expect(heroInnerTokens).toContain("lg:pb-36");

    const coverBridgeClasses = classTokens(coverBridge);
    expect(coverBridgeClasses).toContain("hidden");
    expect(coverBridgeClasses).toContain("md:block");
    expect(coverBridgeClasses).toContain("-mt-24");
    expect(coverBridgeClasses).toContain("md:-mt-28");

    const coverShellClasses = classTokens(coverShell);
    expect(coverShellClasses).toContain("w-full");
    expect(coverShellClasses).not.toContain("max-w-[560px]");
    expect(coverShellClasses).not.toContain("lg:max-w-[640px]");

    const coverFrameClasses = classTokens(coverFrame);
    expect(coverFrameClasses).toContain("aspect-3/2");
    expect(coverFrameClasses).toContain("border-border/80");
    expect(coverFrameClasses).toContain("shadow-[0_42px_120px_-48px_rgba(0,0,0,0.95)]");

    const sidebarClasses = classTokens(readerSidebar);
    expect(sidebarClasses).toContain("lg:sticky");
    expect(sidebarClasses).toContain("lg:top-24");
    expect(sidebarClasses).toContain("self-start");

    const infoClasses = classTokens(heroInfo);
    expect(infoClasses).not.toContain("bg-card/45");
    expect(infoClasses).not.toContain("backdrop-blur-md");
    expect(within(hero).queryByText("Resumo")).not.toBeInTheDocument();
    const heroClasses = classTokens(hero);
    expect(heroClasses).not.toContain("border-b");

    const readerLayoutWrapper = readerLayout.parentElement as HTMLElement | null;
    expect(readerLayoutWrapper).not.toBeNull();
    const readerLayoutWrapperClasses = classTokens(readerLayoutWrapper as HTMLElement);
    expect(readerLayoutWrapperClasses).toContain("pt-4");
    expect(readerLayoutWrapperClasses).toContain("md:pt-10");

    const main = document.querySelector("main");
    expect(main).not.toBeNull();
    const mainClasses = classTokens(main as HTMLElement);
    expect(mainClasses).not.toContain("pt-20");
    expect(mainClasses).not.toContain("px-6");
    expect(mainClasses).not.toContain("md:px-12");
  });
});
