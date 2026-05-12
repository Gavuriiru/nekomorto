import { defaultSettings } from "@/hooks/site-settings-context";
import { renderPublicApp } from "@/ssr/public-app";
import { emptyPublicBootstrapPayload } from "@/types/public-bootstrap";
import { emptyPublicPagesConfig } from "@/types/public-pages";
import { describe, expect, it } from "vitest";

describe("renderPublicApp", () => {
  it("renders a supported public route with bootstrap-backed content", () => {
    const html = renderPublicApp({
      initialPublicBootstrap: {
        ...emptyPublicBootstrapPayload,
        pages: {
          ...emptyPublicPagesConfig,
          about: {
            ...emptyPublicPagesConfig.about,
            heroBadge: "Manifesto",
            heroTitle: "Sobre a Nekomata",
            heroSubtitle: "Feito por pessoas que gostam de boas histórias.",
          },
        },
        settings: {
          ...defaultSettings,
          site: {
            ...defaultSettings.site,
            name: "Nekomata",
          },
        },
      },
      pathname: "/sobre",
    });

    expect(html).toContain("Sobre a Nekomata");
    expect(html).toContain("Feito por pessoas que gostam de boas histórias.");
  });
});
