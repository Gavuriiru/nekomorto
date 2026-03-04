import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    window as Window & typeof globalThis & {
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

describe("Donations Pix QR code", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    qrCodeToDataUrlMock.mockClear();
  });

  it("gera um BR Code valido quando nao ha QR customizado", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      pixNote: "Apoie a fansub",
      pixCity: "Brasilia",
    });

    render(<Donations />);

    const qrImage = await screen.findByAltText("QR Code PIX");

    await waitFor(() => {
      expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(1);
    });

    const [payload, options] = qrCodeToDataUrlMock.mock.calls[0] || [];
    expect(String(payload)).toContain("br.gov.bcb.pix");
    expect(String(payload)).toContain("Apoie a fansub");
    expect(options).toMatchObject({
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    await waitFor(() => {
      expect(qrImage).toHaveAttribute("src", "data:image/png;base64,pix-qr");
    });
  });

  it("prioriza o QR customizado e nao chama o encoder local", async () => {
    setBootstrapDonationsPage({
      pixKey: "pix-chave-teste",
      qrCustomUrl: "https://cdn.example.com/pix.png",
    });

    render(<Donations />);

    const qrImage = await screen.findByAltText("QR Code PIX");

    await waitFor(() => {
      expect(qrImage).toHaveAttribute("src", "https://cdn.example.com/pix.png");
    });
    expect(qrCodeToDataUrlMock).not.toHaveBeenCalled();
  });
});
