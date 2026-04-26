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

const hasShadowToken = (element: HTMLElement) =>
  classTokens(element).some((token) => token.startsWith("shadow") && token !== "shadow-none");

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
            actionLabel: "Abrir carteira",
            actionUrl: "https://wallet.example.com/btc",
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
        donors: [
          {
            name: "Apoiador Layout",
            amount: "R$ 20,00",
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

    const heroSection = document.querySelector("section.relative.overflow-hidden") as HTMLElement | null;
    expect(heroSection).not.toBeNull();
    expect(heroSection?.className).toContain("[background-image:var(--gradient-public-hero)]");
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

  it("mantem a meta mensal sem CTA extra e preserva o layout do bloco de pix", async () => {
    render(<Donations />);

    await screen.findByText(/Meta de /i);
    const copyButton = screen.getByRole("button", { name: "Copiar chave PIX" });

    expect(screen.queryByRole("link", { name: "Apoiar agora" })).toBeNull();
    expect(classTokens(copyButton)).toContain("w-full");
    expect(classTokens(copyButton)).toContain("md:w-auto");
  });

  it("mantem o bloco interno de pix flat sem quebrar o CTA", async () => {
    render(<Donations />);

    const qrImage = await screen.findByAltText("QR Code PIX");
    const qrFrame = qrImage.parentElement as HTMLElement | null;
    const qrShell = qrFrame?.parentElement as HTMLElement | null;
    const pixKey = screen.getByText("pix-chave-teste");
    const copyButton = screen.getByRole("button", { name: "Copiar chave PIX" });
    const buttonWrapper = copyButton.parentElement as HTMLElement | null;

    expect(qrFrame).not.toBeNull();
    expect(qrShell).not.toBeNull();
    expect(buttonWrapper).not.toBeNull();

    expect(classTokens(qrShell as HTMLElement)).not.toContain("rounded-3xl");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("border");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("border-primary/20");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("bg-linear-to-br");
    expect(hasShadowToken(qrShell as HTMLElement)).toBe(false);

    expect(classTokens(qrFrame as HTMLElement)).toEqual(
      expect.arrayContaining(["rounded-[1.2rem]", "border", "border-border/40", "bg-white", "p-2"]),
    );

    expect(classTokens(pixKey)).toEqual(
      expect.arrayContaining([
        "font-mono",
        "text-sm",
        "leading-relaxed",
        "text-primary",
        "break-all",
      ]),
    );
    expect(classTokens(pixKey)).not.toContain("rounded-2xl");
    expect(classTokens(pixKey)).not.toContain("border");
    expect(classTokens(pixKey)).not.toContain("bg-background/70");
    expect(classTokens(pixKey)).not.toContain("px-4");
    expect(classTokens(pixKey)).not.toContain("py-3");
    expect(hasShadowToken(pixKey)).toBe(false);

    expect(buttonWrapper as HTMLElement).toContainElement(copyButton);
    expect(qrShell as HTMLElement).not.toContainElement(copyButton);
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

  it("mantem o card de cripto no mesmo estilo das outras secoes sem perder estados ativos e acoes", async () => {
    render(<Donations />);

    const cryptoCard = await screen.findByTestId("donations-crypto-card");
    const cryptoPanel = screen.getByTestId("donations-crypto-panel");
    const cryptoDetails = screen.getByTestId("donations-crypto-details");
    const cryptoActions = screen.getByTestId("donations-crypto-actions");
    const addressRow = screen.getByTestId("donations-crypto-address-row");
    const activeTab = screen.getByTestId("donations-crypto-tab-0");
    const qrShell = screen.getByAltText("QR Code Bitcoin").parentElement?.parentElement;
    const cryptoAddress = screen.getByText("bc1-layout");
    const copyAddressButton = screen.getByRole("button", { name: /Copiar endere/i });
    const externalLink = screen.getByRole("link", { name: "Abrir carteira" });

    expect(classTokens(cryptoCard)).toEqual(
      expect.arrayContaining(["border-0", "bg-card/90", "shadow-public-card"]),
    );
    expect(classTokens(cryptoCard)).not.toContain("border-border/60");
    expect(classTokens(cryptoCard)).not.toContain("shadow-none");
    expect(classTokens(cryptoCard)).not.toContain("hover:-translate-y-1");
    expect(classTokens(cryptoCard)).not.toContain("hover:border-primary/60");

    expect(classTokens(cryptoPanel)).toEqual(
      expect.arrayContaining(["border-0", "bg-transparent", "p-0", "shadow-none"]),
    );
    expect(classTokens(cryptoPanel)).not.toContain("border-border/60");
    expect(classTokens(cryptoPanel)).not.toContain("bg-background/55");
    expect(hasShadowToken(cryptoPanel)).toBe(false);

    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(classTokens(activeTab)).toEqual(
      expect.arrayContaining(["border-primary/50", "bg-transparent", "text-primary"]),
    );
    expect(classTokens(activeTab)).not.toContain("bg-primary/10");
    expect(hasShadowToken(activeTab)).toBe(false);

    expect(qrShell).toBeInstanceOf(HTMLElement);
    expect(classTokens(qrShell as HTMLElement)).not.toContain("border");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("border-border/60");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("bg-background/70");
    expect(classTokens(qrShell as HTMLElement)).not.toContain("bg-linear-to-br");
    expect(hasShadowToken(qrShell as HTMLElement)).toBe(false);
    expect(
      cryptoDetails.compareDocumentPosition(cryptoActions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(cryptoActions).toContainElement(screen.getByAltText("QR Code Bitcoin"));
    expect(cryptoActions).not.toContainElement(copyAddressButton);
    expect(cryptoActions).not.toContainElement(externalLink);
    expect(cryptoDetails).toContainElement(copyAddressButton);
    expect(cryptoDetails).toContainElement(externalLink);
    expect(cryptoDetails).toContainElement(screen.getByText("Endereço"));
    expect(addressRow).toContainElement(cryptoAddress);
    expect(addressRow).toContainElement(copyAddressButton);
    expect(classTokens(addressRow)).not.toContain("justify-between");
    expect(classTokens(externalLink)).toEqual(
      expect.arrayContaining([
        "ml-1.5",
        "h-6",
        "w-6",
        "text-muted-foreground",
        "hover:text-accent",
        "focus-visible:text-accent",
        "bg-transparent",
      ]),
    );
    expect(classTokens(externalLink)).not.toContain("mt-0.5");
    expect(classTokens(externalLink)).not.toContain("hover:bg-accent");
    expect(
      cryptoAddress.compareDocumentPosition(copyAddressButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(classTokens(copyAddressButton)).toEqual(
      expect.arrayContaining([
        "ml-1.5",
        "h-6",
        "w-6",
        "text-muted-foreground",
        "hover:text-accent",
        "focus-visible:text-accent",
        "bg-transparent",
      ]),
    );
    expect(classTokens(copyAddressButton)).not.toContain("hover:bg-accent");
    expect(classTokens(cryptoAddress)).toEqual(
      expect.arrayContaining(["font-mono", "text-sm", "text-primary", "break-all"]),
    );
    expect(classTokens(cryptoAddress)).not.toContain("rounded-[1.2rem]");
    expect(classTokens(cryptoAddress)).not.toContain("border");
    expect(classTokens(cryptoAddress)).not.toContain("px-4");
    expect(classTokens(cryptoAddress)).not.toContain("py-3");
    expect(copyAddressButton).toBeInTheDocument();
  });
});
