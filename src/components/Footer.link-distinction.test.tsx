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
  it("renderiza o copyright como texto sem transformar o simbolo em link", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const copyrightText = screen.getByText(defaultSettings.footer.copyright);
    expect(copyrightText.tagName).toBe("P");
    expect(copyrightText.querySelector("a")).not.toBeInTheDocument();
  });
});
