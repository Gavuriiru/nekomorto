import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Footer from "@/components/Footer";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: mergeSettings(defaultSettings, {}),
  }),
}));

describe("Footer copyright link distinction", () => {
  it("renderiza link de copyright com distinção visual estável (não só no hover)", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const copyrightLink = screen.getByRole("link", { name: defaultSettings.footer.copyright });
    expect(copyrightLink).toHaveAttribute("href", "/");
    expect(copyrightLink).toHaveClass("underline", "underline-offset-4");
  });
});
