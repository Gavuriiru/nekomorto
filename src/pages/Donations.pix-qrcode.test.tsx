import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Donations from "@/pages/Donations";

const apiFetchMock = vi.hoisted(() => vi.fn());
const clipboardWriteTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,pix-qr"),
);

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const setWindowBootstrap = (payload: unknown) => {
  (
    window as Window &
      typeof globalThis & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
  ).__BOOTSTRAP_PUBLIC__ = payload;
};

const setBootstrapDonationsPage = (donations: Record<string, unknown>) => {
  setWindowBootstrap({
    settings: {},
    pages: {
      donations,
    },
    projects: [],
    posts: [],
    updates: [],
    tagTranslations: {
      tags: {},
      genres: {},
      staffRoles: {},
    },
    generatedAt: "2026-03-03T20:00:00.000Z",
    mediaVariants: {},
  });
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("Donations Pix and crypto QR code", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    clipboardWriteTextMock.mockClear();
    qrCodeToDataUrlMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00.000Z"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gera um BR Code valido quando nao ha QR customizado", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      pixNote: "Apoie a fansub",
      pixCity: "Brasilia",
    });

    render(<Donations />);

    const qrImage = screen.getByAltText("QR Code PIX");

    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    const [payload, options] = qrCodeToDataUrlMock.mock.calls[0] || [];
    expect(String(payload)).toContain("br.gov.bcb.pix");
    expect(String(payload)).toContain("Apoie a fansub");
    expect(options).toMatchObject({
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,pix-qr");
  });

  it("mostra carregamento com bootstrap critical-home e hidrata as doacoes completas", async () => {
    setWindowBootstrap({
      settings: {},
      pages: { home: {} },
      projects: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-04-10T19:00:00.000Z",
      mediaVariants: {},
      payloadMode: "critical-home",
    });
    apiFetchMock.mockImplementation(async (_base: string, endpoint: string) => {
      if (endpoint === "/api/public/bootstrap") {
        return mockJsonResponse(true, {
          settings: {},
          pages: {
            donations: {
              heroTitle: "Doacoes configuradas",
              heroSubtitle: "Ajude a manter tudo online.",
              reasonTitle: "Por que apoiar",
              reasonText: "Mantemos infraestrutura e ferramentas.",
              reasonNote: "Toda ajuda conta.",
              pixKey: "pix-hidratado",
              monthlyGoalRaised: "125,50",
              monthlyGoalTarget: "500",
              cryptoServices: [
                {
                  name: "Bitcoin",
                  ticker: "BTC",
                  network: "Bitcoin",
                  address: "bc1-hidratado",
                  qrValue: "",
                  note: "",
                  icon: "Bitcoin",
                  iconUrl: "",
                  actionLabel: "",
                  actionUrl: "",
                },
              ],
              donors: [
                {
                  name: "Apoiador",
                  amount: "R$ 25,00",
                  goal: "Servidor",
                  date: "04/2026",
                },
              ],
            },
          },
          projects: [],
          posts: [],
          updates: [],
          tagTranslations: {
            tags: {},
            genres: {},
            staffRoles: {},
          },
          generatedAt: "2026-04-10T19:01:00.000Z",
          mediaVariants: {},
          payloadMode: "full",
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<Donations />);

    expect(screen.getByText("Carregando doações...")).toBeInTheDocument();
    expect(screen.queryByAltText("QR Code PIX")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar chave PIX" })).not.toBeInTheDocument();

    await act(async () => {
      await flushMicrotasks();
    });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByRole("button", { name: "Copiar chave PIX" })).toBeInTheDocument();
    expect(screen.getByText("Meta de abril/2026")).toBeInTheDocument();
    expect(screen.getByTestId("donations-crypto-section")).toBeInTheDocument();
    expect(screen.getByText("pix-hidratado")).toBeInTheDocument();
    expect(screen.getByText("Apoiador")).toBeInTheDocument();
  });

  it("prioriza o QR customizado e nao chama o encoder local", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      qrCustomUrl: "https://cdn.example.com/pix.png",
    });

    render(<Donations />);

    const qrImage = screen.getByAltText("QR Code PIX");

    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrImage).toHaveAttribute("src", "https://cdn.example.com/pix.png");
    expect(qrCodeToDataUrlMock).not.toHaveBeenCalled();
  });

  it("mantem o bloco de motivo estatico, sem hover animado", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      reasonTitle: "Por que apoiar",
      reasonText: "Mantemos infraestrutura e ferramentas.",
      reasonNote: "Toda ajuda conta.",
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    const reasonPanel = screen.getByTestId("donations-reason-panel");

    expect(screen.getByText("Por que apoiar")).toBeInTheDocument();
    expect(screen.getByText("Mantemos infraestrutura e ferramentas.")).toBeInTheDocument();
    expect(screen.getByText("Toda ajuda conta.")).toBeInTheDocument();
    expect(classTokens(reasonPanel)).not.toContain("group/reason");
    expect(classTokens(reasonPanel)).not.toContain("transition-all");
    expect(classTokens(reasonPanel)).not.toContain("hover:-translate-y-1");
    expect(classTokens(reasonPanel)).not.toContain("hover:border-primary/60");
  });

  it("mantem o card da lista de doadores estatico com sombra discreta", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      donors: [
        {
          name: "Apoiador",
          amount: "R$ 25,00",
          goal: "Servidor",
          date: "04/2026",
        },
      ],
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    const donorsCard = screen.getByTestId("donations-donors-card");
    const donorsHeading = screen.getByText("Lista de doadores").parentElement as HTMLElement;

    expect(screen.getByText("Apoiador")).toBeInTheDocument();
    expect(classTokens(donorsCard)).toEqual(
      expect.arrayContaining(["bg-card/80", "shadow-public-card"]),
    );
    expect(classTokens(donorsCard)).not.toContain("group");
    expect(classTokens(donorsCard)).not.toContain("transition-all");
    expect(classTokens(donorsCard)).not.toContain("hover:-translate-y-1");
    expect(classTokens(donorsCard)).not.toContain("hover:border-primary/60");
    expect(classTokens(donorsCard)).not.toContain("hover:bg-card/90");
    expect(classTokens(donorsCard)).not.toContain("hover:shadow-public-card");
    expect(classTokens(donorsHeading)).not.toContain("transition-colors");
    expect(classTokens(donorsHeading)).not.toContain("group-hover:text-primary");
  });

  it("renderiza a meta mensal com titulo automatico, apoiadores e nota sem CTA extra", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "125,50",
      monthlyGoalTarget: "500",
      monthlyGoalSupporters: "12",
      monthlyGoalNote: "Meta para pagar VPS + dominio",
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Meta de abril/2026")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*125,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam R\$\s*374,50 para bater a meta/i)).toBeInTheDocument();
    const supportersText = screen.getByText(/12 apoiadores no m.s/i);
    expect(supportersText).toBeInTheDocument();
    expect(screen.getByText("Meta para pagar VPS + dominio")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Apoiar agora" })).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Meta de abril/2026" })).toHaveAttribute(
      "aria-valuetext",
      "Meta de abril/2026: R$\u00a0125,50 arrecadados de R$\u00a0500,00 (25%).",
    );
    expect(classTokens(supportersText as HTMLElement)).toEqual(
      expect.arrayContaining(["text-xs", "font-medium", "text-muted-foreground"]),
    );
    expect(classTokens(supportersText as HTMLElement)).not.toContain("rounded-full");
    expect(classTokens(supportersText as HTMLElement)).not.toContain("border");
    expect(classTokens(supportersText as HTMLElement)).not.toContain("bg-background/70");
    expect(screen.queryByTestId("monthly-goal-milestone-25")).toBeNull();
    expect(screen.queryByTestId("monthly-goal-milestone-50")).toBeNull();
    expect(screen.queryByTestId("monthly-goal-milestone-75")).toBeNull();
    expect(screen.queryByTestId("monthly-goal-milestone-100")).toBeNull();
  });

  it("oculta a meta mensal quando a meta esta vazia ou zerada", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "100",
      monthlyGoalTarget: "",
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByText(/Meta de /i)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /Meta de /i })).not.toBeInTheDocument();
  });

  it("limita a barra a 100% sem perder o valor arrecadado real e aplica estado concluido", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "750",
      monthlyGoalTarget: "500",
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    const progress = screen.getByRole("progressbar", { name: "Meta de abril/2026" });
    expect(screen.getByText(/^Conclu.da$/i)).toBeInTheDocument();
    expect(screen.getByText(/Meta do m.s conclu.da!/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*750,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*500,00/)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(progress).toHaveAttribute(
      "aria-valuetext",
      "Meta de abril/2026: R$\u00a0750,00 arrecadados de R$\u00a0500,00 (100%).",
    );
    expect(screen.queryByTestId("monthly-goal-milestone-100")).toBeNull();
  });

  it("oculta apoiadores e nota opcionais quando os dados nao sao validos", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "50",
      monthlyGoalTarget: "500",
      monthlyGoalSupporters: "0",
      monthlyGoalNote: "   ",
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByText(/apoiadores no m.s/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Meta para pagar VPS + dominio")).not.toBeInTheDocument();
  });

  it("renderiza a secao de cripto em card unico com abas e permite trocar o servico ativo", async () => {
    setBootstrapDonationsPage({
      pixKey: "",
      cryptoServices: [
        {
          name: "Bitcoin",
          ticker: "BTC",
          network: "Bitcoin",
          address: "bc1-endereco",
          qrValue: "bitcoin:bc1-endereco?amount=0.01",
          note: "Use a rede principal.",
          icon: "Coins",
          iconUrl: "https://cdn.example.com/btc.png",
          actionLabel: "Abrir carteira",
          actionUrl: "https://wallet.example.com/btc",
        },
        {
          name: "Ethereum",
          ticker: "ETH",
          network: "ERC-20",
          address: "0x-endereco",
          qrValue: "",
          note: "Envie pela rede correta.",
          icon: "Wallet",
          iconUrl: "",
          actionLabel: "",
          actionUrl: "",
        },
      ],
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByRole("heading", { name: "Criptomoedas" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("donations-crypto-subtitle")).not.toBeInTheDocument();
    expect(screen.getByTestId("donations-crypto-card")).toBeInTheDocument();
    expect(screen.getByTestId("donations-crypto-tablist")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Copiar endereço" })).toHaveLength(1);
    expect(screen.getByTestId("donations-crypto-tab-0")).toHaveAttribute(
      "aria-label",
      "Bitcoin (BTC / Bitcoin)",
    );
    expect(screen.getByTestId("donations-crypto-tab-1")).toHaveAttribute(
      "aria-label",
      "Ethereum (ETH / ERC-20)",
    );
    expect(screen.getByTestId("donations-crypto-tab-logo-0")).toHaveAttribute(
      "src",
      "https://cdn.example.com/btc.png",
    );
    expect(screen.getByTestId("donations-crypto-tab-icon-1")).toBeInTheDocument();
    const activePanel = screen.getByTestId("donations-crypto-panel");
    const activeDetails = within(activePanel).getByTestId("donations-crypto-details");
    const activeActions = within(activePanel).getByTestId("donations-crypto-actions");
    const activeTitleRow = within(activeDetails).getByTestId("donations-crypto-title-row");
    const activeAddressRow = within(activeDetails).getByTestId("donations-crypto-address-row");

    expect(within(activeActions).getByAltText("QR Code Bitcoin")).toBeInTheDocument();
    expect(within(activeActions).queryByRole("button", { name: "Copiar endereço" })).toBeNull();
    expect(within(activeActions).queryByRole("link", { name: "Abrir carteira" })).toBeNull();
    expect(within(activeDetails).getByText("Endereço")).toBeInTheDocument();
    const activeCopyButton = within(activeDetails).getByRole("button", { name: "Copiar endereço" });
    const activeExternalLink = within(activeDetails).getByRole("link", { name: "Abrir carteira" });
    const activeName = within(activeDetails).getByText("Bitcoin");
    const activeAddress = within(activeDetails).getByText("bc1-endereco");
    expect(activeCopyButton).toBeInTheDocument();
    expect(activeExternalLink).toBeInTheDocument();
    expect(activeTitleRow).toContainElement(activeName);
    expect(activeTitleRow).toContainElement(activeExternalLink);
    expect(activeAddressRow).toContainElement(activeAddress);
    expect(activeAddressRow).toContainElement(activeCopyButton);
    expect(String(activeTitleRow.className).split(/\s+/)).not.toContain("justify-between");
    expect(String(activeAddressRow.className).split(/\s+/)).not.toContain("justify-between");
    expect(classTokens(activeExternalLink)).toEqual(
      expect.arrayContaining([
        "ml-1.5",
        "text-muted-foreground",
        "bg-transparent",
        "hover:text-accent",
        "focus-visible:text-accent",
      ]),
    );
    expect(classTokens(activeExternalLink)).not.toContain("mt-0.5");
    expect(classTokens(activeCopyButton)).toEqual(
      expect.arrayContaining([
        "ml-1.5",
        "text-muted-foreground",
        "bg-transparent",
        "hover:text-accent",
        "focus-visible:text-accent",
      ]),
    );
    expect(
      activeName.compareDocumentPosition(activeExternalLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      activeAddress.compareDocumentPosition(activeCopyButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(within(activeDetails).getByText("Use a rede principal.")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("BTC / Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("Use a rede principal.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar endereço" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir carteira" })).toHaveAttribute(
      "href",
      "https://wallet.example.com/btc",
    );
    expect(screen.queryByAltText("Logo Bitcoin")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(activeCopyButton);
      await flushMicrotasks();
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith("bc1-endereco");
    const copiedButton = within(activeDetails).getByRole("button", { name: "Copiado" });
    expect(classTokens(copiedButton)).toContain("text-accent");
    expect(classTokens(copiedButton)).not.toContain("text-muted-foreground");
    expect(classTokens(copiedButton)).toContain("bg-transparent");
    expect(
      qrCodeToDataUrlMock.mock.calls.some(
        ([payload]) => payload === "bitcoin:bc1-endereco?amount=0.01",
      ),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("donations-crypto-tab-1"));

    expect(screen.getByTestId("donations-crypto-tab-1")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    const ethereumPanel = screen.getByTestId("donations-crypto-panel");
    const ethereumDetails = within(ethereumPanel).getByTestId("donations-crypto-details");
    const ethereumActions = within(ethereumPanel).getByTestId("donations-crypto-actions");
    expect(within(ethereumActions).getByAltText("QR Code Ethereum")).toBeInTheDocument();
    expect(within(ethereumActions).queryByRole("button", { name: "Copiar endereço" })).toBeNull();
    expect(within(ethereumActions).queryByRole("link", { name: "Abrir carteira" })).toBeNull();
    expect(within(ethereumDetails).getByText("Endereço")).toBeInTheDocument();
    const ethereumAddressRow = within(ethereumDetails).getByTestId("donations-crypto-address-row");
    const ethereumAddress = within(ethereumDetails).getByText("0x-endereco");
    const ethereumCopyButton = within(ethereumDetails).getByRole("button", {
      name: "Copiar endereço",
    });
    expect(ethereumAddress).toBeInTheDocument();
    expect(ethereumCopyButton).toBeInTheDocument();
    expect(ethereumAddressRow).toContainElement(ethereumAddress);
    expect(ethereumAddressRow).toContainElement(ethereumCopyButton);
    expect(String(ethereumAddressRow.className).split(/\s+/)).not.toContain("justify-between");
    expect(
      ethereumAddress.compareDocumentPosition(ethereumCopyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("ETH / ERC-20")).toBeInTheDocument();
    expect(screen.getByText("Envie pela rede correta.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir carteira" })).not.toBeInTheDocument();
    expect(qrCodeToDataUrlMock.mock.calls.some(([payload]) => payload === "0x-endereco")).toBe(
      true,
    );
  });

  it("oculta a secao de cripto sem servicos validos", async () => {
    setBootstrapDonationsPage({
      pixKey: "",
      cryptoServices: [
        {
          name: "Bitcoin",
          ticker: "BTC",
          network: "Bitcoin",
          address: "",
          qrValue: "",
          note: "",
          icon: "Bitcoin",
          iconUrl: "",
          actionLabel: "",
          actionUrl: "",
        },
      ],
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByTestId("donations-crypto-section")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criptomoedas" })).not.toBeInTheDocument();
  });

  it("usa o endereco como fallback do QR e oculta campos opcionais vazios nos cards de cripto", async () => {
    setBootstrapDonationsPage({
      pixKey: "",
      cryptoServices: [
        {
          name: "Ethereum",
          ticker: "ETH",
          network: "",
          address: "0x-endereco",
          qrValue: "",
          note: "",
          icon: "Coins",
          iconUrl: "",
          actionLabel: "",
          actionUrl: "",
        },
      ],
    });

    render(<Donations />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.queryByTestId("donations-crypto-tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Abrir carteira")).not.toBeInTheDocument();
    expect(qrCodeToDataUrlMock.mock.calls.some(([payload]) => payload === "0x-endereco")).toBe(
      true,
    );
  });
});
