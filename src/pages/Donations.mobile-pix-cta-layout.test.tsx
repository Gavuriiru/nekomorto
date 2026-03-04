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

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const setBootstrapDonationsPage = () => {
  (
    window as Window & typeof globalThis & {
      __BOOTSTRAP_PUBLIC__?: unknown;
    }
  ).__BOOTSTRAP_PUBLIC__ = {
    settings: {},
    pages: {
      donations: {
        pixKey: "pix-chave-teste",
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
});

