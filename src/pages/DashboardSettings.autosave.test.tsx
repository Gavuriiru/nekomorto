import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { Tabs } from "@/components/ui/tabs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import { DashboardSettingsTranslationsTab } from "@/components/dashboard/settings/DashboardSettingsTranslationsTab";
import { DashboardSettingsProvider } from "@/components/dashboard/settings/dashboard-settings-context";
import type { DashboardSettingsContextValue } from "@/components/dashboard/settings/dashboard-settings-types";
import { defaultSettings } from "@/hooks/site-settings-context";
import DashboardSettings, { __testing } from "@/pages/DashboardSettings";
import type { SiteSettings } from "@/types/site-settings";

const { apiFetchMock, dismissToastMock, navigateMock, refreshMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  dismissToastMock: vi.fn(),
  navigateMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
  toastMock: vi.fn(),
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

vi.mock("@/components/ui/use-toast", () => ({
  dismissToast: (...args: unknown[]) => dismissToastMock(...args),
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({
    dismiss: dismissToastMock,
    toast: toastMock,
    toasts: [],
  }),
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

const deferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const cloneSettings = (value: SiteSettings): SiteSettings =>
  JSON.parse(JSON.stringify(value)) as SiteSettings;

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

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
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const renderDashboardSettings = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
      <DashboardSettings />
    </MemoryRouter>,
  );

let settingsResponse: SiteSettings;

describe("DashboardSettings autosave", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();
    dismissToastMock.mockReset();
    toastMock.mockReset();
    settingsResponse = cloneSettings(defaultSettings);

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, {
          id: "1",
          name: "Admin",
          username: "admin",
        });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: settingsResponse });
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
      if (path === "/api/tag-translations/anilist-sync" && method === "POST") {
        return mockJsonResponse(true, {
          tags: { Action: "Ação" },
          genres: { Comedy: "Comédia" },
          staffRoles: { Director: "Diretor" },
        });
      }
      if (path === "/api/settings" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, {
          settings: body.settings || settingsResponse,
        });
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
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("usa tablist com scroll horizontal invisivel no mobile e triggers sem compressao", async () => {
    renderDashboardSettings();
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

  it("mantem o botao manual desabilitado enquanto as configuracoes carregam", async () => {
    __testing.clearDashboardSettingsCache();
    const settingsLoad = createDeferred<Response>();
    const fallbackApiFetch = apiFetchMock.getMockImplementation();
    apiFetchMock.mockImplementation((...args: unknown[]) => {
      const path = String(args[1] || "");
      const options = args[2] as RequestInit | undefined;
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/settings" && method === "GET") {
        return settingsLoad.promise;
      }
      return fallbackApiFetch?.(...args);
    });

    renderDashboardSettings();
    const manualButton = await screen.findByRole("button", { name: /Salvar ajustes/i });
    expect(manualButton).toBeDisabled();

    await act(async () => {
      settingsLoad.resolve(mockJsonResponse(true, { settings: settingsResponse }));
      await flushMicrotasks();
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(manualButton).not.toBeDisabled();
    });
  });

  it("nao mostra falha ao salvar quando o autosave em andamento conclui com sucesso", async () => {
    const settingsSave = createDeferred<void>();
    let startedSettingsSave = false;
    const fallbackApiFetch = apiFetchMock.getMockImplementation();
    apiFetchMock.mockImplementation((...args: unknown[]) => {
      const path = String(args[1] || "");
      const options = args[2] as RequestInit | undefined;
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/settings" && method === "PUT") {
        startedSettingsSave = true;
        const body = JSON.parse(String(options?.body || "{}"));
        return settingsSave.promise.then(() =>
          mockJsonResponse(true, { settings: body.settings || settingsResponse }),
        );
      }
      return fallbackApiFetch?.(...args);
    });

    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });
    const manualButton = screen.getByRole("button", { name: /Salvar ajustes/i });

    toastMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Título do card/i);
    fireEvent.change(communityCardTitleInput, {
      target: { value: "Autosave em andamento" },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    expect(startedSettingsSave).toBe(true);
    fireEvent.click(manualButton);
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Falha ao salvar" }),
    );

    await act(async () => {
      settingsSave.resolve();
      await flushMicrotasks();
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(manualButton).not.toBeDisabled();
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Falha ao salvar" }),
    );
  });

  it("editar ajustes gerais dispara apenas PUT /api/settings", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Título do card/i);
    fireEvent.change(communityCardTitleInput, {
      target: { value: "Entre na comunidade" },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
  }, 10000);

  it("bloqueia save manual antes de resolver settings e salva após o carregamento", async () => {
    __testing.clearDashboardSettingsCache();
    const settingsDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, {
          id: "1",
          name: "Admin",
          username: "admin",
        });
      }
      if (path === "/api/settings" && method === "GET") {
        return settingsDeferred.promise;
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/tag-translations/anilist-sync" && method === "POST") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (path === "/api/settings" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, {
          settings: body.settings || settingsResponse,
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    const loadingSaveButton = screen.getByRole("button", { name: /Salvar ajustes/i });
    expect(loadingSaveButton).toBeDisabled();
    fireEvent.click(loadingSaveButton);
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Falha ao salvar" }),
    );

    await act(async () => {
      settingsDeferred.resolve(mockJsonResponse(true, { settings: settingsResponse }));
      await flushMicrotasks();
    });
    await screen.findByText("Nome do site");

    apiFetchMock.mockClear();
    toastMock.mockClear();
    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    fireEvent.change(siteNameInput, { target: { value: "Salvar depois do load" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ajustes/i }));

    await waitFor(() => {
      expect(getPutCalls().filter((call) => call[1] === "/api/settings")).toHaveLength(1);
    });
    expect(toastMock).toHaveBeenCalledWith({ title: "Configurações salvas" });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Falha ao salvar" }),
    );
  }, 10000);

  it("troca de aba nao força save imediato durante blur interno", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    const seoTab = screen.getByRole("tab", { name: /SEO/i });

    apiFetchMock.mockClear();
    fireEvent.change(siteNameInput, { target: { value: "Troca fluida" } });
    fireEvent.blur(siteNameInput, { relatedTarget: seoTab });
    fireEvent.mouseDown(seoTab);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /SEO/i })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPutCalls()).toHaveLength(0);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
  }, 10000);

  it("blur para fora da tela faz flush imediato das configuracoes pendentes", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);

    apiFetchMock.mockClear();
    fireEvent.change(siteNameInput, { target: { value: "Saindo da tela" } });
    fireEvent.blur(siteNameInput, { relatedTarget: outsideButton });

    await waitFor(() => {
      expect(getPutCalls().filter((call) => call[1] === "/api/settings")).toHaveLength(1);
    });

    document.body.removeChild(outsideButton);
  }, 10000);

  it("envia theme.mode no payload de configuracoes", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Título do card/i);
    fireEvent.change(communityCardTitleInput, {
      target: { value: "Tema no payload" },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][1]).toBe("/api/settings");
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.theme?.mode).toBe("dark");
  }, 10000);

  it("envia theme.useAccentInProgressCard no payload de configuracoes", async () => {
    renderDashboardSettings();
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
  }, 10000);

  it("limpa campos legados do leitor no payload de configuracoes", async () => {
    settingsResponse = cloneSettings(defaultSettings);
    settingsResponse.reader.projectTypes.manga.previewLimit = 3;
    settingsResponse.reader.projectTypes.manga.purchaseUrl = "https://example.com/manga";
    settingsResponse.reader.projectTypes.manga.purchasePrice = "R$ 9,90";
    settingsResponse.reader.projectTypes.webtoon.previewLimit = 5;
    settingsResponse.reader.projectTypes.webtoon.purchaseUrl = "https://example.com/webtoon";
    settingsResponse.reader.projectTypes.webtoon.purchasePrice = "R$ 14,90";

    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    apiFetchMock.mockClear();
    const communityCardTitleInput = await screen.findByLabelText(/Título do card/i);
    fireEvent.change(communityCardTitleInput, {
      target: { value: "Sanitizar leitor" },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.reader?.projectTypes?.manga?.previewLimit).toBeNull();
    expect(payload?.settings?.reader?.projectTypes?.manga?.purchaseUrl).toBe("");
    expect(payload?.settings?.reader?.projectTypes?.manga?.purchasePrice).toBe("");
    expect(payload?.settings?.reader?.projectTypes?.webtoon?.previewLimit).toBeNull();
    expect(payload?.settings?.reader?.projectTypes?.webtoon?.purchaseUrl).toBe("");
    expect(payload?.settings?.reader?.projectTypes?.webtoon?.purchasePrice).toBe("");
  }, 10000);

  it("envia os novos campos de preset do leitor no payload de configuracoes", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Leitor/i }));
    const mangaCard = await screen.findByTestId("reader-preset-manga");

    apiFetchMock.mockClear();
    fireEvent.click(
      within(mangaCard).getByRole("combobox", {
        name: "Selecionar comportamento do header do site",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Estática" }));
    fireEvent.click(within(mangaCard).getByRole("switch", { name: /Rodap.* do site/i }));

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls).toHaveLength(1);
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload?.settings?.reader?.projectTypes?.manga?.chromeMode).toBe("default");
    expect(payload?.settings?.reader?.projectTypes?.manga?.viewportMode).toBe("viewport");
    expect(payload?.settings?.reader?.projectTypes?.manga?.siteHeaderVariant).toBe("static");
    expect(payload?.settings?.reader?.projectTypes?.manga?.showSiteFooter).toBe(false);
  }, 10000);

  it("editar tradução dispara apenas PUT /api/tag-translations", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Tradu/i }));
    apiFetchMock.mockClear();

    const translationInput = await screen.findByPlaceholderText("Action");
    fireEvent.change(translationInput, {
      target: { value: "Acao atualizada" },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutCalls();
    expect(putCalls.filter((call) => call[1] === "/api/tag-translations")).toHaveLength(1);
    expect(putCalls.some((call) => call[1] === "/api/link-types")).toBe(false);
  }, 10000);

  it("carrega mais tags automaticamente ao aproximar o scroll do fim", async () => {
    const largeTags = Array.from(
      { length: 90 },
      (_, index) => `Tag ${String(index + 1).padStart(2, "0")}`,
    );
    const contextValue = {
      filteredTags: largeTags,
      filteredGenres: [],
      filteredStaffRoles: [],
      genreQuery: "",
      genreTranslations: {},
      handleSaveTranslations: vi.fn(),
      hasResolvedTranslations: true,
      isSavingTranslations: false,
      isSyncingAniList: false,
      newGenre: "",
      newStaffRole: "",
      newTag: "",
      setGenreQuery: vi.fn(),
      setGenreTranslations: vi.fn(),
      setNewGenre: vi.fn(),
      setNewStaffRole: vi.fn(),
      setNewTag: vi.fn(),
      setStaffRoleQuery: vi.fn(),
      setStaffRoleTranslations: vi.fn(),
      setTagQuery: vi.fn(),
      setTagTranslations: vi.fn(),
      staffRoleQuery: "",
      staffRoleTranslations: {},
      syncAniListTerms: vi.fn(),
      tagQuery: "",
      tagTranslations: Object.fromEntries(largeTags.map((tag) => [tag, ""])),
    } as unknown as DashboardSettingsContextValue;

    render(
      <Tabs value="traducoes">
        <DashboardSettingsProvider value={contextValue}>
          <DashboardSettingsTranslationsTab />
        </DashboardSettingsProvider>
      </Tabs>,
    );

    expect(screen.getByPlaceholderText("Tag 01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar mais/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Tag 85")).not.toBeInTheDocument();

    const tagList = screen.getByRole("region", { name: "Lista de traduções de tags" });
    Object.defineProperty(tagList, "scrollTop", { configurable: true, value: 170 });
    Object.defineProperty(tagList, "clientHeight", { configurable: true, value: 120 });
    Object.defineProperty(tagList, "scrollHeight", { configurable: true, value: 440 });
    fireEvent.scroll(tagList);

    expect(await screen.findByPlaceholderText("Tag 85")).toBeInTheDocument();
  });

  it("editar tipo de link dispara apenas PUT /api/link-types", async () => {
    renderDashboardSettings();
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
    expect(putCalls.filter((call) => call[1] === "/api/link-types")).toHaveLength(1);
  }, 10000);

  it("registra beforeunload quando há alteração pendente", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    fireEvent.change(siteNameInput, { target: { value: "Nome pendente" } });
    await act(async () => {
      await flushMicrotasks();
    });

    await waitFor(() => {
      const beforeUnloadEvent = new Event("beforeunload", {
        cancelable: true,
      }) as BeforeUnloadEvent;
      window.dispatchEvent(beforeUnloadEvent);
      expect(beforeUnloadEvent.defaultPrevented).toBe(true);
    });
  });

  it("renderiza a prévia do footer com nome em uppercase", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    const siteNameInput = await screen.findByDisplayValue(defaultSettings.site.name);
    fireEvent.change(siteNameInput, { target: { value: "Neko Teste" } });

    expect(await screen.findByText("NEKO TESTE")).toBeInTheDocument();
  });

  it("reordena redes sociais do footer via drag-and-drop e salva a nova ordem", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Layout/i }));
    await screen.findByRole("heading", { name: /Redes sociais/i });

    apiFetchMock.mockClear();

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    const dragHandle = await screen.findByRole("button", {
      name: /Arrastar rede Discord/i,
    });
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
    const socialLabels = (payload?.settings?.footer?.socialLinks || []).map(
      (item: { label: string }) => String(item?.label || ""),
    );
    expect(socialLabels[0]).toBe("Discord");
  }, 10000);

  it("aplica reveal ao bloco de autosave no header", async () => {
    renderDashboardSettings();
    const heading = await screen.findByRole("heading", { name: /Painel/i });

    const autosaveReveal = screen.getByTestId("dashboard-settings-autosave-reveal");
    const tokens = classTokens(autosaveReveal);
    const rootSection = heading.closest("section");
    const headerBadge = screen.getByText("Configura\u00e7\u00f5es");
    const headerBadgeReveal = headerBadge.parentElement;

    expect(tokens).toContain("animate-slide-up");
    expect(tokens).toContain("opacity-0");
    expect(tokens).toContain("w-full");
    expect(tokens).toContain("sm:w-auto");
    expect(autosaveReveal).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.headerActionsMs}ms`,
    });
    expect(rootSection).not.toBeNull();
    expect(classTokens(rootSection as HTMLElement)).not.toContain("reveal");
    expect(rootSection).not.toHaveAttribute("data-reveal");
    expect(headerBadgeReveal).not.toBeNull();
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal");
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal-delay-1");
    expect(headerBadgeReveal).toHaveAttribute("data-reveal");
  });
});
