import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import {
  getPhase3PublicNavigation,
  isPhase3PublicPath,
  PublicChromePhase3Link,
} from "@/routes/public-phase3-navigation";
import type { SiteSettings } from "@/types/site-settings";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PublicChromeIsland from "../../src-astro/components/react/PublicChromeIsland";

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

describe("PublicChromeIsland", () => {
  it("server-renders the public header with the current route highlighted", () => {
    const html = renderToString(
      <PublicChromeIsland
        kind="header"
        location="/sobre"
        initialCurrentUser={null}
        initialPublicBootstrap={null}
        initialPublicRoutePayload={null}
        initialSettings={createSettings()}
      />,
    );

    expect(html).toContain("fixed top-0");
    expect(html).toContain("Sobre");
    expect(html).toContain("font-semibold");
  });

  it("server-renders the public footer with configured links and legal routes", () => {
    const html = renderToString(
      <PublicChromeIsland
        kind="footer"
        location="/faq"
        initialCurrentUser={null}
        initialPublicBootstrap={null}
        initialPublicRoutePayload={null}
        initialSettings={createSettings()}
      />,
    );

    expect(html).toContain("Recrutamento");
    expect(html).toContain("Termos de Uso");
    expect(html).toContain("Pol");
  });

  it("classifies only phase3 public routes for shared SPA navigation", () => {
    expect(isPhase3PublicPath("/")).toBe(true);
    expect(isPhase3PublicPath("/projetos")).toBe(true);
    expect(isPhase3PublicPath("/projetos?tag=Magic")).toBe(true);
    expect(isPhase3PublicPath("/projeto/21878")).toBe(true);
    expect(isPhase3PublicPath("/postagem/novo-post")).toBe(true);
    expect(isPhase3PublicPath("/sobre")).toBe(false);
    expect(isPhase3PublicPath("/dashboard")).toBe(false);
    expect(isPhase3PublicPath("https://example.com")).toBe(false);
  });

  it("intercepts phase3 chrome links when the page bridge is available", () => {
    const navigateSpy = vi.fn();
    const browserWindow = window as Window &
      typeof globalThis & {
        __NEKOMATA_PHASE3_NAV__?: ReturnType<typeof getPhase3PublicNavigation>;
      };
    browserWindow.__NEKOMATA_PHASE3_NAV__ = {
      getCurrentPath: () => "/projeto/teste",
      navigate: navigateSpy,
      replace: vi.fn(),
    };

    try {
      render(<PublicChromePhase3Link href="/projetos">Projetos</PublicChromePhase3Link>);
      fireEvent.click(screen.getByRole("link", { name: "Projetos" }));
      expect(navigateSpy).toHaveBeenCalledWith("/projetos");
    } finally {
      delete browserWindow.__NEKOMATA_PHASE3_NAV__;
    }
  });
});
