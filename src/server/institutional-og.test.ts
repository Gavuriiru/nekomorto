import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildInstitutionalOgCardModel,
  buildInstitutionalOgImageResponse,
  buildInstitutionalOgScene,
} from "../../server/lib/institutional-og.js";
import { OG_PROJECT_HEIGHT, OG_PROJECT_WIDTH } from "../../server/lib/project-og.js";

const baseSettings = {
  theme: {
    accent: "#3173ff",
  },
  site: {
    name: "Nekomata",
    description: "Descricao padrao do site",
    defaultShareImage: "/uploads/default-og.jpg",
  },
};

const basePages = {
  projects: {
    shareImage: "/uploads/projects-page.jpg",
    shareImageAlt: "Projetos",
  },
  about: {
    shareImage: "/uploads/about-page.jpg",
    shareImageAlt: "Sobre",
    heroSubtitle: "Conheca melhor a equipe e a proposta editorial da Nekomata.",
  },
  donations: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Ajude a manter o projeto no ar.",
  },
  faq: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Respostas para as duvidas mais comuns.",
  },
  team: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Conheca quem faz tudo acontecer.",
  },
  recruitment: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Venha fazer parte da equipe.",
  },
};

type TestElementProps = Record<string, unknown> & {
  children?: unknown;
  style?: Record<string, unknown>;
};

type TestElement = {
  props?: TestElementProps;
};

const toArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
};

const findElement = (
  node: unknown,
  predicate: (candidate: TestElement) => boolean,
): TestElement | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const candidate = node as TestElement;
  if (predicate(candidate)) {
    return candidate;
  }
  const children = toArray(candidate.props?.children);
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
};

describe("institutional og helper", () => {
  it("builds the page model using the page share image when available", () => {
    const model = buildInstitutionalOgCardModel({
      pageKey: "about",
      pages: basePages,
      settings: baseSettings,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model?.pageKey).toBe("about");
    expect(model?.title).toBe("Sobre");
    expect(model?.siteName).toBe("Nekomata");
    expect(model?.subtitle).toBe("Conheca melhor a equipe e a proposta editorial da Nekomata.");
    expect(model?.backgroundSource).toBe("page-share-image");
    expect(model?.backgroundUrl).toBe("/uploads/about-page.jpg?preset=hero");
  });

  it("falls back to the site default share image and uses fixed support text on projects", () => {
    const model = buildInstitutionalOgCardModel({
      pageKey: "projects",
      pages: {
        ...basePages,
        projects: {
          ...basePages.projects,
          shareImage: "",
        },
      },
      settings: baseSettings,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model?.title).toBe("Projetos");
    expect(model?.subtitle).toBe(
      "Explore os projetos da Nekomata, fansub e scan feita por f\u00e3s, com tradu\u00e7\u00f5es cuidadosas e carinho pela comunidade.",
    );
    expect(model?.backgroundSource).toBe("site-default-share-image");
    expect(model?.backgroundUrl).toBe("/uploads/default-og.jpg?preset=hero");
  });

  it("renders the dark base correctly when there is no configured background image", () => {
    const model = buildInstitutionalOgCardModel({
      pageKey: "faq",
      pages: {
        ...basePages,
        faq: {
          ...basePages.faq,
          shareImage: "",
        },
      },
      settings: {
        ...baseSettings,
        site: {
          ...baseSettings.site,
          defaultShareImage: "",
        },
      },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildInstitutionalOgScene(model || {});

    expect(
      findElement(scene, (candidate) => candidate.props?.["data-og-part"] === "background"),
    ).toBeNull();
    expect(
      findElement(scene, (candidate) => candidate.props?.["data-og-part"] === "overlay"),
    ).not.toBeNull();
  });

  it("renders the smoother multi-stop institutional overlay", () => {
    const model = buildInstitutionalOgCardModel({
      pageKey: "about",
      pages: basePages,
      settings: baseSettings,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildInstitutionalOgScene(model || {});
    const overlayNode = findElement(
      scene,
      (candidate) => candidate.props?.["data-og-part"] === "overlay",
    );

    expect(overlayNode).not.toBeNull();
    const background = String(overlayNode?.props?.style?.background || "");

    expect(overlayNode?.props?.style).toEqual(
      expect.objectContaining({
        opacity: 0.85,
      }),
    );
    expect(background).toContain("linear-gradient(180deg");
    expect(background).toContain(model?.palette?.accentDarkStart || "");
    expect(background).toContain(model?.palette?.accentDarkEnd || "");
    expect(background).toContain("0%");
    expect(background).toContain("12%");
    expect(background).toContain("28%");
    expect(background).toContain("46%");
    expect(background).toContain("66%");
    expect(background).toContain("84%");
    expect(background).toContain("100%");
  });

  it("renders a valid 1200x630 PNG", async () => {
    const model = buildInstitutionalOgCardModel({
      pageKey: "team",
      pages: {
        ...basePages,
        team: {
          ...basePages.team,
          shareImage: "",
        },
      },
      settings: {
        ...baseSettings,
        site: {
          ...baseSettings.site,
          defaultShareImage: "",
        },
      },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const imageResponse = buildInstitutionalOgImageResponse(model);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const metadata = await sharp(buffer).metadata();

    expect(metadata.width).toBe(OG_PROJECT_WIDTH);
    expect(metadata.height).toBe(OG_PROJECT_HEIGHT);
  });
});
