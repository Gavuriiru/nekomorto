import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemedSvgMaskIcon from "@/components/ThemedSvgMaskIcon";

const supportsMock = vi.hoisted(() => vi.fn());
const imageState = vi.hoisted(() => ({ shouldFail: false }));

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = "";

  set src(_value: string) {
    queueMicrotask(() => {
      if (imageState.shouldFail) {
        this.onerror?.();
        return;
      }
      this.onload?.();
    });
  }
}

describe("ThemedSvgMaskIcon", () => {
  beforeEach(() => {
    imageState.shouldFail = false;
    supportsMock.mockReset();
    supportsMock.mockImplementation(
      (property: string) => property === "mask-image" || property === "-webkit-mask-image",
    );
    vi.stubGlobal("CSS", { supports: supportsMock });
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza svg com mask e tint por currentColor quando suportado", async () => {
    render(
      <ThemedSvgMaskIcon
        url="https://cdn.exemplo.com/icon.svg"
        label="Icone com tema"
        className="h-4 w-4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Icone com tema" }).tagName).toBe("SPAN");
    });

    const icon = screen.getByRole("img", { name: "Icone com tema" });
    const inlineStyle = String(icon.getAttribute("style") || "").toLowerCase();

    expect(icon).toHaveClass("inline-block", "h-4", "w-4");
    expect(inlineStyle).toContain("background-color: currentcolor");
    expect(inlineStyle).toContain("mask-image");
  });

  it("bloqueia URL insegura (data:)", () => {
    const { queryByRole } = render(
      <ThemedSvgMaskIcon
        url="data:image/svg+xml,%3Csvg%3E%3Cscript%3Ealert(1)%3C/script%3E%3C/svg%3E"
        label="Icone inseguro"
      />,
    );

    expect(queryByRole("img", { name: "Icone inseguro" })).not.toBeInTheDocument();
  });

  it("faz fallback para img quando a URL nao e SVG", () => {
    render(
      <ThemedSvgMaskIcon
        url="https://cdn.exemplo.com/icon.png"
        label="Icone png"
        className="h-4 w-4"
      />,
    );

    const icon = screen.getByRole("img", { name: "Icone png" });
    expect(icon.tagName).toBe("IMG");
    expect(icon).toHaveAttribute("src", "https://cdn.exemplo.com/icon.png");
  });

  it("faz fallback para img quando mask-image nao e suportado", () => {
    supportsMock.mockReturnValue(false);

    render(
      <ThemedSvgMaskIcon
        url="https://cdn.exemplo.com/icon.svg"
        label="Icone sem suporte mask"
        className="h-4 w-4"
      />,
    );

    const icon = screen.getByRole("img", { name: "Icone sem suporte mask" });
    expect(icon.tagName).toBe("IMG");
    expect(icon).toHaveAttribute("src", "https://cdn.exemplo.com/icon.svg");
  });

  it("faz fallback para img quando o preflight da imagem falha", async () => {
    imageState.shouldFail = true;

    const { container } = render(
      <ThemedSvgMaskIcon
        url="https://cdn.exemplo.com/icon.svg"
        label="Icone com preflight falho"
        className="h-4 w-4"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Icone com preflight falho" }).tagName).toBe("IMG");
    });

    expect(container.querySelector("span[role='img']")).toBeNull();
  });
});
