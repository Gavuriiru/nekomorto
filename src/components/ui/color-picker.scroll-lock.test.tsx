import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "@/components/ui/color-picker";

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

    expect(await screen.findByLabelText("Hex")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.body.getAttribute("data-scroll-locked")).toBeNull();
      expect(document.body.className).not.toContain("with-scroll-bars-hidden");
      expect(document.body.style.marginRight).toBe("");
      expect(document.documentElement.style.overflow).not.toBe("hidden");
      expect(document.documentElement.style.paddingRight).toBe("");
      expect(document.documentElement.style.scrollbarGutter).toBe("");
    });
  });
});
