import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicChromeIsland from "../../src-astro/components/react/PublicChromeIsland";

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

describe("PublicChromeIsland", () => {
  it("server-renders the public header", () => {
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
    expect(html).toContain("NEKOMATA");
  });

  it("server-renders the public footer with configured legal links", () => {
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
});
