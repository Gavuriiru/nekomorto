import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings } from "@/hooks/site-settings-context";
import DashboardSettings, { __testing } from "@/pages/DashboardSettings";

const { apiFetchMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockReset();
  refreshMock.mockClear();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/settings" && method === "GET") {
      return mockJsonResponse(true, { settings: defaultSettings });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, {
        tags: {},
        genres: {},
        staffRoles: {},
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }
    if (path === "/api/settings" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { settings?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { settings: payload.settings || defaultSettings });
    }
    if (path === "/api/tag-translations" && method === "PUT") {
      return mockJsonResponse(true, {
        tags: {},
        genres: {},
        staffRoles: {},
      });
    }
    if (path === "/api/link-types" && method === "PUT") {
      return mockJsonResponse(true, { items: [] });
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

describe("DashboardSettings query sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    refreshMock.mockClear();
    __testing.clearDashboardSettingsCache();
  });

  it("aplica aba vinda de ?tab=", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=traducoes"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Tradu/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=traducoes");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("abre a aba SEO diretamente em /dashboard/configuracoes?tab=seo", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=seo"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /SEO/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-path").textContent).toBe("/dashboard/configuracoes");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=seo");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("abre a aba Layout diretamente em /dashboard/configuracoes?tab=layout", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=layout"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Layout/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-path").textContent).toBe("/dashboard/configuracoes");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=layout");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("interpreta a aba legada navbar como Layout", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=navbar"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Layout/i })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("interpreta a aba legada footer como Layout", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=footer"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Layout/i })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("tab invalida cai para default e limpa a URL", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=invalida"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Geral/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("redireciona legado ?tab=preview-paginas para /dashboard/paginas?tab=preview", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=preview-paginas"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByTestId("location-path").textContent).toBe("/dashboard/paginas");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=preview");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("troca de aba atualiza ?tab= e aba default remove o parametro", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Tradu/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("tab=traducoes");
    });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Geral/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("mostra favicon e imagem de compartilhamento em SEO, não em Geral", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    expect(screen.getByRole("tab", { name: /Geral/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/^Favicon$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Imagem de compartilhamento$/i)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /SEO/i }));

    expect(await screen.findByRole("heading", { name: /Metadados visuais/i })).toBeInTheDocument();
    expect(screen.getByText(/^Favicon$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Imagem de compartilhamento$/i)).toBeInTheDocument();
  });

  it("reúne header e footer na aba Layout", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Layout/i }));

    expect(await screen.findByRole("heading", { name: /Header \/ Navegação/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Footer$/i })).toBeInTheDocument();
    const menuHeading = screen.getByRole("heading", { name: /Links do menu/i });
    const menuCardContent = menuHeading.closest("div.space-y-6") as HTMLElement | null;
    expect(menuCardContent).not.toBeNull();
    expect(within(menuCardContent as HTMLElement).getByDisplayValue("Projetos")).toBeInTheDocument();

    const footerContentHeading = screen.getByRole("heading", { name: /Conteúdo do footer/i });
    const footerCardContent = footerContentHeading.closest("div.space-y-4") as HTMLElement | null;
    expect(footerCardContent).not.toBeNull();
    expect(
      within(footerCardContent as HTMLElement).getByDisplayValue(defaultSettings.footer.brandDescription),
    ).toBeInTheDocument();
  });

  it("simplifica a aba Leitor e remove o resumo introdutório e campos legados", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Leitor/i }));

    expect(await screen.findByRole("heading", { name: /^Mangá$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Webtoon$/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Presets globais do leitor/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Precedência: preset global do tipo do projeto/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Limite de preview/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/URL de compra/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Preço exibido/i)).not.toBeInTheDocument();
  });
});
