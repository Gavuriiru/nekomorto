import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

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

const TestMeta = ({
  imageAlt,
  mediaVariants,
}: {
  imageAlt?: string;
  mediaVariants?: UploadMediaVariantsMap;
}) => {
  usePageMeta({
    title: "Pagina de teste",
    image: "/uploads/custom-og.jpg",
    imageAlt,
    mediaVariants,
  });
  return null;
};

describe("usePageMeta accessibility metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
    (window as Window & typeof globalThis & { __BOOTSTRAP_PUBLIC__?: unknown }).__BOOTSTRAP_PUBLIC__ =
      undefined;
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

  it("usa a variante og quando ela estiver disponivel", () => {
    render(
      <TestMeta
        mediaVariants={{
          "/uploads/custom-og.jpg": {
            variantsVersion: 1,
            variants: {
              og: {
                formats: {
                  fallback: { url: "/uploads/_variants/upload-1/og-v1.jpeg" },
                },
              },
            },
          },
        }}
      />,
    );

    expect(
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content"),
    ).toContain("/uploads/_variants/upload-1/og-v1.jpeg");
    expect(
      document
        .querySelector('meta[name="twitter:image"]')
        ?.getAttribute("content"),
    ).toContain("/uploads/_variants/upload-1/og-v1.jpeg");
  });
});
