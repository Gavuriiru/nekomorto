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

    await screen.findByText("Como staff, seus comentários aparecem imediatamente.");

    fireEvent.change(screen.getByPlaceholderText("Escreva seu comentário"), {
      target: { value: "Comentario da staff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentário" }));

    expect(await screen.findByText("Comentário publicado.")).toBeInTheDocument();
    expect(await screen.findByText("Comentario da staff")).toBeInTheDocument();
    await waitFor(() => {
      expect(countPublicCommentsListGets()).toBe(2);
    });
  });

  it("nao recarrega lista apos envio pendente de usuario comum", async () => {
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
        return mockJsonResponse(true, { comment: { id: "comment-2", status: "pending" } });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/postagem/post-teste"]}>
        <CommentsSection targetType="post" targetId="post-teste" />
      </MemoryRouter>,
    );

    await screen.findByText("Os comentários passam por aprovação antes de aparecerem.");

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), {
      target: { value: "Visitor" },
    });
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail (usado para o Gravatar)"), {
      target: { value: "visitor@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Escreva seu comentário"), {
      target: { value: "Comentario pendente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar comentário" }));

    expect(
      await screen.findByText("Comentário enviado! Ele ficará visível após aprovação."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ainda não há comentários aprovados.")).toBeInTheDocument();
    expect(countPublicCommentsListGets()).toBe(1);
  });
});
