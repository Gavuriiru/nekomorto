import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/components/HeroSection", () => ({
  default: () => <section data-testid="hero-section" />,
}));

vi.mock("@/components/ReleasesSection", () => ({
  default: () => <section data-testid="releases-section">Releases</section>,
}));

describe("Index releases defer", () => {
  it("renderiza ReleasesSection imediatamente independente de viewport", async () => {
    render(<Index />);

    expect(await screen.findByTestId("releases-section")).toBeInTheDocument();
  });

  it("renderiza ReleasesSection junto com HeroSection", () => {
    render(<Index />);

    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("releases-section")).toBeInTheDocument();
  });
});
