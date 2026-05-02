import { Toaster } from "@/components/ui/sonner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => ({ effectiveMode: "dark" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: { theme?: string }) => (
    <div data-testid="sonner-toaster" data-theme={props.theme} />
  ),
}));

describe("Toaster", () => {
  it("renderiza fora do root para ficar acima de dialogs portaled", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    render(<Toaster />, { container: root });

    const toaster = screen.getByTestId("sonner-toaster");
    expect(toaster).toHaveAttribute("data-theme", "dark");
    expect(root).not.toContainElement(toaster);
    expect(document.body).toContainElement(toaster);

    root.remove();
  });
});
