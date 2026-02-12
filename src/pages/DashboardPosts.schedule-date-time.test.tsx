import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("DashboardPosts schedule date/time", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/posts" && method === "POST") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { post: { id: "post-1", ...body } });
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

  it("altera data/hora com MUI fields e salva agendado mantendo ISO local", async () => {
    render(
      <MemoryRouter>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    fireEvent.click(screen.getByRole("button", { name: "Nova postagem" }));
    await screen.findByRole("heading", { name: "Nova postagem" });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Post agendado MUI" } });

    const dateInput = document.getElementById("post-date") as HTMLInputElement;
    const timeInput = document.getElementById("post-time") as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(timeInput).toBeTruthy();

    fireEvent.change(dateInput, { target: { value: "15/03/2026" } });
    fireEvent.blur(dateInput);
    fireEvent.change(timeInput, { target: { value: "22:45" } });
    fireEvent.blur(timeInput);

    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return path === "/api/posts" && String(options.method || "GET").toUpperCase() === "POST";
      });
      expect(postCall).toBeDefined();
      const payload = JSON.parse(String(((postCall as unknown[])[2] as RequestInit).body || "{}"));
      expect(payload.status).toBe("scheduled");
      expect(payload.publishedAt).toBe(new Date("2026-03-15T22:45").toISOString());
    });
  });
});
