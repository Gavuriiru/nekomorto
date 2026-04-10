import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicInteractiveCardShell from "@/components/PublicInteractiveCardShell";

describe("PublicInteractiveCardShell", () => {
  it("renderiza as camadas de shadow no preset padrao", () => {
    const html = renderToStaticMarkup(
      <PublicInteractiveCardShell className="group/example">
        <div>conteudo</div>
      </PublicInteractiveCardShell>,
    );

    expect(html).toContain("public-interactive-card-shadow--base");
    expect(html).toContain("public-interactive-card-shadow--hover");
    expect(html).not.toContain("public-interactive-card-shell--no-shadow");
  });

  it("omite as camadas de shadow no preset none", () => {
    const html = renderToStaticMarkup(
      <PublicInteractiveCardShell shadowPreset="none" className="group/example">
        <div>conteudo</div>
      </PublicInteractiveCardShell>,
    );

    expect(html).toContain("public-interactive-card-shell--no-shadow");
    expect(html).not.toContain("public-interactive-card-shadow--base");
    expect(html).not.toContain("public-interactive-card-shadow--hover");
  });
});
