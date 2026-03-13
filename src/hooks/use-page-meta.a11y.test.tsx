import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageMeta } from "@/hooks/use-page-meta";
import { resolveThemeColor } from "@/lib/theme-color";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

const mockSiteSettings = {
  site: {
    name: "Nekomata",
    description: "Descricao padrao",
    defaultShareImage: "/uploads/default-og.jpg",
    defaultShareImageAlt: "Imagem padrao",
    titleSeparator: " | ",
  },
  theme: {
    accent: "#9667e0",
  },
};

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    isLoading: false,
    settings: mockSiteSettings,
  }),
}));

const TestMeta = ({
  imageAlt,
  mediaVariants,
  description,
}: {
  imageAlt?: string;
  mediaVariants?: UploadMediaVariantsMap;
  description?: string;
}) => {
  usePageMeta({
    title: "Pagina de teste",
    description,
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
    window.history.replaceState(null, "", "/");
    mockSiteSettings.theme.accent = "#9667e0";
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

  it("truncates long description across standard, og and twitter tags", () => {
    const longDescription =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum dapibus blandit magna, non convallis mi sodales non. Donec ac turpis dictum, gravida urna sed, cursus odio.";
    render(<TestMeta description={longDescription} />);

    const description = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");
    const ogDescription = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");
    const twitterDescription = document
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute("content");

    expect(description).toBeTruthy();
    expect(ogDescription).toBeTruthy();
    expect(twitterDescription).toBeTruthy();
    expect((description || "").length).toBeLessThanOrEqual(160);
    expect((ogDescription || "").length).toBeLessThanOrEqual(160);
    expect((twitterDescription || "").length).toBeLessThanOrEqual(160);
  });

  it("keeps theme-color equal to the accent across route changes", () => {
    window.history.replaceState(null, "", "/projetos");
    const view = render(<TestMeta />);

    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(resolveThemeColor("#9667e0"));

    window.history.replaceState(null, "", "/postagem/slug-teste");
    view.rerender(<TestMeta description="Atualizado para disparar o effect" />);

    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(resolveThemeColor("#9667e0"));
  });

  it("updates theme-color when the accent changes", () => {
    const view = render(<TestMeta />);

    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(resolveThemeColor("#9667e0"));

    mockSiteSettings.theme.accent = "#34A853";
    view.rerender(<TestMeta description="Atualizado para novo accent" />);

    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(resolveThemeColor("#34A853"));
  });
});
