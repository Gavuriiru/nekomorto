import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommentsSection from "@/components/CommentsSection";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const countPublicCommentsListGets = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "GET" && path.startsWith("/api/public/comments?");
  }).length;

describe("CommentsSection auto-refresh", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("recarrega comentarios automaticamente apos envio aprovado de staff", async () => {
    let commentsListCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (path.startsWith("/api/public/comments?") && method === "GET") {
        commentsListCalls += 1;
        if (commentsListCalls === 1) {
          return mockJsonResponse(true, { comments: [] });
        }
        return mockJsonResponse(true, {
          comments: [
            {
              id: "comment-1",
              parentId: null,
              name: "Admin",
              content: "Comentario da staff",
              createdAt: "2026-02-12T01:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/public/me" && method === "GET") {
        return mockJsonResponse(true, {
          user: {
            id: "user-1",
            name: "Admin",
            email: "admin@example.com",
            permissions: ["posts"],
          },
        });
      }
      if (path === "/api/public/comments" && method === "POST") {
        return mockJsonResponse(true, { comment: { id: "comment-1", status: "approved" } });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/postagem/post-teste"]}>
        <CommentsSection targetType="post" targetId="post-teste" />
      </MemoryRouter>,
    );

    await screen.findByText(/Como staff, seus coment/i);

    fireEvent.change(screen.getByPlaceholderText(/Escreva seu coment/i), {
      target: { value: "Comentario da staff" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publicar/i }));

    expect(await screen.findByText(/publicado\./i)).toBeInTheDocument();
    expect(await screen.findByText("Comentario da staff")).toBeInTheDocument();
    await waitFor(() => {
      expect(countPublicCommentsListGets()).toBe(2);
    });
  });

  it("nao recarrega lista apos envio pendente de usuario comum", async () => {
    let submittedPayload: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (path.startsWith("/api/public/comments?") && method === "GET") {
        return mockJsonResponse(true, { comments: [] });
      }
      if (path === "/api/public/me" && method === "GET") {
        return mockJsonResponse(true, {
          user: {
            id: "user-2",
            name: "Visitor",
            email: "visitor@example.com",
            permissions: [],
          },
        });
      }
      if (path === "/api/public/comments" && method === "POST") {
        const rawBody = typeof options?.body === "string" ? options.body : "";
        submittedPayload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        return mockJsonResponse(true, { comment: { id: "comment-2", status: "pending" } });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/postagem/post-teste"]}>
        <CommentsSection targetType="post" targetId="post-teste" />
      </MemoryRouter>,
    );

    await screen.findByText(/passam por aprova/i);
    expect(screen.getByPlaceholderText("Seu e-mail (opcional, usado para o Gravatar)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Publicar/i }));
    expect(await screen.findByText(/Preencha nome e coment/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), {
      target: { value: "Visitor" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escreva seu coment/i), {
      target: { value: "Comentario pendente" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publicar/i }));

    expect(await screen.findByText(/enviado!.*aprova/i)).toBeInTheDocument();
    expect(screen.getByText(/Ainda n.o h. coment.rios aprovados\./i)).toBeInTheDocument();
    expect(countPublicCommentsListGets()).toBe(1);
    expect(submittedPayload).not.toBeNull();
    expect(submittedPayload).not.toHaveProperty("email");
  });
});
