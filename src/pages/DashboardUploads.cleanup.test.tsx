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

const CLEANUP_ACTION_LABEL = "Limpar armazenamento não utilizado";

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
  unusedUploadCount: 2,
  orphanedVariantFilesCount: 3,
  orphanedVariantDirsCount: 1,
  totals: {
    area: "total",
    originalBytes: 800,
    variantBytes: 1200,
    totalBytes: 2000,
    originalFiles: 2,
    variantFiles: 3,
    totalFiles: 5,
  },
  areas: [
    {
      area: "posts",
      originalBytes: 800,
      variantBytes: 200,
      totalBytes: 1000,
      originalFiles: 2,
      variantFiles: 1,
      totalFiles: 3,
    },
    {
      area: "_variants",
      originalBytes: 0,
      variantBytes: 1000,
      totalBytes: 1000,
      originalFiles: 0,
      variantFiles: 2,
      totalFiles: 2,
    },
  ],
  examples: [
    {
      kind: "upload",
      scope: "unused_upload",
      id: "u-1",
      ownerUploadId: null,
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
      kind: "variant",
      scope: "orphaned_variant",
      id: null,
      ownerUploadId: "u-9",
      url: "/uploads/_variants/u-9/old-card.webp",
      fileName: "old-card.webp",
      folder: "_variants/u-9",
      area: "_variants",
      createdAt: "2026-03-01T09:30:00.000Z",
      originalBytes: 0,
      variantBytes: 400,
      totalBytes: 400,
    },
  ],
};

const emptyCleanupPreview = {
  generatedAt: "2026-03-01T10:05:00.000Z",
  unusedCount: 0,
  unusedUploadCount: 0,
  orphanedVariantFilesCount: 0,
  orphanedVariantDirsCount: 0,
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
  initialCleanupPreview?: typeof cleanupPreviewWithItems | typeof emptyCleanupPreview;
  cleanupPreviewAfterRun?: typeof cleanupPreviewWithItems | typeof emptyCleanupPreview;
  cleanupResult?: {
    ok: boolean;
    deletedCount: number;
    deletedUnusedUploadsCount: number;
    deletedOrphanedVariantFilesCount: number;
    deletedOrphanedVariantDirsCount: number;
    failedCount: number;
    deletedTotals: typeof emptyCleanupPreview.totals;
    failures: Array<{ kind: "upload" | "variant"; url: string; reason: string }>;
  };
}) => {
  const initialCleanupPreview = options?.initialCleanupPreview || cleanupPreviewWithItems;
  const cleanupPreviewAfterRun = options?.cleanupPreviewAfterRun || emptyCleanupPreview;
  const cleanupResult =
    options?.cleanupResult ||
    ({
      ok: true,
      deletedCount: 2,
      deletedUnusedUploadsCount: 2,
      deletedOrphanedVariantFilesCount: 3,
      deletedOrphanedVariantDirsCount: 1,
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

  it("renderiza a seção de armazenamento não utilizado com contagens separadas e linhas mistas", async () => {
    setupApi();

    render(<DashboardUploads />);

    await screen.findByText("Limpeza de armazenamento não utilizado");
    expect(screen.getByText("2 uploads sem uso")).toBeInTheDocument();
    expect(screen.getByText("3 arquivos de variante órfãos")).toBeInTheDocument();
    expect(screen.getByText("1 diretórios de variantes órfãos")).toBeInTheDocument();
    expect(screen.getByText("unused-1.png")).toBeInTheDocument();
    expect(screen.getByText("old-card.webp")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Variante órfã")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CLEANUP_ACTION_LABEL })).toBeInTheDocument();
  });

  it("exibe estado vazio quando não há nada elegível para limpeza", async () => {
    setupApi({
      initialCleanupPreview: emptyCleanupPreview,
      cleanupPreviewAfterRun: emptyCleanupPreview,
    });

    render(<DashboardUploads />);

    await screen.findByText("Nenhum arquivo elegível para limpeza.");
    expect(screen.queryByRole("button", { name: CLEANUP_ACTION_LABEL })).not.toBeInTheDocument();
  });

  it("abre o modal, menciona variantes órfãs e exige EXCLUIR antes de habilitar a confirmação", async () => {
    setupApi();

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: CLEANUP_ACTION_LABEL }));

    const alertDialog = await screen.findByRole("alertdialog");
    expect(within(alertDialog).getByText(/variantes órfãs encontradas em _variants/i)).toBeInTheDocument();

    const confirmButton = within(alertDialog).getByRole("button", { name: CLEANUP_ACTION_LABEL });
    const confirmInput = within(alertDialog).getByPlaceholderText("Digite EXCLUIR");

    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "excluir" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "EXCLUIR" } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("envia o body correto, recarrega os dados e mostra toast combinado de sucesso", async () => {
    setupApi();

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: CLEANUP_ACTION_LABEL }));

    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(alertDialog).getByPlaceholderText("Digite EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(within(alertDialog).getByRole("button", { name: CLEANUP_ACTION_LABEL }));

    await waitFor(() => {
      expect(screen.getByText("Nenhum arquivo elegível para limpeza.")).toBeInTheDocument();
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
        title: "Armazenamento não utilizado removido",
        description: expect.stringContaining("2 uploads removidos, 3 variantes órfãs removidas"),
      }),
    );
  });

  it("mostra feedback de limpeza parcial quando ha falha de variante", async () => {
    setupApi({
      cleanupPreviewAfterRun: cleanupPreviewWithItems,
      cleanupResult: {
        ok: false,
        deletedCount: 1,
        deletedUnusedUploadsCount: 1,
        deletedOrphanedVariantFilesCount: 2,
        deletedOrphanedVariantDirsCount: 1,
        failedCount: 1,
        deletedTotals: {
          area: "total",
          originalBytes: 500,
          variantBytes: 300,
          totalBytes: 800,
          originalFiles: 1,
          variantFiles: 2,
          totalFiles: 3,
        },
        failures: [{ kind: "variant", url: "/uploads/_variants/u-9/old-card.webp", reason: "eperm" }],
      },
    });

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: CLEANUP_ACTION_LABEL }));

    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(alertDialog).getByPlaceholderText("Digite EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(within(alertDialog).getByRole("button", { name: CLEANUP_ACTION_LABEL }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Limpeza parcial concluida",
          variant: "destructive",
          description: expect.stringContaining("1 falharam."),
        }),
      );
    });
  });
});
