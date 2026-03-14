import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUploads, { __testing } from "@/pages/DashboardUploads";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const dismissToastMock = vi.hoisted(() => vi.fn());

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
  dismissToast: (...args: unknown[]) => dismissToastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createDeferredResponse = () => {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: (value: Response) => {
      resolve?.(value);
    },
  };
};
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

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
  looseOriginalFilesCount: 1,
  looseOriginalTotals: {
    area: "total",
    originalBytes: 300,
    variantBytes: 0,
    totalBytes: 300,
    originalFiles: 1,
    variantFiles: 0,
    totalFiles: 1,
  },
  quarantinePendingDeleteCount: 2,
  quarantinePendingDeleteTotals: {
    area: "total",
    originalBytes: 250,
    variantBytes: 0,
    totalBytes: 250,
    originalFiles: 2,
    variantFiles: 0,
    totalFiles: 2,
  },
  totals: {
    area: "total",
    originalBytes: 1350,
    variantBytes: 1200,
    totalBytes: 2550,
    originalFiles: 5,
    variantFiles: 3,
    totalFiles: 8,
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
      area: "_quarantine",
      originalBytes: 250,
      variantBytes: 0,
      totalBytes: 250,
      originalFiles: 2,
      variantFiles: 0,
      totalFiles: 2,
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
    {
      kind: "upload",
      scope: "loose_original",
      id: null,
      ownerUploadId: null,
      url: "/uploads/projects/orphan-cover.png",
      fileName: "orphan-cover.png",
      folder: "projects",
      area: "projects",
      createdAt: "2026-03-01T09:45:00.000Z",
      originalBytes: 300,
      variantBytes: 0,
      totalBytes: 300,
    },
  ],
};

const emptyCleanupPreview = {
  generatedAt: "2026-03-01T10:05:00.000Z",
  unusedCount: 0,
  unusedUploadCount: 0,
  orphanedVariantFilesCount: 0,
  orphanedVariantDirsCount: 0,
  looseOriginalFilesCount: 0,
  looseOriginalTotals: {
    area: "total",
    originalBytes: 0,
    variantBytes: 0,
    totalBytes: 0,
    originalFiles: 0,
    variantFiles: 0,
    totalFiles: 0,
  },
  quarantinePendingDeleteCount: 0,
  quarantinePendingDeleteTotals: {
    area: "total",
    originalBytes: 0,
    variantBytes: 0,
    totalBytes: 0,
    originalFiles: 0,
    variantFiles: 0,
    totalFiles: 0,
  },
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
    quarantinedLooseOriginalFilesCount: number;
    deletedQuarantineFilesCount: number;
    deletedQuarantineDirsCount: number;
    failedCount: number;
    deletedTotals: typeof emptyCleanupPreview.totals;
    quarantinedTotals: typeof emptyCleanupPreview.totals;
    purgedQuarantineTotals: typeof emptyCleanupPreview.totals;
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
      quarantinedLooseOriginalFilesCount: 1,
      deletedQuarantineFilesCount: 2,
      deletedQuarantineDirsCount: 1,
      failedCount: 0,
      deletedTotals: cleanupPreviewWithItems.totals,
      quarantinedTotals: cleanupPreviewWithItems.looseOriginalTotals,
      purgedQuarantineTotals: cleanupPreviewWithItems.quarantinePendingDeleteTotals,
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
    __testing.clearUploadsCaches();
    apiFetchMock.mockReset();
    toastMock.mockReset();
    toastMock.mockReturnValue("dashboard-uploads-refresh-toast");
    dismissToastMock.mockReset();
  });

  it("mantem o shell final visivel enquanto carrega as secoes", () => {
    apiFetchMock.mockImplementation(async () => new Promise<Response>(() => undefined));

    render(<DashboardUploads />);

    expect(screen.getByTestId("dashboard-uploads-summary-grid")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-uploads-storage-card")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-uploads-cleanup-card")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-uploads-cleanup-pending")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-uploads-status-bar")).not.toBeInTheDocument();
    const summaryLoadingCards = screen
      .getByTestId("dashboard-uploads-summary-grid")
      .querySelectorAll("article");
    expect(summaryLoadingCards.length).toBeGreaterThan(0);
    expect(classTokens(summaryLoadingCards[0] as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(screen.getByTestId("dashboard-uploads-storage-card"))).toContain(
      "animate-slide-up",
    );
    expect(classTokens(screen.getByTestId("dashboard-uploads-cleanup-card"))).toContain(
      "animate-slide-up",
    );
    expect(screen.getByRole("button", { name: CLEANUP_ACTION_LABEL })).toBeDisabled();
    expect(screen.getByText(/Atualizado:/i)).toBeInTheDocument();
    expect(screen.getByText(/Analise:/i)).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("libera o resumo assim que ele resolve sem esperar o preview de limpeza", async () => {
    const summaryDeferred = createDeferredResponse();
    const cleanupDeferred = createDeferredResponse();

    apiFetchMock.mockImplementation(async (_base: string, endpoint: string, request?: RequestInit) => {
      const method = String(request?.method || "GET").toUpperCase();
      if (endpoint === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "u-admin", name: "Admin", username: "admin" });
      }
      if (endpoint === "/api/uploads/storage/areas" && method === "GET") {
        return summaryDeferred.promise;
      }
      if (endpoint === "/api/uploads/storage/cleanup" && method === "GET") {
        return cleanupDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<DashboardUploads />);

    summaryDeferred.resolve(mockJsonResponse(true, baseSummary));

    await waitFor(() => {
      expect(
        within(screen.getByTestId("dashboard-uploads-summary-grid")).getByText("2.44 KB"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-uploads-storage-card")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-uploads-cleanup-pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CLEANUP_ACTION_LABEL })).toBeDisabled();

    cleanupDeferred.resolve(mockJsonResponse(true, cleanupPreviewWithItems));
    expect(await screen.findByText("2 uploads sem uso")).toBeInTheDocument();
  });

  it("reabre com cache quente e usa toast no refresh sem recolocar a faixa global", async () => {
    setupApi();

    const firstRender = render(<DashboardUploads />);
    await screen.findByText("2 uploads sem uso");
    firstRender.unmount();

    const summaryDeferred = createDeferredResponse();
    const cleanupDeferred = createDeferredResponse();

    apiFetchMock.mockReset();
    toastMock.mockReset();
    toastMock.mockReturnValue("dashboard-uploads-refresh-toast");
    dismissToastMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, endpoint: string, request?: RequestInit) => {
      const method = String(request?.method || "GET").toUpperCase();
      if (endpoint === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "u-admin", name: "Admin", username: "admin" });
      }
      if (endpoint === "/api/uploads/storage/areas" && method === "GET") {
        return summaryDeferred.promise;
      }
      if (endpoint === "/api/uploads/storage/cleanup" && method === "GET") {
        return cleanupDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<DashboardUploads />);

    expect(screen.getByText("2 uploads sem uso")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-uploads-status-bar")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Atualizando Armazenamento",
          intent: "info",
        }),
      );
    });

    summaryDeferred.resolve(mockJsonResponse(true, baseSummary));
    cleanupDeferred.resolve(mockJsonResponse(true, cleanupPreviewWithItems));

    await waitFor(() => {
      expect(dismissToastMock).toHaveBeenCalledWith("dashboard-uploads-refresh-toast");
    });
  });

  it("renderiza a seção de armazenamento não utilizado com contagens separadas e linhas mistas", async () => {
    setupApi();

    render(<DashboardUploads />);

    expect(await screen.findByText("Limpeza")).toBeInTheDocument();
    expect(
      screen.getByText("Consumo real por área com base nos arquivos presentes em disco."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 uploads sem uso")).toBeInTheDocument();
    expect(screen.getByText("3 arquivos de variante órfãos")).toBeInTheDocument();
    expect(screen.getByText("1 diretórios de variantes órfãos")).toBeInTheDocument();
    expect(screen.getByText("1 originais soltos (quarentena)")).toBeInTheDocument();
    expect(screen.getByText("2 arquivos de quarentena vencidos para purga")).toBeInTheDocument();
    expect(screen.getByText("unused-1.png")).toBeInTheDocument();
    expect(screen.getByText("old-card.webp")).toBeInTheDocument();
    expect(screen.getByText("orphan-cover.png")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Variante órfã")).toBeInTheDocument();
    expect(screen.getByText("Original solto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CLEANUP_ACTION_LABEL })).toBeInTheDocument();
    const summaryCards = screen
      .getByTestId("dashboard-uploads-summary-grid")
      .querySelectorAll("article");
    expect(summaryCards.length).toBeGreaterThan(0);
    expect(classTokens(summaryCards[0] as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(screen.getByTestId("dashboard-uploads-storage-card"))).toContain(
      "animate-slide-up",
    );
    expect(classTokens(screen.getByTestId("dashboard-uploads-cleanup-card"))).toContain(
      "animate-slide-up",
    );
  });

  it("exibe estado vazio quando não há nada elegível para limpeza", async () => {
    setupApi({
      initialCleanupPreview: emptyCleanupPreview,
      cleanupPreviewAfterRun: emptyCleanupPreview,
    });

    render(<DashboardUploads />);

    await screen.findByText(/Nenhum arquivo eleg.vel para limpeza\./i);
    expect(screen.getByRole("button", { name: CLEANUP_ACTION_LABEL })).toBeDisabled();
  });

  it("abre o modal, menciona variantes órfãs e exige EXCLUIR antes de habilitar a confirmação", async () => {
    setupApi();

    render(<DashboardUploads />);

    fireEvent.click(await screen.findByRole("button", { name: CLEANUP_ACTION_LABEL }));

    const alertDialog = await screen.findByRole("alertdialog");
    expect(within(alertDialog).getByText(/originais soltos para _quarantine/i)).toBeInTheDocument();

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
      expect(screen.getByText(/Nenhum arquivo eleg.vel para limpeza\./i)).toBeInTheDocument();
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
        description: expect.stringContaining("1 originais enviados para quarentena"),
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
        quarantinedLooseOriginalFilesCount: 1,
        deletedQuarantineFilesCount: 0,
        deletedQuarantineDirsCount: 0,
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
        quarantinedTotals: {
          area: "total",
          originalBytes: 300,
          variantBytes: 0,
          totalBytes: 300,
          originalFiles: 1,
          variantFiles: 0,
          totalFiles: 1,
        },
        purgedQuarantineTotals: {
          area: "total",
          originalBytes: 0,
          variantBytes: 0,
          totalBytes: 0,
          originalFiles: 0,
          variantFiles: 0,
          totalFiles: 0,
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

  it("mantem compatibilidade com preview legado sem campos de quarentena", async () => {
    apiFetchMock.mockImplementation(async (_base: string, endpoint: string, request?: RequestInit) => {
      const method = String(request?.method || "GET").toUpperCase();
      if (endpoint === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "u-admin", name: "Admin", username: "admin" });
      }
      if (endpoint === "/api/uploads/storage/areas" && method === "GET") {
        return mockJsonResponse(true, baseSummary);
      }
      if (endpoint === "/api/uploads/storage/cleanup" && method === "GET") {
        return mockJsonResponse(true, {
          generatedAt: "2026-03-01T10:00:00.000Z",
          unusedCount: 1,
          unusedUploadCount: 1,
          orphanedVariantFilesCount: 0,
          orphanedVariantDirsCount: 0,
          totals: {
            area: "total",
            originalBytes: 100,
            variantBytes: 0,
            totalBytes: 100,
            originalFiles: 1,
            variantFiles: 0,
            totalFiles: 1,
          },
          areas: [],
          examples: [],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<DashboardUploads />);

    await screen.findByText("1 uploads sem uso");
    expect(screen.getByText("0 originais soltos (quarentena)")).toBeInTheDocument();
    expect(screen.getByText("0 arquivos de quarentena vencidos para purga")).toBeInTheDocument();
  });
});
