import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PublicChromeIsland, {
  PublicChromeNavigationBridge,
} from "../../src-astro/components/react/PublicChromeIsland";

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

const NavigationProbe = ({ reloadDocument }: { reloadDocument: (target: string) => void }) => {
  const navigate = useNavigate();

  return (
    <>
      <PublicChromeNavigationBridge reloadDocument={reloadDocument} />
      <button type="button" onClick={() => navigate("/sobre")}>
        Ir para sobre
      </button>
    </>
  );
};

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

  it("recarrega o documento quando a rota interna muda depois do mount inicial", async () => {
    const reloadDocument = vi.fn();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<NavigationProbe reloadDocument={reloadDocument} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(reloadDocument).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ir para sobre" }));

    await waitFor(() => {
      expect(reloadDocument).toHaveBeenCalledTimes(1);
    });
    expect(reloadDocument).toHaveBeenCalledWith("/sobre");
  });
});
