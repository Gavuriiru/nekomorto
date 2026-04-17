import { ColorPicker } from "@/components/ui/color-picker";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const findAncestor = (
  element: HTMLElement,
  predicate: (candidate: HTMLElement) => boolean,
): HTMLElement | null => {
  let current = element.parentElement;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const removeClassName = (className: string) => {
  document.body.className = document.body.className
    .split(/\s+/)
    .filter((token) => token && token !== className)
    .join(" ");
};

const resetScrollLockSideEffects = () => {
  document.body.removeAttribute("data-scroll-locked");
  removeClassName("with-scroll-bars-hidden");
  document.body.style.marginRight = "";
  document.documentElement.style.overflow = "";
  document.documentElement.style.paddingRight = "";
  document.documentElement.style.scrollbarGutter = "";
};

describe("ColorPicker scroll lock", () => {
  beforeEach(() => {
    resetScrollLockSideEffects();
  });

  it("abre o painel sem bloquear o scroll da pagina", async () => {
    const user = userEvent.setup();

    render(<ColorPicker label="Abrir picker" value="#112233" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Abrir picker/i }));

    const hexInput = await screen.findByLabelText("Hex");
    expect(hexInput).toBeInTheDocument();

    const panel = hexInput.closest(".rainbow-color-picker-panel");
    expect(panel).not.toBeNull();
    expect(classTokens(panel as HTMLElement)).toContain("w-full");

    const popover = findAncestor(panel as HTMLElement, (candidate) => {
      const tokens = classTokens(candidate);
      return tokens.includes("shadow-floating-soft") && tokens.includes("overflow-hidden");
    });
    expect(popover).not.toBeNull();
    expect(classTokens(popover as HTMLElement)).toEqual(
      expect.arrayContaining([
        "w-[min(18rem,calc(100vw-1rem))]",
        "min-w-[min(16rem,calc(100vw-1rem))]",
        "max-w-[calc(100vw-1rem)]",
      ]),
    );

    await waitFor(() => {
      expect(document.body.getAttribute("data-scroll-locked")).toBeNull();
      expect(document.body.className).not.toContain("with-scroll-bars-hidden");
      expect(document.body.style.marginRight).toBe("");
      expect(document.documentElement.style.overflow).not.toBe("hidden");
      expect(document.documentElement.style.paddingRight).toBe("");
      expect(document.documentElement.style.scrollbarGutter).toBe("");
    });
  });

  it("mantem a mesma largura responsiva no modo inline", async () => {
    render(<ColorPicker inline label="Cor inline" value="#112233" onChange={vi.fn()} />);

    const hexInput = await screen.findByLabelText("Hex");
    const panel = hexInput.closest(".rainbow-color-picker-panel");

    expect(panel).not.toBeNull();
    expect(classTokens(panel as HTMLElement)).toEqual(
      expect.arrayContaining([
        "w-[min(18rem,calc(100vw-1rem))]",
        "min-w-[min(16rem,calc(100vw-1rem))]",
        "max-w-[calc(100vw-1rem)]",
      ]),
    );
  });
});
