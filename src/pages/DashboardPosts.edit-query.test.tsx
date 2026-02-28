import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

const postFixture = {
  id: "post-1",
  title: "Post de teste",
  slug: "post-1",
  excerpt: "Resumo",
  content: "",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  status: "draft" as const,
  projectId: "",
  tags: [],
  views: 10,
  commentsCount: 2,
};

const buildVersionSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: postFixture.id,
  slug: postFixture.slug,
  title: postFixture.title,
  status: postFixture.status,
  publishedAt: postFixture.publishedAt,
  scheduledAt: null,
  projectId: postFixture.projectId,
  excerpt: postFixture.excerpt,
  content: postFixture.content,
  contentFormat: postFixture.contentFormat,
  author: postFixture.author,
  coverImageUrl: null,
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  tags: [],
  updatedAt: postFixture.publishedAt,
  ...overrides,
});

const buildVersion = (id: string, snapshotOverrides: Record<string, unknown> = {}) => ({
  id,
  postId: postFixture.id,
  versionNumber: Number(id.replace(/\D/g, "")) || 1,
  reason: "update",
  reasonLabel: "Atualizacao",
  slug: String(snapshotOverrides.slug || postFixture.slug),
  createdAt: "2026-02-10T12:00:00.000Z",
  snapshot: buildVersionSnapshot(snapshotOverrides),
});

const setupApiMock = ({
  canManagePosts,
  versionsResponse,
}: {
  canManagePosts: boolean;
  versionsResponse?: { versions?: unknown[]; nextCursor?: string | null } | "error";
}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts: [postFixture] });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [{ id: "user-1", permissions: canManagePosts ? ["posts"] : [] }],
        ownerIds: [],
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    if (path.startsWith("/api/admin/content/post/") && path.includes("/versions") && method === "GET") {
      if (versionsResponse === "error") {
        return mockJsonResponse(false, { error: "versions_failed" }, 500);
      }
      return mockJsonResponse(true, {
        postId: "post-1",
        versions: versionsResponse?.versions || [],
        nextCursor: versionsResponse?.nextCursor || null,
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

describe("DashboardPosts edit query", () => {
  it("abre criacao automaticamente com ?edit=new e limpa a query", async () => {
    setupApiMock({ canManagePosts: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=new"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Nova postagem");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("abre editor automaticamente com ?edit e limpa a query", async () => {
    setupApiMock({ canManagePosts: true });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(document.documentElement).toHaveClass("editor-scroll-stable");
    expect(document.body).toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBe("1");
    expect(document.documentElement).toHaveClass("editor-scroll-locked");
    expect(document.body).toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBe("1");

    unmount();

    expect(document.documentElement).not.toHaveClass("editor-scroll-stable");
    expect(document.body).not.toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBeNull();
    expect(document.documentElement).not.toHaveClass("editor-scroll-locked");
    expect(document.body).not.toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBeNull();
  });

  it("nao abre editor sem permissao e limpa a query", async () => {
    setupApiMock({ canManagePosts: false });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(screen.queryByText("Editar postagem")).not.toBeInTheDocument();
  });

  it("oculta botao de historico quando a unica versao equivale ao estado atual", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v1")],
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some((call) => String(call[1] || "").includes("/api/admin/content/post/post-1/versions")),
      ).toBe(true);
    });

    expect(screen.queryByRole("button", { name: /Hist/i })).not.toBeInTheDocument();
  });

  it("mostra botao de historico quando existe uma versao restauravel mesmo sendo unica", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v2", { title: "Titulo antigo" })],
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hist/i })).toBeInTheDocument();
    });
  });

  it("mostra botao de historico quando ha nextCursor mesmo sem diferenca nas primeiras versoes", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v1"), buildVersion("v2")],
        nextCursor: "cursor-1",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hist/i })).toBeInTheDocument();
    });
  });
});
