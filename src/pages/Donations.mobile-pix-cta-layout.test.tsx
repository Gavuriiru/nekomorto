import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Donations from "@/pages/Donations";

const apiFetchMock = vi.hoisted(() => vi.fn());
const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
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

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Donations mobile PIX CTA layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        pages: {
          donations: {
            pixKey: "pix-chave-teste",
          },
        },
      }),
    );
  });

  it("aplica botao de copiar chave PIX full width no mobile e auto no desktop", async () => {
    render(<Donations />);

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

