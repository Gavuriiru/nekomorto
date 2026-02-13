import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPosts from "@/pages/DashboardPosts";

const { apiFetchMock, imageLibraryPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
}));

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
  default: (props: {
    open?: boolean;
    currentSelectionUrls?: string[];
    onSave: (payload: { urls: string[]; items: [] }) => void;
  }) => {
    imageLibraryPropsSpy(props);
    if (!props.open) {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() =>
          props.onSave({
            urls: [props.currentSelectionUrls?.[0] || ""],
            items: [],
          })
        }
      >
        Mock salvar biblioteca
      </button>
    );
  },
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

const lexicalWithImage = JSON.stringify({
  root: {
    type: "root",
    version: 1,
    children: [
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", version: 1, text: "Conteúdo do post" }],
      },
      {
        type: "image",
        version: 1,
        src: "/uploads/primeira-capa.png",
        altText: "Primeira automática",
      },
    ],
  },
});

describe("DashboardPosts biblioteca com capa automatica", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, {
          posts: [
            {
              id: "post-1",
              title: "Post sem capa manual",
              slug: "post-sem-capa-manual",
              coverImageUrl: null,
              coverAlt: "",
              excerpt: "Resumo",
              content: lexicalWithImage,
              contentFormat: "lexical",
              author: "Admin",
              publishedAt: "2026-02-10T12:00:00.000Z",
              status: "published",
              projectId: "",
              tags: [],
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
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("usa capa automatica como selecao da biblioteca e preserva modo automatico ao salvar igual", async () => {
    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(await screen.findByText("Post sem capa manual"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Automática")).toBeInTheDocument();

    await waitFor(() => {
      const latest = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as { currentSelectionUrls?: string[] } | undefined;
      expect(latest?.currentSelectionUrls).toEqual(["/uploads/primeira-capa.png"]);
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Biblioteca" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mock salvar biblioteca" }));

    await waitFor(() => {
      expect(within(dialog).getByText("Automática")).toBeInTheDocument();
      expect(within(dialog).queryByText("Manual")).not.toBeInTheDocument();
    });
  });
});
