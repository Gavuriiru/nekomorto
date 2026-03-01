import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUploads from "@/pages/DashboardUploads";

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

const baseSummary = {
  generatedAt: "2026-03-01T10:00:00.000Z",
  totals: {
    area: "total",
    originalBytes: 2000,
    variantBytes: 500,
    totalBytes: 2500,
    originalFiles: 2,
    variantFiles: 3,
    totalFiles: 5,
  },
  areas: [
    {
      area: "posts",
      originalBytes: 2000,
      variantBytes: 500,
      totalBytes: 2500,
      originalFiles: 2,
      variantFiles: 3,
      totalFiles: 5,
    },
  ],
};

const cleanupPreviewWithItems = {
  generatedAt: "2026-03-01T10:00:00.000Z",
  unusedCount: 2,
  totals: {
    area: "total",
    originalBytes: 800,
    variantBytes: 200,
    totalBytes: 1000,
    originalFiles: 2,
    variantFiles: 2,
    totalFiles: 4,
  },
  areas: [
    {
      area: "posts",
      originalBytes: 800,
      variantBytes: 200,
      totalBytes: 1000,
      originalFiles: 2,
      variantFiles: 2,
      totalFiles: 4,
    },
  ],
  examples: [
    {
      id: "u-1",
      url: "/uploads/posts/unused-1.png",
      fileName: "unused-1.png",
      folder: "posts",
      area: "posts",
      createdAt: "2026-03-01T09:00:00.000Z",
      originalBytes: 500,
      variantBytes: 100,
      totalBytes: 600,
    },
    {
      id: "u-2",
      url: "/uploads/posts/unused-2.png",
      fileName: "unused-2.png",
      folder: "posts",
      area: "posts",
      createdAt: "2026-03-01T09:30:00.000Z",
      originalBytes: 300,
      variantBytes: 100,
      totalBytes: 400,
    },
  ],
};

const emptyCleanupPreview = {
  generatedAt: "2026-03-01T10:05:00.000Z",
  unusedCount: 0,
  totals: {
    area: "total",
    originalBytes: 0,
    variantBytes: 0,
    totalBytes: 0,
    originalFiles: 0,
    variantFiles: 0,
    totalFiles: 0,
  },
  areas: [],
  examples: [],
};

const setupApi = (options?: {
  initialCleanupPreview?: typeof cleanupPreviewWithItems;
  cleanupPreviewAfterRun?: typeof emptyCleanupPreview | typeof cleanupPreviewWithItems;
  cleanupResult?: {
    ok: boolean;
    deletedCount: number;
    failedCount: number;
    deletedTotals: typeof emptyCleanupPreview.totals;
    failures: Array<{ url: string; reason: string }>;
  };
}) => {
  const initialCleanupPreview = options?.initialCleanupPreview || cleanupPreviewWithItems;
  const cleanupPreviewAfterRun = options?.cleanupPreviewAfterRun || emptyCleanupPreview;
  const cleanupResult =
    options?.cleanupResult ||
    ({
      ok: true,
      deletedCount: 2,
      failedCount: 0,
      deletedTotals: cleanupPreviewWithItems.totals,
      failures: [],
    } as const);
  let cleanupRuns = 0;

  apiFetchMock.mockImplementation(async (_base: string, endpoint: string, request?: RequestInit) => {
    const method = String(request?.method || "GET").toUpperCase();
    if (endpoint === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "u-admin", name: "Admin", username: "admin" });
    }
    if (endpoint === "/api/uploads/storage/areas" && method === "GET") {
      return mockJsonResponse(true, {
        ...baseSummary,
        generatedAt: cleanupRuns > 0 ? "2026-03-01T10:10:00.000Z" : baseSummary.generatedAt,
      });
    }
    if (endpoint === "/api/uploads/storage/cleanup" && method === "GET") {
      return mockJsonResponse(true, cleanupRuns > 0 ? cleanupPreviewAfterRun : initialCleanupPreview);
    }
    if (endpoint === "/api/uploads/storage/cleanup" && method === "POST") {
      cleanupRuns += 1;
      return mockJsonResponse(true, cleanupResult);
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardUploads cleanup", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("renderiza a secao de limpeza quando ha uploads elegiveis", async () => {
    setupApi();

    render(<DashboardUploads />);

    await screen.findByText("Limpeza de uploads nao utilizados");
    expect(screen.getByText("2 uploads elegiveis")).toBeInTheDocument();
    expect(screen.getByText("unused-1.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar 2 uploads" })).toBeInTheDocument();
  });

  it("exibe estado vazio quando nao ha uploads elegiveis", async () => {
    setupApi({
      initialCleanupPreview: emptyCleanupPreview,
      cleanupPreviewAfterRun: emptyCleanupPreview,
    });

    render(<DashboardUploads />);

    await screen.findByText("Nenhum upload elegivel para limpeza.");
    expect(screen.queryByRole("button", { name: /Limpar .* uploads/i })).not.toBeInTheDocument();
  });

  it("abre o modal e exige EXCLUIR antes de habilitar a confirmacao", async () => {
    setupApi();

    render(<DashboardUploads />);

    const openButton = await screen.findByRole("button", { name: "Limpar 2 uploads" });
    fireEvent.click(openButton);

    const alertDialog = await screen.findByRole("alertdialog");
    const confirmButton = within(alertDialog).getByRole("button", { name: "Limpar 2 uploads" });
    const confirmInput = within(alertDialog).getByPlaceholderText("Digite EXCLUIR");

    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "excluir" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "EXCLUIR" } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("envia o body correto no cleanup e recarrega preview e resumo", async () => {
    setupApi();

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: "Limpar 2 uploads" }));

    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(alertDialog).getByPlaceholderText("Digite EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(within(alertDialog).getByRole("button", { name: "Limpar 2 uploads" }));

    await waitFor(() => {
      expect(screen.getByText("Nenhum upload elegivel para limpeza.")).toBeInTheDocument();
    });

    const cleanupPostCall = apiFetchMock.mock.calls.find((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/uploads/storage/cleanup" && method === "POST";
    });

    expect(cleanupPostCall).toBeDefined();
    expect(JSON.parse(String((cleanupPostCall?.[2] as RequestInit | undefined)?.body || "{}"))).toEqual({
      confirm: "EXCLUIR",
    });

    const summaryGetCalls = apiFetchMock.mock.calls.filter((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/uploads/storage/areas" && method === "GET";
    });
    const cleanupGetCalls = apiFetchMock.mock.calls.filter((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/uploads/storage/cleanup" && method === "GET";
    });

    expect(summaryGetCalls.length).toBeGreaterThanOrEqual(2);
    expect(cleanupGetCalls.length).toBeGreaterThanOrEqual(2);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Uploads nao utilizados removidos",
      }),
    );
  });

  it("mostra feedback de limpeza parcial quando ha falhas", async () => {
    setupApi({
      cleanupPreviewAfterRun: cleanupPreviewWithItems,
      cleanupResult: {
        ok: false,
        deletedCount: 1,
        failedCount: 1,
        deletedTotals: {
          area: "total",
          originalBytes: 500,
          variantBytes: 100,
          totalBytes: 600,
          originalFiles: 1,
          variantFiles: 1,
          totalFiles: 2,
        },
        failures: [{ url: "/uploads/posts/unused-2.png", reason: "eperm" }],
      },
    });

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: "Limpar 2 uploads" }));

    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(alertDialog).getByPlaceholderText("Digite EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(within(alertDialog).getByRole("button", { name: "Limpar 2 uploads" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Limpeza parcial concluida",
          variant: "destructive",
        }),
      );
    });
  });
});
