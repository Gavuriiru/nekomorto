import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReorderControls from "@/components/ReorderControls";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("ReorderControls keyboard support", () => {
  it("supports click and Alt+Arrow shortcuts while announcing movement", async () => {
    const onMove = vi.fn();

    render(
      <AccessibilityAnnouncerProvider>
        <ReorderControls label="item" index={1} total={3} onMove={onMove} />
      </AccessibilityAnnouncerProvider>,
    );

    const moveUpButton = screen.getByRole("button", { name: /Mover item para cima/i });
    const moveDownButton = screen.getByRole("button", { name: /Mover item para baixo/i });
    const moveUpTokens = classTokens(moveUpButton);

    expect(moveUpTokens).toEqual(
      expect.arrayContaining(["h-8", "w-8", "rounded-xl", "bg-background", "shadow-none"]),
    );
    expect(moveUpTokens).not.toContain("interactive-lift-sm");
    expect(moveUpTokens).not.toContain("pressable");

    fireEvent.keyDown(moveUpButton, { key: "ArrowUp", altKey: true });

    expect(onMove).toHaveBeenNthCalledWith(1, 0);
    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(/item movido/i);
    });

    fireEvent.click(moveDownButton);
    expect(onMove).toHaveBeenNthCalledWith(2, 2);
  });
});
