import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const pickVisibleDialog = (dialogs: HTMLElement[]) =>
  dialogs.find(
    (dialog) =>
      dialog.getAttribute("aria-hidden") !== "true" &&
      !dialog.closest('[aria-hidden="true"], [data-aria-hidden="true"]'),
  ) || dialogs[0];

const postFixture = {
  id: "post-1",
  title: "Post de teste",
  slug: "post-1",
  excerpt: "Resumo atual",
  content: "conteudo atual",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  scheduledAt: null,
  status: "draft" as const,
  projectId: "",
  tags: [],
  views: 10,
  commentsCount: 2,
  deletedAt: null,
  deletedBy: null,
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

const buildVersion = (
  id: string,
  {
    versionNumber,
    createdAt,
    snapshotOverrides,
  }: {
    versionNumber: number;
    createdAt: string;
    snapshotOverrides?: Record<string, unknown>;
  },
) => ({
  id,
  postId: postFixture.id,
  versionNumber,
  reason: "update",
  reasonLabel: "Atualizacao",
  slug: String(snapshotOverrides?.slug || postFixture.slug),
  createdAt,
  snapshot: buildVersionSnapshot(snapshotOverrides || {}),
});

const versionsPayload = [
  buildVersion("v-current", {
    versionNumber: 3,
    createdAt: "2026-02-10T12:00:00.000Z",
  }),
  buildVersion("v-old", {
    versionNumber: 2,
    createdAt: "2026-02-09T10:00:00.000Z",
    snapshotOverrides: {
      title: "Titulo antigo",
      slug: "titulo-antigo",
      excerpt: "Resumo antigo",
      content: "conteudo antigo",
      status: "published",
    },
  }),
];

const setupApiMock = () => {
  let posts = [postFixture];
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts });
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
    if (path.startsWith("/api/admin/content/post/") && path.includes("/versions") && method === "GET") {
      return mockJsonResponse(true, {
        postId: postFixture.id,
        versions: versionsPayload,
        nextCursor: null,
      });
    }
    if (path === `/api/admin/content/post/${postFixture.id}/rollback` && method === "POST") {
      const body = JSON.parse(String(options?.body || "{}"));
      if (body.versionId !== "v-old") {
        return mockJsonResponse(false, { error: "version_not_found" }, 404);
      }
      const rolledBackPost = {
        ...postFixture,
        title: "Titulo antigo",
        slug: "titulo-antigo",
        excerpt: "Resumo antigo",
        content: "conteudo antigo",
        status: "published",
      };
      posts = [rolledBackPost];
      return mockJsonResponse(true, {
        ok: true,
        post: rolledBackPost,
        rollback: {
          targetVersionId: "v-old",
          slugAdjusted: false,
          targetSlug: "titulo-antigo",
          resultingSlug: "titulo-antigo",
        },
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardPosts version history", () => {
  it("marca estado atual sem rollback e abre preview simples para versao restauravel", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");

    const historyButton = await screen.findByRole("button", { name: /Hist/i });
    fireEvent.click(historyButton);

    const historyDialogs = await screen.findAllByRole("dialog", { name: /Hist/i, hidden: true });
    const historyDialog = pickVisibleDialog(historyDialogs);
    expect(within(historyDialog).getAllByText("Estado atual").length).toBeGreaterThan(0);

    const oldVersionSlug = within(historyDialog).getByText(/\/titulo-antigo/i);
    const oldVersionRow = oldVersionSlug.closest(".rounded-lg");
    expect(oldVersionRow).toBeTruthy();
    const restoreButton = within(oldVersionRow as HTMLElement).getByRole("button", { name: /Restaurar/i });
    fireEvent.click(restoreButton);

    const rollbackDialog = await screen.findByRole("dialog", { name: /Restaurar/i });
    expect(within(rollbackDialog).getByText("Título")).toBeInTheDocument();
    expect(within(rollbackDialog).getByText("Slug")).toBeInTheDocument();
    expect(within(rollbackDialog).getByText("Resumo")).toBeInTheDocument();
    expect(within(rollbackDialog).getByText("Titulo antigo")).toBeInTheDocument();
    expect(within(rollbackDialog).getByText("/titulo-antigo")).toBeInTheDocument();
  });

  it("confirma rollback usando versionId da versao selecionada", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByText("Editar postagem");
    fireEvent.click(await screen.findByRole("button", { name: /Hist/i }));
    const historyDialogs = await screen.findAllByRole("dialog", { name: /Hist/i, hidden: true });
    const historyDialog = pickVisibleDialog(historyDialogs);
    const oldVersionSlug = within(historyDialog).getByText(/\/titulo-antigo/i);
    const oldVersionRow = oldVersionSlug.closest(".rounded-lg");
    expect(oldVersionRow).toBeTruthy();
    fireEvent.click(within(oldVersionRow as HTMLElement).getByRole("button", { name: /Restaurar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar rollback/i }));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some((call) => {
          const path = String(call[1] || "");
          const options = (call[2] || {}) as RequestInit;
          return (
            path === `/api/admin/content/post/${postFixture.id}/rollback` &&
            String(options.method || "GET").toUpperCase() === "POST" &&
            String(options.body || "").includes('\"versionId\":\"v-old\"')
          );
        }),
      ).toBe(true);
    });
  });
});
