import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicChromeIsland from "./PublicChromeIsland";

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
    expect(html).toContain("InÃ­cio");
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
    expect(html).toContain("DoaÃ§Ãµes");
    expect(html).toContain("Termos de Uso");
    expect(html).toContain("PolÃ­tica de Privacidade");
  });
});
