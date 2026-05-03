import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPosts, { __testing } from "@/pages/DashboardPosts";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
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
  const MockEditor = React.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
      React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
      return <div data-testid="lexical-editor" />;
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
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

const deferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

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
  views: 10,
  commentsCount: 0,
  deletedAt: null,
  deletedBy: null,
});

describe("DashboardPosts loading state", () => {
  beforeEach(() => {
    __testing.clearPostsPageCache();
    apiFetchMock.mockReset();
  });

  it("mostra header e skeleton local enquanto /api/posts ainda nao respondeu", async () => {
    const postsDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          permissions: ["posts"],
          grants: { posts: true },
        });
      }
      if (path === "/api/posts") {
        return postsDeferred.promise;
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/projects") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    expect(screen.getByTestId("dashboard-posts-skeleton-surface")).toBeInTheDocument();
    expect(screen.queryByText(/Carregando postagens/i)).not.toBeInTheDocument();

    postsDeferred.resolve(mockJsonResponse(true, { posts: [createPost(1)], mediaVariants: {} }));

    await screen.findByText("Post 1");
  });

  it("reaproveita cache quente ao revisitar a pagina", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          permissions: ["posts"],
          grants: { posts: true },
        });
      }
      if (path === "/api/posts") {
        return mockJsonResponse(true, { posts: [createPost(1)], mediaVariants: {} });
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/projects") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const firstRender = render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByText("Post 1");
    firstRender.unmount();

    const refreshDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          permissions: ["posts"],
          grants: { posts: true },
        });
      }
      if (path === "/api/posts") {
        return refreshDeferred.promise;
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/projects") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    expect(screen.getByText("Post 1")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-posts-skeleton-surface")).not.toBeInTheDocument();

    refreshDeferred.resolve(mockJsonResponse(true, { posts: [createPost(1)], mediaVariants: {} }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });
  });
});
