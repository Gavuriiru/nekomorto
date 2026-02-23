import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPosts from "@/pages/DashboardPosts";

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
    onSave: (payload: { urls: string[]; items: [] }) => void;
  }) => {
    if (!props.open) {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() =>
          props.onSave({
            urls: ["/uploads/seo-selected.jpg"],
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

vi.mock("@/components/ui/use-toast", () => ({
  toast: () => undefined,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const getCreateCall = () =>
  apiFetchMock.mock.calls.find((call) => {
    const path = call[1];
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/posts" && method === "POST";
  });

describe("DashboardPosts SEO image payload", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [{ id: "user-1", permissions: ["posts"] }],
          ownerIds: [],
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
      if (path === "/api/posts" && method === "POST") {
        const body = JSON.parse(String(options?.body || "{}"));
        return mockJsonResponse(true, {
          post: {
            id: "post-1",
            slug: body.slug || "post-1",
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("inclui seoImageUrl no payload ao criar post", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Nova postagem" }));
    const dialog = await screen.findByRole("dialog");
    const titleInput = dialog.querySelector<HTMLInputElement>("#post-title");
    expect(titleInput).not.toBeNull();
    fireEvent.change(titleInput as HTMLInputElement, { target: { value: "Meu post SEO" } });

    await waitFor(() => {
      const slugInput = dialog.querySelector<HTMLInputElement>("#post-slug");
      expect(slugInput).not.toBeNull();
      expect((slugInput as HTMLInputElement).value).toBe("meu-post-seo");
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Biblioteca SEO" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mock salvar biblioteca" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => {
      const createCall = getCreateCall();
      expect(createCall).toBeTruthy();
      const payload = JSON.parse(String((((createCall?.[2] || {}) as RequestInit).body || "{}")));
      expect(payload.seoImageUrl).toBe("/uploads/seo-selected.jpg");
    });
  });
});
