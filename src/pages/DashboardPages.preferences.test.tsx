import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPages, { __testing } from "@/pages/DashboardPages";

const apiFetchMock = vi.hoisted(() => vi.fn());
const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
);

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

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => qrCodeToDataUrlMock(...args),
  },
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/pages" && method === "GET") {
      return mockJsonResponse(true, {
        pages: {
          home: { shareImage: "" },
          projects: { shareImage: "" },
          about: { shareImage: "" },
          donations: { shareImage: "" },
          faq: { shareImage: "" },
          team: { shareImage: "" },
          recruitment: { shareImage: "" },
        },
      });
    }
    if (path === "/api/pages" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { pages?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { pages: payload.pages || {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
  });

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-path">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
};

const ExternalNavigateButton = ({ to, label }: { to: string; label: string }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to, { replace: true })}>
      {label}
    </button>
  );
};

const setBrowserLocation = (path: string) => {
  window.history.replaceState(window.history.state, "", path);
};

describe("DashboardPages query sync", () => {
  beforeEach(() => {
    setBrowserLocation("/");
    window.localStorage.clear();
    apiFetchMock.mockReset();
    __testing.clearDashboardPagesCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aplica aba vinda de ?tab=", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=faq"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "FAQ" })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("aplica aba Prévia vinda de ?tab=preview", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=preview"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Prévia/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=preview");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("atualiza tab na URL ao trocar de aba", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "FAQ" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("?tab=faq");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("estabiliza na ultima aba ao alternar rapidamente", async () => {
    setupApiMock();
    setBrowserLocation("/dashboard/paginas");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    const faqTab = screen.getByRole("tab", { name: "FAQ" });
    const teamTab = screen.getByRole("tab", { name: /Equipe/i });

    fireEvent.mouseDown(faqTab);
    fireEvent.mouseDown(teamTab);
    fireEvent.mouseDown(faqTab);
    fireEvent.mouseDown(teamTab);

    await waitFor(() => {
      expect(teamTab).toHaveAttribute("aria-selected", "true");
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("?tab=team");
    });
    expect(faqTab).toHaveAttribute("aria-selected", "false");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("nao reprocessa a URL ao clicar na aba ja ativa", async () => {
    setupApiMock();
    setBrowserLocation("/dashboard/paginas?tab=faq");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=faq"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    const faqTab = screen.getByRole("tab", { name: "FAQ" });

    fireEvent.mouseDown(faqTab);

    await waitFor(() => {
      expect(faqTab).toHaveAttribute("aria-selected", "true");
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("?tab=faq");
    });
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("aceita alias legado ?tab=preview-paginas e normaliza para ?tab=preview", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=preview-paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Prévia/i })).toHaveAttribute("aria-selected", "true");
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("?tab=preview");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("remove tab da URL quando volta para aba default", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=faq"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Doa/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("reconcilia mudanca externa de URL sem perder a aba ativa correta", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
        <LocationProbe />
        <ExternalNavigateButton to="/dashboard/paginas?tab=team" label="nav-team" />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.click(screen.getByRole("button", { name: "nav-team" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Equipe/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=team");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("tab invalida cai para default e limpa URL", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=invalida"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^Doa/i })).toHaveAttribute("aria-selected", "true");
      expect(window.location.pathname).toBe("/dashboard/paginas");
      expect(window.location.search).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("renderiza somente o painel ativo entre doacoes e previa", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    expect(screen.getByText(/^Custos$/i)).toBeVisible();
    expect(screen.queryByText(/Pr.vias de compartilhamento/i)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pr.via/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pr.vias de compartilhamento/i)).toBeVisible();
      expect(screen.queryByText(/^Custos$/i)).not.toBeInTheDocument();
    });
  });

  it("mantem a aba atual ao apenas focar outro trigger", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /^Doa/i });
    const faqTab = screen.getByRole("tab", { name: "FAQ" });

    expect(donationsTab).toHaveAttribute("aria-selected", "true");
    fireEvent.focus(faqTab);

    expect(donationsTab).toHaveAttribute("aria-selected", "true");
    expect(faqTab).toHaveAttribute("aria-selected", "false");
  });
});
