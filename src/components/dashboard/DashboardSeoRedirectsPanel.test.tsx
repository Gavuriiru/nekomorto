import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSeoRedirectsPanel from "@/components/dashboard/DashboardSeoRedirectsPanel";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
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

const waitMs = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const expectStableDashboardActionButton = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-background",
      "font-semibold",
      "hover:bg-primary/5",
      "hover:text-foreground",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const getPutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "PUT";
  });

describe("DashboardSeoRedirectsPanel", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
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
        return mockJsonResponse(true, {
          settings:
            ((options as { body?: string; json?: unknown })?.json as { settings?: unknown })
              ?.settings || defaultSettings,
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("renderiza o painel de SEO e redirecionamentos", async () => {
    render(<DashboardSeoRedirectsPanel />);

    expect(
      await screen.findByRole("heading", { name: /SEO e redirecionamentos/i }),
    ).toBeInTheDocument();
    const newRuleButton = screen.getByRole("button", { name: /Nova regra/i });
    const saveSeoButton = screen.getByRole("button", { name: /Salvar SEO/i });

    expectStableDashboardActionButton(newRuleButton, "h-10");
    expectStableDashboardActionButton(saveSeoButton, "h-10");
    expect(saveSeoButton).toBeDisabled();
  });

  it("nao salva automaticamente durante edicao e salva apenas no clique manual", async () => {
    render(<DashboardSeoRedirectsPanel />);

    await screen.findByRole("heading", { name: /SEO e redirecionamentos/i });
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

    fireEvent.click(screen.getByRole("button", { name: /Salvar SEO/i }));
    await waitFor(() => {
      expect(getPutCalls()).toHaveLength(1);
    });

    const putCall = getPutCalls()[0];
    expect(putCall[1]).toBe("/api/settings");
    const payload = (
      (putCall[2] || {}) as { json?: { settings?: { seo?: { redirects?: SeoRedirectLike[] } } } }
    ).json;
    expect(payload?.settings?.seo?.redirects?.[0]?.from).toBe("/legado");
    expect(payload?.settings?.seo?.redirects?.[0]?.to).toBe("https://example.com/novo");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("bloqueia salvamento quando ha validacao invalida", async () => {
    render(<DashboardSeoRedirectsPanel />);

    await screen.findByRole("heading", { name: /SEO e redirecionamentos/i });
    apiFetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Nova regra/i }));
    const fromInput = await screen.findByPlaceholderText("/url-antiga");
    const toInput = screen.getByPlaceholderText("/url-nova ou https://dominio.com/pagina");
    fireEvent.change(fromInput, { target: { value: "url-invalida" } });
    fireEvent.change(toInput, { target: { value: "mailto:test@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar SEO/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/A origem precisa ser um caminho interno iniciado por/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Destino absoluto precisa usar http ou https/i)).toBeInTheDocument();
    });
    expect(getPutCalls()).toHaveLength(0);
  });

  it("mantem o label no stack default e a mensagem de erro no stack compacto", async () => {
    render(<DashboardSeoRedirectsPanel />);

    await screen.findByRole("heading", { name: /SEO e redirecionamentos/i });

    fireEvent.click(screen.getByRole("button", { name: /Nova regra/i }));
    const fromInput = await screen.findByPlaceholderText("/url-antiga");
    fireEvent.change(fromInput, { target: { value: "url-invalida" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar SEO/i }));

    const errorMessage = await screen.findByText(
      /A origem precisa ser um caminho interno iniciado por/i,
    );

    expect(fromInput.parentElement?.className).toContain("gap-2");
    expect(fromInput.parentElement?.parentElement?.className).toContain("gap-2");
    expect(errorMessage.parentElement).toBe(fromInput.parentElement);
  });
});

type SeoRedirectLike = {
  from?: string;
  to?: string;
};
