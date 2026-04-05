import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Donations from "@/pages/Donations";

const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
);

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => qrCodeToDataUrlMock(...args),
  },
}));

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const setBootstrapDonationsPage = () => {
  (
    window as Window &
      typeof globalThis & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
  ).__BOOTSTRAP_PUBLIC__ = {
    settings: {},
    pages: {
      donations: {
        monthlyGoalRaised: "125,50",
        monthlyGoalTarget: "500",
        monthlyGoalSupporters: "8",
        pixKey: "pix-chave-teste",
        cryptoServices: [
          {
            name: "Bitcoin",
            ticker: "BTC",
            network: "Bitcoin",
            address: "bc1-layout",
            qrValue: "",
            note: "",
            icon: "Bitcoin",
            iconUrl: "",
            actionLabel: "",
            actionUrl: "",
          },
          {
            name: "Ethereum",
            ticker: "ETH",
            network: "ERC-20",
            address: "0x-layout",
            qrValue: "",
            note: "",
            icon: "Wallet",
            iconUrl: "",
            actionLabel: "",
            actionUrl: "",
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
    generatedAt: "2026-03-03T20:00:00.000Z",
    mediaVariants: {},
  };
};

describe("Donations mobile PIX CTA layout", () => {
  beforeEach(() => {
    setBootstrapDonationsPage();
  });

  it("aplica botao de copiar chave PIX full width no mobile e auto no desktop", async () => {
    render(<Donations />);

    expect(document.querySelector(".public-page-hero")).not.toBeNull();
    expect(screen.queryByText(/^Equipe$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Recrutamento$/)).not.toBeInTheDocument();

    const copyButton = await screen.findByRole("button", { name: "Copiar chave PIX" });
    const copyButtonTokens = classTokens(copyButton);

    expect(copyButtonTokens).toContain("w-full");
    expect(copyButtonTokens).toContain("md:w-auto");
  });

  it("mantem wrapper do CTA ocupando toda a largura util no mobile", async () => {
    render(<Donations />);

    const copyButton = await screen.findByRole("button", { name: "Copiar chave PIX" });
    const wrapper = copyButton.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();

    const wrapperTokens = classTokens(wrapper as HTMLElement);
    expect(wrapperTokens).toContain("w-full");
    expect(wrapperTokens).toContain("md:justify-center");
  });

  it("renderiza a meta mensal em seção separada acima do bloco de Pix", async () => {
    render(<Donations />);

    const monthlyGoalHeading = await screen.findByText(/Meta de /i);
    const pixHeading = screen.getByText(/^Pix$/);
    const monthlyGoalSection = monthlyGoalHeading.closest("section");
    const pixSection = pixHeading.closest("section");

    expect(
      monthlyGoalHeading.compareDocumentPosition(pixHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(monthlyGoalSection).not.toBeNull();
    expect(pixSection).not.toBeNull();
    expect(monthlyGoalSection).not.toBe(pixSection);
  });

  it("mantem o CTA da meta apontando para o Pix sem quebrar o layout mobile", async () => {
    render(<Donations />);

    const supportLink = await screen.findByRole("link", { name: "Apoiar agora" });
    const copyButton = screen.getByRole("button", { name: "Copiar chave PIX" });

    expect(supportLink).toHaveAttribute("href", "#pix-doacoes");
    expect(classTokens(copyButton)).toContain("w-full");
    expect(classTokens(copyButton)).toContain("md:w-auto");
  });

  it("renderiza a secao de cripto depois do Pix e antes da lista de doadores", async () => {
    render(<Donations />);

    const pixHeading = await screen.findByText(/^Pix$/);
    const cryptoSection = screen.getByTestId("donations-crypto-section");
    const donorsHeading = screen.getByText("Lista de doadores");

    expect(
      pixHeading.compareDocumentPosition(cryptoSection) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      cryptoSection.compareDocumentPosition(donorsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(cryptoSection).toBeInTheDocument();
  });

  it("mantem a secao de cripto em card unico full width com abas no topo mobile e na lateral no desktop", async () => {
    render(<Donations />);

    const cryptoCard = await screen.findByTestId("donations-crypto-card");
    const tablist = screen.getByTestId("donations-crypto-tablist");

    expect(cryptoCard).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criptomoedas" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("donations-crypto-subtitle")).not.toBeInTheDocument();
    expect(classTokens(tablist)).toContain("overflow-x-auto");
    expect(classTokens(tablist)).toContain("md:flex-col");
    expect(classTokens(tablist)).not.toContain("lg:grid-cols-2");
  });
});
