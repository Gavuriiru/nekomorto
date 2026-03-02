import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import DashboardComments from "@/pages/DashboardComments";
import { formatDateTime } from "@/lib/date";

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
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

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

const secondPendingCommentFixture = {
  ...pendingCommentFixture,
  id: "comment-2",
  targetId: "post-2",
  content: "Outro comentário pendente",
  targetLabel: "Segundo post",
  targetUrl: "/postagem/segundo-post",
};

const setupApi = (options?: {
  approveOk?: boolean;
  deleteOk?: boolean;
  bulkApproveOk?: boolean;
  bulkDeleteOk?: boolean;
  pendingComments?: typeof pendingCommentFixture[];
}) => {
  const {
    approveOk = true,
    deleteOk = true,
    bulkApproveOk = true,
    bulkDeleteOk = true,
    pendingComments = [pendingCommentFixture],
  } = options || {};
  apiFetchMock.mockImplementation(async (_base: string, path: string, request?: RequestInit) => {
    const method = String(request?.method || "GET").toUpperCase();
    if (path === "/api/comments/pending" && method === "GET") {
      return mockJsonResponse(true, { comments: pendingComments });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
    }
    if (path === "/api/comments/pending/bulk" && method === "POST") {
      const parsedBody =
        typeof request?.body === "string" && request.body
          ? (JSON.parse(request.body) as { action?: string; confirmText?: string })
          : {};
      if (parsedBody.action === "approve_all") {
        return mockJsonResponse(
          bulkApproveOk,
          bulkApproveOk
            ? {
                ok: true,
                action: "approve_all",
                totalPendingBefore: pendingComments.length,
                processedCount: pendingComments.length,
                remainingPending: 0,
              }
            : { error: "forbidden" },
          bulkApproveOk ? 200 : 403,
        );
      }
      if (parsedBody.action === "delete_all") {
        return mockJsonResponse(
          bulkDeleteOk,
          bulkDeleteOk
            ? {
                ok: true,
                action: "delete_all",
                totalPendingBefore: pendingComments.length,
                processedCount: pendingComments.length,
                remainingPending: 0,
              }
            : { error: "confirmation_required" },
          bulkDeleteOk ? 200 : 400,
        );
      }
      return mockJsonResponse(false, { error: "invalid_action" }, 400);
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

  it("aprova todos os pendentes pela ação em massa e limpa a fila", async () => {
    setupApi({
      bulkApproveOk: true,
      pendingComments: [pendingCommentFixture, secondPendingCommentFixture],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    await screen.findByText("Outro comentário pendente");

    fireEvent.click(screen.getByRole("button", { name: "Aprovar todos" }));

    await waitFor(() => {
      expect(screen.queryByText("Comentário pendente")).not.toBeInTheDocument();
      expect(screen.queryByText("Outro comentário pendente")).not.toBeInTheDocument();
    });

    const bulkCalls = apiFetchMock.mock.calls.filter((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/comments/pending/bulk" && method === "POST";
    });

    expect(bulkCalls).toHaveLength(1);
    expect(JSON.parse(String((bulkCalls[0]?.[2] as RequestInit | undefined)?.body || "{}"))).toEqual({
      action: "approve_all",
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comentários aprovados",
      }),
    );
  });

  it("exige EXCLUIR para confirmar exclusão em massa e chama endpoint correto", async () => {
    setupApi({
      bulkDeleteOk: true,
      pendingComments: [pendingCommentFixture, secondPendingCommentFixture],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    fireEvent.click(screen.getByRole("button", { name: "Excluir todos" }));

    const bulkDialog = await screen.findByRole("alertdialog");
    const confirmButton = within(bulkDialog).getByRole("button", { name: "Excluir todos" });
    const confirmInput = within(bulkDialog).getByPlaceholderText("Digite EXCLUIR");

    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "excluir" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "EXCLUIR" } });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText("Comentário pendente")).not.toBeInTheDocument();
      expect(screen.queryByText("Outro comentário pendente")).not.toBeInTheDocument();
    });

    const bulkCalls = apiFetchMock.mock.calls.filter((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/comments/pending/bulk" && method === "POST";
    });

    expect(bulkCalls).toHaveLength(1);
    expect(JSON.parse(String((bulkCalls[0]?.[2] as RequestInit | undefined)?.body || "{}"))).toEqual({
      action: "delete_all",
      confirmText: "EXCLUIR",
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comentários excluídos",
      }),
    );
  });

  it("renderiza o alvo no header com truncamento entre badge e data", async () => {
    const longTargetLabel =
      "Post de teste com um titulo bem longo para validar truncamento visual no header da fila";
    setupApi({
      pendingComments: [
        {
          ...pendingCommentFixture,
          targetLabel: longTargetLabel,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário pendente");
    const targetLabel = screen.getByTitle(longTargetLabel);

    expect(targetLabel.className).toContain("truncate");
    expect(targetLabel.className).toContain("min-w-0");
    expect(screen.getByText(formatDateTime(pendingCommentFixture.createdAt))).toBeInTheDocument();
  });

  it("traduz badges de targetType para PT-BR", async () => {
    setupApi({
      pendingComments: [
        { ...pendingCommentFixture, id: "c-post", targetType: "post", content: "Comentário post" },
        { ...pendingCommentFixture, id: "c-project", targetType: "project", content: "Comentário projeto" },
        { ...pendingCommentFixture, id: "c-chapter", targetType: "chapter", content: "Comentário capítulo" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText("Comentário post");
    await screen.findByText("Comentário projeto");
    await screen.findByText("Comentário capítulo");

    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("PROJETO")).toBeInTheDocument();
    expect(screen.getByText("CAPÍTULO")).toBeInTheDocument();
  });

  it("renderiza a badge superior e anima a badge de contagem pendente", async () => {
    setupApi({
      pendingComments: [pendingCommentFixture, secondPendingCommentFixture],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText(pendingCommentFixture.content);

    const headerBadge = screen.getByTestId("dashboard-comments-header-badge");
    const headerBadgeReveal = headerBadge.parentElement;
    const pendingCountBadge = screen.getByTestId("dashboard-comments-pending-count-badge");

    expect(headerBadge).toHaveTextContent("Comentários");
    expect(headerBadgeReveal).not.toBeNull();
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal");
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal-delay-1");
    expect(headerBadgeReveal).toHaveAttribute("data-reveal");
    expect(classTokens(pendingCountBadge)).toContain("animate-fade-in");
    expect(pendingCountBadge).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.headerMetaMs}ms`,
    });
  });

  it("aplica reveal ao container das acoes em massa", async () => {
    setupApi({
      pendingComments: [pendingCommentFixture, secondPendingCommentFixture],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText(pendingCommentFixture.content);
    const bulkActions = screen.getByTestId("dashboard-comments-bulk-actions");

    expect(classTokens(bulkActions)).toContain("animate-slide-up");
    expect(classTokens(bulkActions)).toContain("opacity-0");
  });

  it("mostra spinner ao aprovar todos enquanto a request em massa esta pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, request?: RequestInit) => {
      const method = String(request?.method || "GET").toUpperCase();
      if (path === "/api/comments/pending" && method === "GET") {
        return mockJsonResponse(true, {
          comments: [pendingCommentFixture, secondPendingCommentFixture],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
      }
      if (path === "/api/comments/pending/bulk" && method === "POST") {
        return new Promise<Response>(() => undefined);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText(pendingCommentFixture.content);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar todos" }));

    const bulkActions = screen.getByTestId("dashboard-comments-bulk-actions");
    const approvingButton = within(bulkActions).getByRole("button", { name: /Aprovando/i });
    expect(approvingButton).toHaveTextContent("Aprovando...");
    expect(approvingButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("mostra spinner ao excluir todos enquanto a request em massa esta pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, request?: RequestInit) => {
      const method = String(request?.method || "GET").toUpperCase();
      if (path === "/api/comments/pending" && method === "GET") {
        return mockJsonResponse(true, {
          comments: [pendingCommentFixture, secondPendingCommentFixture],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
      }
      if (path === "/api/comments/pending/bulk" && method === "POST") {
        return new Promise<Response>(() => undefined);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/comentarios"]}>
        <DashboardComments />
      </MemoryRouter>,
    );

    await screen.findByText(pendingCommentFixture.content);
    fireEvent.click(screen.getByRole("button", { name: "Excluir todos" }));

    const bulkDialog = await screen.findByRole("alertdialog");
    const confirmInput = within(bulkDialog).getByPlaceholderText("Digite EXCLUIR");
    const confirmButton = within(bulkDialog).getByRole("button", { name: "Excluir todos" });

    fireEvent.change(confirmInput, { target: { value: "EXCLUIR" } });
    fireEvent.click(confirmButton);

    const bulkActions = screen.getByTestId("dashboard-comments-bulk-actions");
    const deletingButton = within(bulkActions).getByRole("button", { name: /Excluindo/i, hidden: true });
    expect(deletingButton).toHaveTextContent("Excluindo...");
    expect(deletingButton.querySelector(".animate-spin")).not.toBeNull();
  });
});
