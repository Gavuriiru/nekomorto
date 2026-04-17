import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import DashboardPages, { __testing } from "@/pages/DashboardPages";

const { apiFetchMock, navigateMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
}));
const toastMock = vi.hoisted(() => vi.fn());
const imageLibraryPropsSpy = vi.hoisted(() => vi.fn());
const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
);

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: {
    open?: boolean;
    onSave: (payload: { urls: string[]; items: Array<{ altText?: string }> }) => void;
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
            items: [{ altText: "Alt da biblioteca" }],
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

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => qrCodeToDataUrlMock(...args),
  },
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
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const expectDashboardActionButtonTokens = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining(["rounded-xl", "bg-background", "font-semibold", sizeToken]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};
const renderDashboardPages = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/paginas"]}>
      <DashboardPages />
    </MemoryRouter>,
  );

describe("DashboardPages autosave", () => {
  beforeEach(() => {
    __testing.clearDashboardPagesCache();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/paginas");
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
              monthlyGoalRaised: "",
              monthlyGoalTarget: "",
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

  it("usa o botao estavel nos adders compactos da pagina sobre", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sobre" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Sobre" })).toHaveAttribute("aria-selected", "true");
    });

    const addBadgeButton = await screen.findByRole("button", { name: /Adicionar badge/i });
    expectDashboardActionButtonTokens(addBadgeButton, "h-9");
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

  it("edita campo e dispara PUT /api/pages após debounce", async () => {
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

  it("troca de aba nao força save imediato durante blur interno", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    const previewTab = screen.getByRole("tab", { name: /Pr.via/i });

    apiFetchMock.mockClear();
    fireEvent.change(pixInput, { target: { value: "pix-sem-trava" } });
    fireEvent.blur(pixInput, { relatedTarget: previewTab });
    fireEvent.mouseDown(previewTab);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Pr.via/i })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPutPageCalls()).toHaveLength(0);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    expect(getPutPageCalls()).toHaveLength(1);
  });

  it("blur para fora da tela faz flush imediato das paginas pendentes", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);

    apiFetchMock.mockClear();
    fireEvent.change(pixInput, { target: { value: "pix-fora" } });
    fireEvent.blur(pixInput, { relatedTarget: outsideButton });

    await waitFor(() => {
      expect(getPutPageCalls()).toHaveLength(1);
    });

    document.body.removeChild(outsideButton);
  });

  it("editar preview dispara PUT /api/pages apos debounce", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Prévia/i }));
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
    expect(payload.pages?.home?.shareImageAlt).toBe("Imagem de compartilhamento da página inicial");
  });

  it("seleciona imagem via biblioteca no preview e persiste no payload", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Prévia/i }));
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
    expect(lastPayload.pages?.home?.shareImageAlt).toBe("Alt da biblioteca");
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
    expect(classTokens(firstQuestionCard as HTMLElement)).toContain("hover:border-primary/40");

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    fireEvent.dragStart(secondQuestionCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(firstQuestionCard as HTMLElement, { dataTransfer });
    await waitFor(() => {
      expect(classTokens(firstQuestionCard as HTMLElement)).toContain("border-primary/40");
      expect(classTokens(firstQuestionCard as HTMLElement)).toContain("bg-primary/5");
    });
    fireEvent.drop(firstQuestionCard as HTMLElement, { dataTransfer });
    fireEvent.dragEnd(secondQuestionCard as HTMLElement, { dataTransfer });

    const movedQuestionInput = await screen.findByDisplayValue("Pergunta B");
    const originalQuestionInput = await screen.findByDisplayValue("Pergunta A");
    const movedQuestionCard = movedQuestionInput.closest('[draggable="true"]');
    expect(movedQuestionCard).toBeTruthy();
    expect(classTokens(movedQuestionCard as HTMLElement)).not.toContain("bg-primary/5");
    expect(
      movedQuestionInput.compareDocumentPosition(originalQuestionInput) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPutCall = putCalls[putCalls.length - 1];
    const payload = JSON.parse(String(((lastPutCall?.[2] || {}) as RequestInit).body || "{}"));
    expect(
      payload.pages?.faq?.groups?.[0]?.items?.map((item: { question: string }) => item.question),
    ).toEqual(["Pergunta B", "Pergunta A"]);
  });

  it("toggle desligado bloqueia autosave, mas botão manual continua salvando", async () => {
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

  it("mantém shareImage existente no payload ao editar conteúdo de página", async () => {
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
              shareImageAlt: "Capa da pagina sobre",
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
    const payload = JSON.parse(
      String(((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit).body || "{}"),
    );
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

  it("aplica reveal ao bloco de autosave no header", async () => {
    renderDashboardPages();
    const heading = await screen.findByRole("heading", { name: /Gerenciar/i });

    const autosaveReveal = screen.getByTestId("dashboard-pages-autosave-reveal");
    const tokens = classTokens(autosaveReveal);
    const rootSection = heading.closest("section");
    const headerBadge = screen.getByText("P\u00e1ginas");
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

  it("normaliza a meta mensal e persiste os novos campos sem perder os dados do Pix", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const raisedInput = screen.getByLabelText(/Arrecadado no m.s/i);
    const targetInput = screen.getByLabelText(/Meta do m.s/i);
    const supportersInput = screen.getByLabelText(/Apoiadores no m.s/i);
    const goalNoteInput = screen.getByLabelText(/Nota da meta/i);

    apiFetchMock.mockClear();

    fireEvent.change(raisedInput, {
      target: { value: "1234.5abc" },
    });
    expect(raisedInput).toHaveValue("1.234,5");

    fireEvent.change(targetInput, {
      target: { value: "2500.75" },
    });
    expect(targetInput).toHaveValue("2.500,75");

    fireEvent.change(supportersInput, {
      target: { value: "0012abc" },
    });
    expect(supportersInput).toHaveValue("12");

    fireEvent.change(goalNoteInput, {
      target: { value: "  VPS + dominio  " },
    });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    let payload: any;
    await waitFor(() => {
      const matchingPayload = getPutPageCalls()
        .map((call) => JSON.parse(String(((call[2] || {}) as RequestInit).body || "{}")))
        .find(
          (candidate) =>
            candidate.pages?.donations?.monthlyGoalRaised === "1.234,50" &&
            candidate.pages?.donations?.monthlyGoalTarget === "2.500,75" &&
            candidate.pages?.donations?.monthlyGoalSupporters === "12" &&
            candidate.pages?.donations?.monthlyGoalNote === "VPS + dominio",
        );

      expect(matchingPayload).toBeDefined();
      payload = matchingPayload;
    });

    expect(payload.pages?.donations?.monthlyGoalRaised).toBe("1.234,50");
    expect(payload.pages?.donations?.monthlyGoalTarget).toBe("2.500,75");
    expect(payload.pages?.donations?.monthlyGoalSupporters).toBe("12");
    expect(payload.pages?.donations?.monthlyGoalNote).toBe("VPS + dominio");
    expect(payload.pages?.donations?.pixKey).toBe("PIX-INIT");
  });

  it("mantém foco ao editar títulos e nomes nos blocos reordenáveis de doações", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const costsEditor = screen.getByText("Custos").closest("div")?.parentElement;
    const cryptoEditor = screen.getByTestId("donations-crypto-editor");
    const donorsEditor = screen.getByText("Doadores").closest("div")?.parentElement;

    expect(costsEditor).not.toBeNull();
    expect(donorsEditor).not.toBeNull();

    const addCostButton = within(costsEditor as HTMLElement).getByRole("button", {
      name: /Adicionar/i,
    });
    const addCryptoButton = within(cryptoEditor).getByRole("button", { name: /Adicionar/i });
    const addDonorButton = within(donorsEditor as HTMLElement).getByRole("button", {
      name: /Adicionar/i,
    });
    expectDashboardActionButtonTokens(addCostButton, "h-9");
    expectDashboardActionButtonTokens(addCryptoButton, "h-9");
    expectDashboardActionButtonTokens(addDonorButton, "h-9");

    fireEvent.click(addCostButton);
    fireEvent.click(addCryptoButton);
    fireEvent.click(addDonorButton);

    const costInput = within(screen.getByTestId("donations-cost-item-0")).getByDisplayValue(
      "Novo custo",
    ) as HTMLInputElement;
    costInput.focus();
    expect(costInput).toHaveFocus();
    fireEvent.change(costInput, { target: { value: "Hospedagem" } });
    const updatedCostInput = within(screen.getByTestId("donations-cost-item-0")).getByDisplayValue(
      "Hospedagem",
    ) as HTMLInputElement;
    expect(updatedCostInput).toHaveFocus();
    fireEvent.change(updatedCostInput, { target: { value: "Hospedagem web" } });
    expect(
      within(screen.getByTestId("donations-cost-item-0")).getByDisplayValue("Hospedagem web"),
    ).toHaveFocus();

    const cryptoNameInput = within(screen.getByTestId("donations-crypto-item-0")).getByLabelText(
      /Nome do serviço/i,
    ) as HTMLInputElement;
    cryptoNameInput.focus();
    expect(cryptoNameInput).toHaveFocus();
    fireEvent.change(cryptoNameInput, { target: { value: "Bit" } });
    const updatedCryptoNameInput = within(
      screen.getByTestId("donations-crypto-item-0"),
    ).getByDisplayValue("Bit") as HTMLInputElement;
    expect(updatedCryptoNameInput).toHaveFocus();
    fireEvent.change(updatedCryptoNameInput, { target: { value: "Bitcoin" } });
    expect(
      within(screen.getByTestId("donations-crypto-item-0")).getByDisplayValue("Bitcoin"),
    ).toHaveFocus();

    const donorNameInput = within(screen.getByTestId("donations-donor-item-0")).getByDisplayValue(
      "Novo doador",
    ) as HTMLInputElement;
    donorNameInput.focus();
    expect(donorNameInput).toHaveFocus();
    fireEvent.change(donorNameInput, { target: { value: "Alice" } });
    const updatedDonorNameInput = within(
      screen.getByTestId("donations-donor-item-0"),
    ).getByDisplayValue("Alice") as HTMLInputElement;
    expect(updatedDonorNameInput).toHaveFocus();
    fireEvent.change(updatedDonorNameInput, { target: { value: "Alice Silva" } });
    expect(
      within(screen.getByTestId("donations-donor-item-0")).getByDisplayValue("Alice Silva"),
    ).toHaveFocus();
  });

  it("preserva o foco do serviço cripto ativo após autosave e resposta da API", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const cryptoEditor = screen.getByTestId("donations-crypto-editor");
    fireEvent.click(within(cryptoEditor).getByRole("button", { name: /Adicionar/i }));
    apiFetchMock.mockClear();

    const cryptoNameInput = within(screen.getByTestId("donations-crypto-item-0")).getByLabelText(
      /Nome do serviço/i,
    ) as HTMLInputElement;
    cryptoNameInput.focus();
    fireEvent.change(cryptoNameInput, { target: { value: "Bitcoin" } });

    const focusedInputBeforeSave = within(
      screen.getByTestId("donations-crypto-item-0"),
    ).getByDisplayValue("Bitcoin") as HTMLInputElement;
    expect(focusedInputBeforeSave).toHaveFocus();

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    expect(getPutPageCalls().length).toBeGreaterThan(0);
    const focusedInputAfterSave = within(
      screen.getByTestId("donations-crypto-item-0"),
    ).getByDisplayValue("Bitcoin") as HTMLInputElement;
    expect(focusedInputAfterSave).toHaveFocus();
  });

  it("adiciona, reordena e persiste servicos de cripto com preview de logo customizada", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const cryptoEditor = screen.getByTestId("donations-crypto-editor");
    apiFetchMock.mockClear();

    fireEvent.click(within(cryptoEditor).getByRole("button", { name: /Adicionar/i }));
    fireEvent.click(within(cryptoEditor).getByRole("button", { name: /Adicionar/i }));

    const getCryptoItem = (index: number) =>
      within(cryptoEditor).getByTestId(`donations-crypto-item-${index}`);

    fireEvent.change(within(getCryptoItem(0)).getByLabelText(/Nome do serviço/i), {
      target: { value: "Bitcoin" },
    });
    fireEvent.change(within(getCryptoItem(0)).getByLabelText(/Ticker/i), {
      target: { value: "BTC" },
    });
    fireEvent.change(within(getCryptoItem(0)).getByLabelText(/Rede/i), {
      target: { value: "Bitcoin" },
    });
    fireEvent.change(within(getCryptoItem(0)).getByLabelText(/Endereço para cópia/i), {
      target: { value: "bc1-bitcoin" },
    });
    fireEvent.change(within(getCryptoItem(0)).getByLabelText(/Logo customizada/i), {
      target: { value: "https://cdn.example.com/btc.png" },
    });

    await waitFor(() => {
      expect(within(getCryptoItem(0)).getByAltText("Logo Bitcoin")).toHaveAttribute(
        "src",
        "https://cdn.example.com/btc.png",
      );
    });

    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/Nome do serviço/i), {
      target: { value: "Ethereum" },
    });
    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/Ticker/i), {
      target: { value: "ETH" },
    });
    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/Rede/i), {
      target: { value: "ERC-20" },
    });
    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/Endereço para cópia/i), {
      target: { value: "0x-ethereum" },
    });
    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/Rótulo da ação externa/i), {
      target: { value: "Abrir app" },
    });
    fireEvent.change(within(getCryptoItem(1)).getByLabelText(/URL da ação externa/i), {
      target: { value: "https://wallet.example.com/eth" },
    });

    fireEvent.click(
      within(getCryptoItem(1)).getByRole("button", {
        name: /Mover serviço cripto 2 para cima/i,
      }),
    );

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPutCall = putCalls[putCalls.length - 1];
    const payload = JSON.parse(String(((lastPutCall?.[2] || {}) as RequestInit).body || "{}"));
    expect(payload.pages?.donations?.cryptoServices).toEqual([
      expect.objectContaining({
        name: "Ethereum",
        ticker: "ETH",
        network: "ERC-20",
        address: "0x-ethereum",
        actionLabel: "Abrir app",
        actionUrl: "https://wallet.example.com/eth",
      }),
      expect.objectContaining({
        name: "Bitcoin",
        ticker: "BTC",
        network: "Bitcoin",
        address: "bc1-bitcoin",
        iconUrl: "https://cdn.example.com/btc.png",
      }),
    ]);
    payload.pages?.donations?.cryptoServices?.forEach((service: Record<string, unknown>) => {
      expect(service).not.toHaveProperty("_editorKey");
    });
  });

  it("não envia _editorKey no payload de custos, cripto e doadores", async () => {
    renderDashboardPages();
    await screen.findByRole("heading", { name: /Gerenciar/i });
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const costsEditor = screen.getByText("Custos").closest("div")?.parentElement;
    const cryptoEditor = screen.getByTestId("donations-crypto-editor");
    const donorsEditor = screen.getByText("Doadores").closest("div")?.parentElement;
    expect(costsEditor).not.toBeNull();
    expect(donorsEditor).not.toBeNull();
    apiFetchMock.mockClear();

    fireEvent.click(within(costsEditor as HTMLElement).getByRole("button", { name: /Adicionar/i }));
    fireEvent.click(within(cryptoEditor).getByRole("button", { name: /Adicionar/i }));
    fireEvent.click(
      within(donorsEditor as HTMLElement).getByRole("button", { name: /Adicionar/i }),
    );

    fireEvent.change(
      within(screen.getByTestId("donations-cost-item-0")).getByDisplayValue("Novo custo"),
      { target: { value: "Infraestrutura" } },
    );
    fireEvent.change(
      within(screen.getByTestId("donations-crypto-item-0")).getByLabelText(/Nome do serviço/i),
      { target: { value: "Bitcoin" } },
    );
    fireEvent.change(
      within(screen.getByTestId("donations-crypto-item-0")).getByLabelText(/Endereço para cópia/i),
      { target: { value: "bc1-payload" } },
    );
    fireEvent.change(
      within(screen.getByTestId("donations-donor-item-0")).getByDisplayValue("Novo doador"),
      { target: { value: "Alice" } },
    );

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPutCall = putCalls[putCalls.length - 1];
    const payload = JSON.parse(String(((lastPutCall?.[2] || {}) as RequestInit).body || "{}"));

    expect(payload.pages?.donations?.costs?.[0]).toEqual(
      expect.objectContaining({
        title: "Infraestrutura",
      }),
    );
    expect(payload.pages?.donations?.cryptoServices?.[0]).toEqual(
      expect.objectContaining({
        name: "Bitcoin",
        address: "bc1-payload",
      }),
    );
    expect(payload.pages?.donations?.donors?.[0]).toEqual(
      expect.objectContaining({
        name: "Alice",
      }),
    );
    expect(payload.pages?.donations?.costs?.[0]).not.toHaveProperty("_editorKey");
    expect(payload.pages?.donations?.cryptoServices?.[0]).not.toHaveProperty("_editorKey");
    expect(payload.pages?.donations?.donors?.[0]).not.toHaveProperty("_editorKey");
  });

  it("remove servicos de cripto do payload sem afetar Pix ou meta mensal", async () => {
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
              monthlyGoalRaised: "",
              monthlyGoalTarget: "",
              monthlyGoalSupporters: "",
              monthlyGoalNote: "",
              cryptoTitle: "Criptomoedas",
              cryptoSubtitle: "",
              cryptoServices: [
                {
                  name: "Litecoin",
                  ticker: "LTC",
                  network: "Litecoin",
                  address: "ltc-address",
                  qrValue: "",
                  note: "",
                  icon: "Coins",
                  iconUrl: "",
                  actionLabel: "",
                  actionUrl: "",
                },
              ],
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
    const donationsTab = screen.getByRole("tab", { name: /Doa/i });
    fireEvent.mouseDown(donationsTab);
    await waitFor(() => {
      expect(donationsTab).toHaveAttribute("aria-selected", "true");
    });

    const cryptoEditor = screen.getByTestId("donations-crypto-editor");
    apiFetchMock.mockClear();
    const getFirstItem = () => within(cryptoEditor).getByTestId("donations-crypto-item-0");

    fireEvent.click(
      within(getFirstItem()).getByRole("button", { name: /Remover serviço cripto 1/i }),
    );

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    const putCalls = getPutPageCalls();
    expect(putCalls.length).toBeGreaterThan(0);
    const lastPutCall = putCalls[putCalls.length - 1];
    const payload = JSON.parse(String(((lastPutCall?.[2] || {}) as RequestInit).body || "{}"));
    expect(payload.pages?.donations?.cryptoServices).toEqual([]);
    expect(payload.pages?.donations?.pixKey).toBe("PIX-INIT");
    expect(payload.pages?.donations?.monthlyGoalRaised).toBe("");
  });
});
