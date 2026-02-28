import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardRedirects from "@/pages/DashboardRedirects";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: defaultSettings,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const waitMs = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

const getPutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "PUT";
  });

describe("DashboardRedirects", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, {
          settings: {
            ...defaultSettings,
            seo: {
              redirects: [],
            },
          },
        });
      }
      if (path === "/api/settings" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { settings: body.settings || defaultSettings });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("renderiza a pagina na rota de redirecionamentos", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/redirecionamentos"]}>
        <DashboardRedirects />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Regras 301/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova regra/i })).toBeInTheDocument();
  });

  it("nao salva automaticamente durante edicao e salva apenas no clique manual", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/redirecionamentos"]}>
        <DashboardRedirects />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Regras 301/i });
    apiFetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Nova regra/i }));
    const fromInput = await screen.findByPlaceholderText("/url-antiga");
    const toInput = screen.getByPlaceholderText("/url-nova ou https://dominio.com/pagina");
    fireEvent.change(fromInput, { target: { value: "/legado" } });
    fireEvent.change(toInput, { target: { value: "https://example.com/novo" } });

    await act(async () => {
      await waitMs(1300);
    });
    expect(getPutCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Salvar redirecionamentos/i }));
    await waitFor(() => {
      expect(getPutCalls()).toHaveLength(1);
    });

    const putCall = getPutCalls()[0];
    expect(putCall[1]).toBe("/api/settings");
    const payload = JSON.parse(String(((putCall[2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.seo?.redirects?.[0]?.from).toBe("/legado");
    expect(payload?.settings?.seo?.redirects?.[0]?.to).toBe("https://example.com/novo");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("bloqueia salvamento quando ha validacao invalida", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/redirecionamentos"]}>
        <DashboardRedirects />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Regras 301/i });
    apiFetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Nova regra/i }));
    const fromInput = await screen.findByPlaceholderText("/url-antiga");
    const toInput = screen.getByPlaceholderText("/url-nova ou https://dominio.com/pagina");
    fireEvent.change(fromInput, { target: { value: "url-invalida" } });
    fireEvent.change(toInput, { target: { value: "mailto:test@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar redirecionamentos/i }));
    await waitFor(() => {
      expect(screen.getByText(/A origem precisa ser um caminho interno iniciado por/i)).toBeInTheDocument();
      expect(screen.getByText(/Destino absoluto precisa usar http ou https/i)).toBeInTheDocument();
    });
    expect(getPutCalls()).toHaveLength(0);
  });
});
