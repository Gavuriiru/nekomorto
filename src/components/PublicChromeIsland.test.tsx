import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PublicChromeIsland, {
  PublicChromeNavigationBridge,
  navigateDocumentTo,
} from "../../src-astro/components/react/PublicChromeIsland";

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

const NavigationProbe = ({ onRouteChange }: { onRouteChange: (target: string) => void }) => {
  const navigate = useNavigate();

  return (
    <>
      <PublicChromeNavigationBridge onRouteChange={onRouteChange} />
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

  it("acompanha a rota interna sem recarregar o documento depois do mount inicial", async () => {
    const onRouteChange = vi.fn();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<NavigationProbe onRouteChange={onRouteChange} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(onRouteChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ir para sobre" }));

    await waitFor(() => {
      expect(onRouteChange).toHaveBeenCalledTimes(1);
    });
    expect(onRouteChange).toHaveBeenCalledWith("/sobre");
  });

  it("forca navegacao de documento quando o destino muda", () => {
    const assignSpy = vi.fn();

    navigateDocumentTo("/sobre", assignSpy);

    expect(assignSpy).toHaveBeenCalledWith("/sobre");
  });
});
