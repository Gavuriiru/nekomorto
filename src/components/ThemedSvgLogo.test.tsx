import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";

const toDataSvg = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

describe("ThemedSvgLogo", () => {
  it("adds a derived viewBox when svg has width/height but no viewBox", async () => {
    const svgWithoutViewBox =
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="271"><path d="M10 10H100V80H10Z" /></svg>';

    const { container } = render(
      <ThemedSvgLogo
        url={toDataSvg(svgWithoutViewBox)}
        label="Logo X"
        className="h-4 w-4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Logo X" }).querySelector("svg")).toBeInTheDocument();
    });

    const wrapper = screen.getByRole("img", { name: "Logo X" });
    const inlineSvg = wrapper.querySelector("svg");
    expect(inlineSvg).toHaveAttribute("viewBox", "0 0 300 271");
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("keeps an existing viewBox unchanged", async () => {
    const svgWithViewBox =
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="271" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" /></svg>';

    render(
      <ThemedSvgLogo
        url={toDataSvg(svgWithViewBox)}
        label="Logo com viewBox"
        className="h-4 w-4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Logo com viewBox" }).querySelector("svg")).toBeInTheDocument();
    });

    const inlineSvg = screen.getByRole("img", { name: "Logo com viewBox" }).querySelector("svg");
    expect(inlineSvg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});
