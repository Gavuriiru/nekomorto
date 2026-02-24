import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSettings from "@/pages/DashboardSettings";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
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

const getPutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "PUT";
  });

const flushMicrotasks = async () => {
  await Promise.resolve();
};
const waitMs = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardSettings autosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: defaultSettings });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, {
          tags: { Action: "Ação" },
          genres: { Comedy: "Comédia" },
          staffRoles: { Director: "Diretor" },
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, {
          projects: [
            {
              tags: ["Action"],
              genres: ["Comedy"],
              animeStaff: [{ role: "Director" }],
            },
          ],
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, {
          items: [
            { id: "instagram", label: "Instagram", icon: "instagram" },
            { id: "discord", label: "Discord", icon: "message-circle" },
          ],
        });
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
      if (path === "/api/tag-translations/anilist-sync" && method === "POST") {
        return mockJsonResponse(true, {
          tags: { Action: "Ação" },
          genres: { Comedy: "Comédia" },
          staffRoles: { Director: "Diretor" },
        });
      }
      if (path === "/api/settings" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { settings: body.settings || defaultSettings });
      }
      if (path === "/api/tag-translations" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, {
          tags: body.tags || {},
          genres: body.genres || {},
          staffRoles: body.staffRoles || {},
        });
      }
      if (path === "/api/link-types" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { items: body.items || [] });
      }
      if (path === "/api/pages" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { pages: body.pages || {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("usa tablist com scroll horizontal invisivel no mobile e triggers sem compressao", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    const tablist = screen.getByRole("tablist");
    const tablistClasses = classTokens(tablist);
    expect(tablistClasses).toContain("no-scrollbar");
    expect(tablistClasses).toContain("overflow-x-auto");
    expect(tablistClasses).toContain("md:grid");
    expect(tablistClasses).toContain("md:grid-cols-8");

    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((tab) => {
      expect(classTokens(tab)).toContain("shrink-0");
    });
  });

  it("editar ajustes gerais dispara apenas PUT /api/settings", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Titulo do card/i);
    fireEvent.change(communityCardTitleInput, { target: { value: "Entre na comunidade" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
  });

  it("editar preview de pagina dispara apenas PUT /api/pages", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Preview páginas/i }));
    apiFetchMock.mockClear();

    const homePreviewInput = await screen.findByLabelText(/URL da imagem/i, {
      selector: "#page-preview-home",
    });
    fireEvent.change(homePreviewInput, { target: { value: "/uploads/shared/home-og.jpg" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/pages");
  });

  it("envia theme.mode no payload de configuracoes", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Titulo do card/i);
    fireEvent.change(communityCardTitleInput, { target: { value: "Tema no payload" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.theme?.mode).toBe("dark");
  });

  it("envia theme.useAccentInProgressCard no payload de configuracoes", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const accentSwitch = await screen.findByRole("switch", {
      name: /Usar cor de destaque no card Em Progresso/i,
    });
    fireEvent.click(accentSwitch);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.theme?.useAccentInProgressCard).toBe(true);
  });

  it("editar tradução dispara apenas PUT /api/tag-translations", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Tradu/i }));
    apiFetchMock.mockClear();

    const translationInput = await screen.findByPlaceholderText("Action");
    fireEvent.change(translationInput, { target: { value: "Acao atualizada" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/tag-translations");
  });

  it("editar tipo de link dispara apenas PUT /api/link-types", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Redes/i }));
    apiFetchMock.mockClear();

    await screen.findByText(/Redes sociais \(Usu/i);
    const linkTypeLabelInput = await screen.findByDisplayValue("Instagram");
    fireEvent.change(linkTypeLabelInput, { target: { value: "Instagram BR" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/link-types");
  });

  it("registra beforeunload quando há alteração pendente", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    addEventListenerSpy.mockClear();
    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    fireEvent.change(siteNameInput, { target: { value: "Nome pendente" } });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(
      addEventListenerSpy.mock.calls.some((call) => call[0] === "beforeunload"),
    ).toBe(true);

    addEventListenerSpy.mockRestore();
  });

  it("renderiza a prévia do footer com nome em uppercase", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    fireEvent.change(siteNameInput, { target: { value: "Neko Teste" } });

    expect(await screen.findByText("NEKO TESTE")).toBeInTheDocument();
  });

  it("reordena redes sociais do footer via drag-and-drop e salva a nova ordem", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Footer/i }));
    await screen.findByRole("heading", { name: /Redes sociais/i });

    apiFetchMock.mockClear();

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    const dragHandle = await screen.findByRole("button", { name: /Arrastar rede Discord/i });
    const topRow = await screen.findByTestId("footer-social-row-0");

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(topRow, { dataTransfer });
    fireEvent.drop(topRow, { dataTransfer });
    fireEvent.dragEnd(dragHandle, { dataTransfer });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    const socialLabels = (payload?.settings?.footer?.socialLinks || []).map((item: { label: string }) =>
      String(item?.label || ""),
    );
    expect(socialLabels[0]).toBe("Discord");
  });
});

