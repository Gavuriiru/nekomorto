import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const locationState = vi.hoisted(() => ({ pathname: "/dashboard/posts", search: "" }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationState,
  };
});

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown) =>
  ({
    ok,
    json: async () => payload,
  }) as Response;

const emptyGrants = {
  posts: false,
  projetos: false,
  comentarios: false,
  paginas: false,
  uploads: false,
  analytics: false,
  usuarios: false,
  configuracoes: false,
  audit_log: false,
  integracoes: false,
};

describe("Dashboard access redirect", () => {
  beforeEach(() => {
    vi.resetModules();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    toastMock.mockReset();
    locationState.pathname = "/dashboard/posts";
    locationState.search = "";
  });


  it("redirects forbidden dashboard route to first allowed route with toast", async () => {
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        id: "user-1",
    grants: emptyGrants,
      }),
    );
    const { default: RequireAuth } = await import("@/components/RequireAuth");

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Acesso negado",
      }),
    );
  });

  it("redirects admin away from security", async () => {
    locationState.pathname = "/dashboard/seguranca";
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        id: "admin-1",
        accessRole: "admin",
    grants: {
          ...emptyGrants,
          posts: true,
        },
      }),
    );
    const { default: RequireAuth } = await import("@/components/RequireAuth");

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("keeps security route for owner", async () => {
    locationState.pathname = "/dashboard/seguranca";
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        id: "owner-1",
        accessRole: "owner_primary",
    grants: emptyGrants,
      }),
    );
    const { default: RequireAuth } = await import("@/components/RequireAuth");

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    expect(await screen.findByText("Protected")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("keeps route when grant allows access", async () => {
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        id: "user-1",
    grants: {
          ...emptyGrants,
          posts: true,
        },
      }),
    );
    const { default: RequireAuth } = await import("@/components/RequireAuth");

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    expect(await screen.findByText("Protected")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalledWith("/dashboard", { replace: true });
  });
});
