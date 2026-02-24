import { useEffect, useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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

const createPost = (index: number) => ({
  id: `post-${index}`,
  title: `Post ${index}`,
  slug: `post-${index}`,
  excerpt: `Resumo ${index}`,
  content: "",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  status: "draft" as const,
  projectId: "",
  tags: [],
  views: 10 - (index % 3),
  commentsCount: index % 5,
});

const setupApiMock = ({
  preferences = { uiListState: {} },
}: {
  preferences?: unknown;
} = {}) => {
  let posts = Array.from({ length: 21 }, (_, index) => createPost(index + 1));
  let persistedPreferences = preferences;
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts });
    }
    if (path === "/api/posts/post-1" && method === "PUT") {
      const body = JSON.parse(String(options?.body || "{}"));
      posts = posts.map((post) => (post.id === "post-1" ? { ...post, ...body } : post));
      const post = posts.find((item) => item.id === "post-1");
      return mockJsonResponse(true, { post });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [{ id: "user-1", permissions: ["posts"] }],
        ownerIds: ["user-1"],
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
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences: persistedPreferences });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { preferences?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      persistedPreferences = payload.preferences || {};
      return mockJsonResponse(true, { preferences: persistedPreferences });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getPreferencePutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/me/preferences" && method === "PUT";
  });

const LocationProbe = () => {
  const location = useLocation();
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    setHistory((prev) => [...prev, location.search]);
  }, [location.search]);
  return (
    <>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="location-history">{history.join("|")}</div>
    </>
  );
};

const NavigateCleanQuery = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard/posts")}>
      Limpar query
    </button>
  );
};

describe("DashboardPosts query sync", () => {
  it("avanca para pagina 2 ao clicar em proxima", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    const pagination = screen.getByRole("navigation");
    fireEvent.click(within(pagination).getByRole("link", { name: /pr/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });
  });

  it("fecha editor ao salvar e mantem page estavel na URL", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?page=2&edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    const dialog = await screen.findByRole("dialog");

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });

    await waitFor(() => {
      const historyText = String(screen.getByTestId("location-history").textContent || "");
      const entries = historyText.split("|").filter(Boolean);
      expect(entries).toContain("?page=2&edit=post-1");
      expect(entries).toContain("?page=2");
      expect(entries.every((entry) => entry === "?page=2&edit=post-1" || entry === "?page=2")).toBe(true);
    });
  });

  it("nao reintroduz query e limpa estado salvo ao navegar para URL limpa", async () => {
    setupApiMock({
      preferences: {
        uiListState: {
          "dashboard.posts": {
            sort: "alpha",
            page: 2,
            filters: {
              q: "post",
            },
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?page=2"]}>
        <DashboardPosts />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.getByTestId("location-search").textContent).toBe("");

    await waitFor(
      () => {
        const putCalls = getPreferencePutCalls();
        expect(putCalls.length).toBeGreaterThan(0);
        const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
          json?: { preferences?: unknown };
        });
        const payload = request.json || JSON.parse(String(request.body || "{}"));
        expect(payload.preferences?.uiListState?.["dashboard.posts"]).toBeUndefined();
      },
      { timeout: 2500 },
    );
  });
});
