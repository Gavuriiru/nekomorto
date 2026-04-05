import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Donations from "@/pages/Donations";

const apiFetchMock = vi.hoisted(() => vi.fn());
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

const setBootstrapDonationsPage = (donations: Record<string, unknown>) => {
  (
    window as Window &
      typeof globalThis & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
  ).__BOOTSTRAP_PUBLIC__ = {
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
  };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Donations Pix and crypto QR code", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    qrCodeToDataUrlMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00.000Z"));
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

  it("renderiza a meta mensal com titulo automatico, CTA, apoiadores e nota", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "125,50",
      monthlyGoalTarget: "500",
      monthlyGoalSupporters: "12",
      monthlyGoalNote: "Meta para pagar VPS + dominio",
    });

    render(<Donations />);

    screen.getByAltText("QR Code PIX");
    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Meta de abril/2026")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*125,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam R\$\s*374,50 para bater a meta/i)).toBeInTheDocument();
    expect(screen.getByText(/12 apoiadores no m.s/i)).toBeInTheDocument();
    expect(screen.getByText("Meta para pagar VPS + dominio")).toBeInTheDocument();
    expect(screen.getAllByText("25%").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Apoiar agora" })).toHaveAttribute(
      "href",
      "#pix-doacoes",
    );
    expect(screen.getByRole("progressbar", { name: "Meta de abril/2026" })).toHaveAttribute(
      "aria-valuetext",
      "Meta de abril/2026: R$\u00a0125,50 arrecadados de R$\u00a0500,00 (25%).",
    );
    expect(screen.getByTestId("monthly-goal-milestone-25")).toHaveAttribute("data-reached", "true");
    expect(screen.getByTestId("monthly-goal-milestone-50")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("monthly-goal-milestone-75")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("monthly-goal-milestone-100")).toHaveAttribute(
      "data-reached",
      "false",
    );
  });

  it("oculta a meta mensal quando a meta esta vazia ou zerada", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      monthlyGoalRaised: "100",
      monthlyGoalTarget: "",
    });

    render(<Donations />);

    screen.getByAltText("QR Code PIX");
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

    screen.getByAltText("QR Code PIX");
    await act(async () => {
      await flushMicrotasks();
    });

    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    const progress = screen.getByRole("progressbar", { name: "Meta de abril/2026" });
    expect(screen.getByText(/^Conclu.da$/i)).toBeInTheDocument();
    expect(screen.getByText(/Meta do m.s conclu.da!/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*750,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*500,00/)).toBeInTheDocument();
    expect(progress).toHaveAttribute(
      "aria-valuetext",
      "Meta de abril/2026: R$\u00a0750,00 arrecadados de R$\u00a0500,00 (100%).",
    );
    expect(screen.getByTestId("monthly-goal-milestone-100")).toHaveAttribute("data-reached", "true");
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

    screen.getByAltText("QR Code PIX");
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

    screen.getByAltText("QR Code PIX");
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

    expect(within(activePanel).getByAltText("QR Code Bitcoin")).toBeInTheDocument();
    expect(within(activePanel).getByRole("button", { name: "Copiar endereço" })).toBeInTheDocument();
    expect(within(activePanel).getByRole("link", { name: "Abrir carteira" })).toBeInTheDocument();
    expect(within(activePanel).getByText("Use a rede principal.")).toBeInTheDocument();
    expect(within(activePanel).getByText("bc1-endereco")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("BTC / Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("Use a rede principal.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar endereço" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir carteira" })).toHaveAttribute(
      "href",
      "https://wallet.example.com/btc",
    );
    expect(screen.getByAltText("Logo Bitcoin")).toHaveAttribute(
      "src",
      "https://cdn.example.com/btc.png",
    );
    expect(
      qrCodeToDataUrlMock.mock.calls.some(
        ([payload]) => payload === "bitcoin:bc1-endereco?amount=0.01",
      ),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("donations-crypto-tab-1"));

    expect(screen.getByTestId("donations-crypto-tab-1")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(within(screen.getByTestId("donations-crypto-panel")).getByAltText("QR Code Ethereum")).toBeInTheDocument();
    expect(within(screen.getByTestId("donations-crypto-panel")).getByText("0x-endereco")).toBeInTheDocument();
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("ETH / ERC-20")).toBeInTheDocument();
    expect(screen.getByText("Envie pela rede correta.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir carteira" })).not.toBeInTheDocument();
    expect(
      qrCodeToDataUrlMock.mock.calls.some(([payload]) => payload === "0x-endereco"),
    ).toBe(true);
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

    screen.getByAltText("QR Code PIX");
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

    screen.getByAltText("QR Code PIX");
    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.queryByTestId("donations-crypto-tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Abrir carteira")).not.toBeInTheDocument();
    expect(
      qrCodeToDataUrlMock.mock.calls.some(([payload]) => payload === "0x-endereco"),
    ).toBe(true);
  });
});
