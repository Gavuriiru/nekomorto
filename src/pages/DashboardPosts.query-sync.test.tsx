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
  deletedAt: null,
  deletedBy: null,
});

const setupApiMock = ({
  includeTrashedPost = false,
  calendarItems = [],
}: {
  includeTrashedPost?: boolean;
  calendarItems?: Array<Record<string, unknown>>;
} = {}) => {
  let posts = Array.from({ length: 21 }, (_, index) => createPost(index + 1));
  if (includeTrashedPost) {
    posts = [
      ...posts,
      {
        ...createPost(999),
        id: "post-trash",
        title: "Post na lixeira",
        slug: "post-na-lixeira",
        deletedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        deletedBy: "user-1",
      },
    ];
  }
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
    if (path.startsWith("/api/admin/editorial/calendar") && method === "GET") {
      const url = new URL(`http://test.local${path}`);
      return mockJsonResponse(true, {
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || "",
        tz: url.searchParams.get("tz") || "America/Sao_Paulo",
        items: calendarItems,
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
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

  it("oculta paginacao e lixeira no calendario e preserva page na URL", async () => {
    setupApiMock({ includeTrashedPost: true });

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
    expect(screen.getByText("Lixeira")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Calend/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Lixeira")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Lista/i }));

    await waitFor(() => {
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });
    expect(screen.getByText("Lixeira")).toBeInTheDocument();
    expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
  });

  it("calendario renderiza postagens agendadas e publicadas com status", async () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10, 14, 0, 0, 0);
    const nextHour = new Date(currentMonthDate.getTime() + 60 * 60 * 1000);
    setupApiMock({
      calendarItems: [
        {
          id: "post-1",
          title: "Post agendado",
          slug: "post-agendado",
          status: "scheduled",
          publishedAt: currentMonthDate.toISOString(),
          scheduledAt: currentMonthDate.toISOString(),
          projectId: "",
        },
        {
          id: "post-2",
          title: "Post publicado",
          slug: "post-publicado",
          status: "published",
          publishedAt: nextHour.toISOString(),
          scheduledAt: null,
          projectId: "",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(screen.getByRole("button", { name: /Calend/i }));

    await screen.findByText(/Agenda de postagens .*publicadas/i);
    expect(screen.getByText("Post agendado")).toBeInTheDocument();
    expect(screen.getByText("Post publicado")).toBeInTheDocument();
    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByText("Publicada")).toBeInTheDocument();
  });

  it(
    "nao reintroduz query ao navegar para URL limpa e nao usa /api/me/preferences",
    { timeout: 15000 },
    async () => {
      setupApiMock();

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

      expect(getPreferenceCalls()).toHaveLength(0);
    },
  );
});
