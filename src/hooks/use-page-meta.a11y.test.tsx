import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageMeta } from "@/hooks/use-page-meta";

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    isLoading: false,
    settings: {
      site: {
        name: "Nekomata",
        description: "Descricao padrao",
        defaultShareImage: "/uploads/default-og.jpg",
        defaultShareImageAlt: "Imagem padrao",
        titleSeparator: " | ",
      },
    },
  }),
}));

const TestMeta = ({ imageAlt }: { imageAlt?: string }) => {
  usePageMeta({
    title: "Pagina de teste",
    image: "/uploads/custom-og.jpg",
    imageAlt,
  });
  return null;
};

describe("usePageMeta accessibility metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("writes og:image:alt and twitter:image:alt", () => {
    render(<TestMeta imageAlt="Alt especifico" />);

    expect(
      document
        .querySelector('meta[property="og:image:alt"]')
        ?.getAttribute("content"),
    ).toBe("Alt especifico");
    expect(
      document
        .querySelector('meta[name="twitter:image:alt"]')
        ?.getAttribute("content"),
    ).toBe("Alt especifico");
  });

  it("falls back to the site default alt text", () => {
    render(<TestMeta />);

    expect(
      document
        .querySelector('meta[property="og:image:alt"]')
        ?.getAttribute("content"),
    ).toBe("Imagem padrao");
    expect(
      document
        .querySelector('meta[name="twitter:image:alt"]')
        ?.getAttribute("content"),
    ).toBe("Imagem padrao");
  });
});
