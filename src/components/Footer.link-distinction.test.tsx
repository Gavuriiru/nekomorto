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

describe("Footer copyright text", () => {
  it("allows overriding the footer shell background", () => {
    render(
      <MemoryRouter>
        <Footer shellClassName="bg-gradient-surface" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("contentinfo")).toHaveClass("bg-gradient-surface");
  });

  it("renders copyright as plain text and legal links separately", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(screen.getByText(defaultSettings.footer.copyright)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: defaultSettings.footer.copyright }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
      "href",
      "/termos-de-uso",
    );
    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/politica-de-privacidade",
    );
  });

  it("uses an opaque footer shell without external top margin", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const footer = screen.getByRole("contentinfo");
    const [mainSection, lowerSection] = Array.from(footer.children) as HTMLElement[];

    expect(footer).toHaveClass("border-t", "border-border/60", "bg-background");
    expect(footer).not.toHaveClass("mt-16", "bg-card/60");
    expect(mainSection).toHaveClass("pt-16", "pb-14");
    expect(lowerSection).toHaveClass("border-t", "border-border/60", "bg-background");
    expect(lowerSection).not.toHaveClass("bg-background/40");
  });
});
