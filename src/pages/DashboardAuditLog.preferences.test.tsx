import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAuditLog, { __testing } from "@/pages/DashboardAuditLog";

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
    headers: new Headers(),
    json: async () => payload,
    blob: async () => new Blob([""], { type: "text/csv" }),
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

const setupApiMock = ({
  entries = [],
  limit = 50,
  total = 0,
}: {
  entries?: unknown[];
  limit?: number;
  total?: number;
} = {}) => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (String(path).startsWith("/api/audit-log?") && method === "GET") {
      return mockJsonResponse(true, { entries, page: 1, limit, total });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getLastAuditParams = () => {
  const calls = apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "GET" && path.startsWith("/api/audit-log?");
  });
  const lastPath = String(calls[calls.length - 1]?.[1] || "");
  return new URLSearchParams(lastPath.split("?")[1] || "");
};

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
  });

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const getLocationParams = () =>
  new URLSearchParams(
    String(screen.getByTestId("location-search").textContent || "").replace(/^\?/, ""),
  );

const NavigateCleanQuery = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard/audit-log")}>
      Limpar query
    </button>
  );
};

describe("DashboardAuditLog query sync", () => {
  beforeEach(() => {
    __testing.clearAuditResultsCache();
    apiFetchMock.mockReset();
    toastMock.mockReset();
    toastMock.mockReturnValue("dashboard-audit-refresh-toast");
    dismissToastMock.mockReset();
  });

  it("usa defaults quando URL inicial esta limpa", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("50");
      expect(params.get("status")).toBeNull();
    });
    expect(toastMock).not.toHaveBeenCalled();
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("mantem query explicita da URL como fonte de verdade", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=3&limit=100&status=denied"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("3");
      expect(params.get("limit")).toBe("100");
      expect(params.get("status")).toBe("denied");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("mantem a tabela visivel enquanto atualiza os resultados manualmente", async () => {
    const refreshDeferred = createDeferredResponse();
    let auditCalls = 0;

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (String(path).startsWith("/api/audit-log?") && method === "GET") {
        auditCalls += 1;
        if (auditCalls === 1) {
          return mockJsonResponse(true, {
            entries: [
              {
                id: "audit-1",
                ts: "2026-03-01T12:00:00.000Z",
                actorId: "1",
                actorName: "Admin",
                ip: "127.0.0.1",
                action: "posts.update",
                resource: "posts",
                resourceId: "post-1",
                status: "success",
                requestId: null,
                meta: {},
              },
            ],
            page: 1,
            limit: 50,
            total: 1,
          });
        }
        return refreshDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Admin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText(/Atualizando resultados/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Atualizando resultados",
          intent: "info",
        }),
      );
    });

    refreshDeferred.resolve(
      mockJsonResponse(true, {
        entries: [
          {
            id: "audit-2",
            ts: "2026-03-01T12:05:00.000Z",
            actorId: "2",
            actorName: "Moderator",
            ip: "127.0.0.2",
            action: "comments.delete",
            resource: "comments",
            resourceId: "comment-1",
            status: "failed",
            requestId: null,
            meta: {},
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
      }),
    );

    expect(await screen.findByText("Moderator")).toBeInTheDocument();
    expect(dismissToastMock).toHaveBeenCalledWith("dashboard-audit-refresh-toast");
  });

  it("limpa query e volta para defaults", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=3&limit=100&status=denied"]}>
        <DashboardAuditLog />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("50");
      expect(params.get("status")).toBeNull();
      expect(params.get("q")).toBeNull();
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("renderiza links numericos e navega para uma pagina especifica", async () => {
    setupApiMock({ total: 250, limit: 50 });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    expect(screen.getByText("Página 1 de 5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "5" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "3" }));

    await waitFor(() => {
      expect(getLocationParams().get("page")).toBe("3");
      expect(getLocationParams().get("limit")).toBe("50");
    });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("3");
      expect(params.get("limit")).toBe("50");
    });
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("aria-current", "page");
  });

  it("usa janela compacta com reticencias quando ha muitas paginas", async () => {
    setupApiMock({ total: 1000, limit: 50 });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=10&limit=50"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    expect(screen.getByText("Página 10 de 20")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "9" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "10" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "11" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "20" })).toBeInTheDocument();
    expect(screen.getAllByText("Mais páginas")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "15" })).not.toBeInTheDocument();
  });

  it("desabilita anterior e proxima nas bordas da paginacao", async () => {
    setupApiMock({ total: 250, limit: 50 });

    const firstPage = render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=1&limit=50"]}>
        <DashboardAuditLog />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    const previousLink = screen.getByRole("link", { name: "Ir para a página anterior" });
    const nextLink = screen.getByRole("link", { name: "Ir para a próxima página" });

    expect(previousLink).toHaveAttribute("aria-disabled", "true");
    expect(previousLink).toHaveAttribute("tabindex", "-1");
    expect(nextLink).toHaveAttribute("aria-disabled", "false");

    fireEvent.click(previousLink);

    await waitFor(() => {
      expect(getLocationParams().get("page")).toBe("1");
      expect(getLastAuditParams().get("page")).toBe("1");
    });

    firstPage.unmount();

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=5&limit=50"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByText("Página 5 de 5");
    const lastPageNextLink = screen.getByRole("link", { name: "Ir para a próxima página" });
    expect(lastPageNextLink).toHaveAttribute("aria-disabled", "true");
    expect(lastPageNextLink).toHaveAttribute("tabindex", "-1");
  });
});
