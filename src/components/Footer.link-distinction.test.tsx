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
  it("renders copyright as plain text", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(screen.getByText(defaultSettings.footer.copyright)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: defaultSettings.footer.copyright })).not.toBeInTheDocument();
  });
});
