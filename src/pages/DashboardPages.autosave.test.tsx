import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPages from "@/pages/DashboardPages";

const { apiFetchMock, navigateMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
}));
const toastMock = vi.hoisted(() => vi.fn());
const imageLibraryPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: {
    open?: boolean;
    onSave: (payload: { urls: string[]; items: [] }) => void;
  }) => {
    imageLibraryPropsSpy(props);
    if (!props.open) {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() =>
          props.onSave({
            urls: ["/uploads/shared/og-preview.jpg"],
            items: [],
          })
        }
      >
        Mock salvar biblioteca
      </button>
    );
  },
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

const getPutPageCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = call[1];
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/pages" && method === "PUT";
  });

const flushMicrotasks = async () => {
  await Promise.resolve();
};
const waitMs = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);
const renderDashboardPages = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/paginas"]}>
      <DashboardPages />
    </MemoryRouter>,
  );

describe("DashboardPages autosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    toastMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, {
          pages: {
            donations: {
              heroTitle: "",
              heroSubtitle: "",
              costs: [],
              reasonTitle: "",
              reasonIcon: "HeartHandshake",
              reasonText: "",
              reasonNote: "",
              pixKey: "PIX-INIT",
              pixNote: "",
              qrCustomUrl: "",
              pixIcon: "QrCode",
              donorsIcon: "PiggyBank",
              donors: [],
            },
          },
        });
      }
      if (path === "/api/pages" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { pages: body.pages || {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("usa tablist com scroll horizontal invisivel no mobile e triggers sem compressao", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const tablist = screen.getByRole("tablist");
    const tablistClasses = classTokens(tablist);
    expect(tablistClasses).toContain("no-scrollbar");
    expect(tablistClasses).toContain("overflow-x-auto");
    expect(tablistClasses).toContain("md:grid");
    expect(tablistClasses).toContain("md:grid-cols-6");

    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((tab) => {
      expect(classTokens(tab)).toContain("shrink-0");
    });
  });

  it("edita campo e dispara PUT /api/pages apÃ³s debounce", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "chave-pix-autosave" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    expect(getPutPageCalls()).toHaveLength(1);
  });

  it("editar preview dispara PUT /api/pages apos debounce", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Preview/i }));
    apiFetchMock.mockClear();

    const homePreviewInput = await screen.findByLabelText(/URL da imagem/i, {
      selector: "#page-preview-home",
    });
    fireEvent.change(homePreviewInput, { target: { value: "/uploads/shared/home-og.jpg" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls).toHaveLength(1);
    const payload = JSON.parse(String(((putCalls[0][2] || {}) as RequestInit).body || "{}"));
    expect(payload.pages?.home?.shareImage).toBe("/uploads/shared/home-og.jpg");
  });

  it("seleciona imagem via biblioteca no preview e persiste no payload", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Preview/i }));
    apiFetchMock.mockClear();

    const libraryButtons = await screen.findAllByRole("button", { name: /Biblioteca/i });
    fireEvent.click(libraryButtons[0]);

    const saveFromLibrary = await screen.findByRole("button", { name: /Mock salvar biblioteca/i });
    fireEvent.click(saveFromLibrary);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPayload = JSON.parse(
      String(((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit).body || "{}"),
    );
    expect(lastPayload.pages?.home?.shareImage).toBe("/uploads/shared/og-preview.jpg");
  });

  it("reordena perguntas da FAQ e persiste a nova ordem no autosave", async () => {
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, {
          pages: {
            faq: {
              heroTitle: "FAQ",
              heroSubtitle: "Subtitulo",
              introCards: [],
              groups: [
                {
                  title: "Grupo principal",
                  icon: "Info",
                  items: [
                    { question: "Pergunta A", answer: "Resposta A" },
                    { question: "Pergunta B", answer: "Resposta B" },
                  ],
                },
              ],
            },
          },
        });
      }
      if (path === "/api/pages" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { pages: body.pages || {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "FAQ" }));

    const firstQuestionInput = await screen.findByDisplayValue("Pergunta A");
    const secondQuestionInput = await screen.findByDisplayValue("Pergunta B");
    const firstQuestionCard = firstQuestionInput.closest('[draggable="true"]');
    const secondQuestionCard = secondQuestionInput.closest('[draggable="true"]');
    expect(firstQuestionCard).toBeTruthy();
    expect(secondQuestionCard).toBeTruthy();

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    fireEvent.dragStart(secondQuestionCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(firstQuestionCard as HTMLElement, { dataTransfer });
    fireEvent.drop(firstQuestionCard as HTMLElement, { dataTransfer });
    fireEvent.dragEnd(secondQuestionCard as HTMLElement, { dataTransfer });

    const movedQuestionInput = await screen.findByDisplayValue("Pergunta B");
    const originalQuestionInput = await screen.findByDisplayValue("Pergunta A");
    expect(
      movedQuestionInput.compareDocumentPosition(originalQuestionInput) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPutCall = putCalls[putCalls.length - 1];
    const payload = JSON.parse(String(((lastPutCall?.[2] || {}) as RequestInit).body || "{}"));
    expect(payload.pages?.faq?.groups?.[0]?.items?.map((item: { question: string }) => item.question)).toEqual([
      "Pergunta B",
      "Pergunta A",
    ]);
  });

  it("toggle desligado bloqueia autosave, mas botÃ£o manual continua salvando", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const autosaveSwitch = screen.getByRole("switch", { name: "Alternar autosave" });
    fireEvent.click(autosaveSwitch);

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "sem-autosave" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });
    expect(getPutPageCalls()).toHaveLength(0);

    const manualButton = screen.getByRole("button", { name: /Salvar altera/i });
    await act(async () => {
      fireEvent.click(manualButton);
      await flushMicrotasks();
    });

    expect(getPutPageCalls()).toHaveLength(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/P.ginas salvas/i),
      }),
    );
  });

  it("mantÃ©m shareImage existente no payload ao editar conteÃºdo de pÃ¡gina", async () => {
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, {
          pages: {
            about: {
              shareImage: "/uploads/shared/about-og.jpg",
              heroBadge: "",
              heroTitle: "",
              heroSubtitle: "",
              heroBadges: [],
              highlights: [],
              manifestoTitle: "",
              manifestoIcon: "Flame",
              manifestoParagraphs: [],
              pillars: [],
              values: [],
            },
            donations: {
              heroTitle: "",
              heroSubtitle: "",
              costs: [],
              reasonTitle: "",
              reasonIcon: "HeartHandshake",
              reasonText: "",
              reasonNote: "",
              pixKey: "PIX-INIT",
              pixNote: "",
              qrCustomUrl: "",
              pixIcon: "QrCode",
              donorsIcon: "PiggyBank",
              donors: [],
            },
          },
        });
      }
      if (path === "/api/pages" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { pages: body.pages || {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "pix-editado" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const payload = JSON.parse(String(((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit).body || "{}"));
    expect(payload.pages?.about?.shareImage).toBe("/uploads/shared/about-og.jpg");
    expect(payload.pages?.donations?.pixKey).toBe("pix-editado");
  });

  it("save manual com falha exibe toast destrutivo", { timeout: 15000 }, async () => {
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, {
          pages: {
            donations: {
              heroTitle: "",
              heroSubtitle: "",
              costs: [],
              reasonTitle: "",
              reasonIcon: "HeartHandshake",
              reasonText: "",
              reasonNote: "",
              pixKey: "PIX-INIT",
              pixNote: "",
              qrCustomUrl: "",
              pixIcon: "QrCode",
              donorsIcon: "PiggyBank",
              donors: [],
            },
          },
        });
      }
      if (path === "/api/pages" && method === "PUT") {
        return mockJsonResponse(false, { error: "save_failed" }, 500);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "falha-manual" } });

    const manualButton = screen.getByRole("button", { name: /Salvar altera/i });
    await act(async () => {
      fireEvent.click(manualButton);
      await flushMicrotasks();
    });

    await waitFor(
      () => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/Falha ao salvar/i),
            variant: "destructive",
          }),
        );
      },
      { timeout: 7000 },
    );
  });
});



