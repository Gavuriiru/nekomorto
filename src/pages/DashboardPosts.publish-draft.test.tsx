import DashboardPosts from "@/pages/DashboardPosts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

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

type PostStatus = "draft" | "scheduled" | "published";

const createPost = (status: PostStatus) => ({
  id: "post-1",
  title: `Post ${status}`,
  slug: `post-${status}`,
  excerpt: "Resumo",
  content: "",
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  status,
  projectId: "",
  tags: [],
  views: 10,
  commentsCount: 2,
});

const setupApiMock = (initialStatus: PostStatus) => {
  let post = createPost(initialStatus);
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base, path, options) => {
    const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts: [post] });
    }
    if (path === `/api/posts/${post.id}` && method === "PUT") {
      const body = JSON.parse(String((options as RequestInit).body || "{}"));
      post = { ...post, ...body };
      return mockJsonResponse(true, { post });
    }
    if (path === "/api/posts" && method === "POST") {
      const body = JSON.parse(String((options as RequestInit).body || "{}"));
      post = {
        ...createPost((body.status as PostStatus) || "draft"),
        ...body,
        id: "post-2",
        slug: body.slug || "post-2",
        publishedAt: body.publishedAt || "2026-02-10T12:00:00.000Z",
        views: 0,
        commentsCount: 0,
      };
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
        permissions: ["posts"],
    grants: { posts: true },
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardPosts publish draft", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe botao de publicar ao editar rascunho e envia status published", async () => {
    setupApiMock("draft");

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(await screen.findByText("Post draft"));

    const dialog = await screen.findByRole("dialog");
    const publishNowButton = within(dialog).getByRole("button", { name: "Publicar agora" });
    expect(publishNowButton).toBeInTheDocument();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T09:10:11.000Z"));
    fireEvent.click(publishNowButton);
    vi.useRealTimers();

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return (
          path === "/api/posts/post-1" && String(options.method || "GET").toUpperCase() === "PUT"
        );
      });
      expect(putCall).toBeDefined();
      const payload = JSON.parse(String(((putCall as unknown[])[2] as RequestInit).body || "{}"));
      expect(payload.status).toBe("published");
      expect(payload.publishedAt).toBe("2026-04-02T09:10:11.000Z");
    });
  });

  it("exibe link de visualizacao quando o post ja esta publico", async () => {
    setupApiMock("published");

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(await screen.findByText("Post published"));

    const dialog = await screen.findByRole("dialog");
    const viewLink = within(dialog).getByRole("link", { name: "Visualizar página" });

    expect(viewLink).toHaveAttribute("href", "/postagem/post-published");
    expect(viewLink).toHaveAttribute("target", "_blank");
    expect(viewLink).toHaveAttribute("rel", "noreferrer");
  });

  it.each([
    "published",
    "scheduled",
  ] as const)("nao exibe botao de publicar agora para post %s", async (status) => {
    setupApiMock(status);

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(await screen.findByText(`Post ${status}`));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: "Publicar agora" }),
    ).not.toBeInTheDocument();
  });

  it("mantem publishedAt original ao salvar post publicado sem alterar a data", async () => {
    setupApiMock("published");

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(await screen.findByText("Post published"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return (
          path === "/api/posts/post-1" && String(options.method || "GET").toUpperCase() === "PUT"
        );
      });
      expect(putCall).toBeDefined();
      const payload = JSON.parse(String(((putCall as unknown[])[2] as RequestInit).body || "{}"));
      expect(payload.status).toBe("published");
      expect(payload.publishedAt).toBe("2026-02-10T12:00:00.000Z");
    });
  });

  it("mantem o modal aberto ao salvar rascunho de uma nova postagem", async () => {
    setupApiMock("draft");

    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(screen.getByRole("button", { name: "Nova postagem" }));

    const dialog = await screen.findByRole("dialog");
    const titleInput = dialog.querySelector<HTMLInputElement>("#post-title");
    expect(titleInput).not.toBeNull();
    fireEvent.change(titleInput as HTMLInputElement, { target: { value: "Novo rascunho" } });

    await waitFor(() => {
      const slugInput = dialog.querySelector<HTMLInputElement>("#post-slug");
      expect(slugInput).not.toBeNull();
      expect((slugInput as HTMLInputElement).value).toBe("novo-rascunho");
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return path === "/api/posts" && String(options.method || "GET").toUpperCase() === "POST";
      });
      expect(postCall).toBeDefined();
    });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova postagem" })).toBeInTheDocument();
  });
});
