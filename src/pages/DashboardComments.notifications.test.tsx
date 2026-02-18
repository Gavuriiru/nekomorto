import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardComments from "@/pages/DashboardComments";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const pendingCommentFixture = {
  id: "comment-1",
  targetType: "post",
  targetId: "post-1",
  name: "Visitante",
  content: "Comentário pendente",
  createdAt: "2026-02-17T10:00:00.000Z",
  targetLabel: "Post de teste",
  targetUrl: "/postagem/post-teste",
};

const setupApi = (options?: { approveOk?: boolean; deleteOk?: boolean }) => {
  const { approveOk = true, deleteOk = true } = options || {};
  apiFetchMock.mockImplementation(async (_base: string, path: string, request?: RequestInit) => {
    const method = String(request?.method || "GET").toUpperCase();
    if (path === "/api/comments/pending" && method === "GET") {
      return mockJsonResponse(true, { comments: [pendingCommentFixture] });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
    }
    if (path === `/api/comments/${pendingCommentFixture.id}/approve` && method === "POST") {
      return mockJsonResponse(approveOk, approveOk ? { ok: true } : { error: "forbidden" }, approveOk ? 200 : 403);
    }
    if (path === `/api/comments/${pendingCommentFixture.id}` && method === "DELETE") {
      return mockJsonResponse(deleteOk, deleteOk ? { ok: true } : { error: "forbidden" }, deleteOk ? 200 : 403);
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardComments notifications", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("aprova com sucesso, remove item e mostra toast", async () => {
    setupApi({ approveOk: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(screen.queryByText("Comentário pendente")).not.toBeInTheDocument();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comentário aprovado",
      }),
    );
  });

  it("mostra toast destrutivo quando aprovação falha", async () => {
    setupApi({ approveOk: false });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Não foi possível aprovar o comentário",
          variant: "destructive",
        }),
      );
    });
  });

  it("exige confirmação para excluir antes de chamar DELETE", async () => {
    setupApi({ deleteOk: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    const deleteCallsBeforeConfirm = apiFetchMock.mock.calls.filter((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === `/api/comments/${pendingCommentFixture.id}` && method === "DELETE";
    });
    expect(deleteCallsBeforeConfirm).toHaveLength(0);

    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(alertDialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const deleteCallsAfterConfirm = apiFetchMock.mock.calls.filter((call) => {
        const path = String(call[1] || "");
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === `/api/comments/${pendingCommentFixture.id}` && method === "DELETE";
      });
      expect(deleteCallsAfterConfirm).toHaveLength(1);
    });
  });
});
