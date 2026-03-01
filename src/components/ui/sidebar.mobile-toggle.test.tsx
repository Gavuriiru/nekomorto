import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const originalMatchMedia = window.matchMedia;

describe("Sidebar mobile toggle", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("abre e fecha a sidebar mobile pelo mesmo trigger com matchMedia legado", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    })) as unknown as typeof window.matchMedia;

    render(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar>
          <div>Sidebar mobile content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });

    expect(screen.queryByText("Sidebar mobile content")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(await screen.findByText("Sidebar mobile content")).toBeInTheDocument();

    const dialog = await screen.findByRole("dialog");
    const dialogStyle = dialog.getAttribute("style") || "";
    expect(dialogStyle).toContain("top: 4.75rem;");
    expect(dialogStyle).toContain("height: calc(100svh - 4.75rem);");

    const overlay = Array.from(document.body.querySelectorAll<HTMLElement>("[data-state='open']")).find(
      (element) => element.getAttribute("role") !== "dialog",
    );

    expect(overlay).toBeTruthy();
    expect(String(overlay?.className)).toContain("top-[4.75rem]");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText("Sidebar mobile content")).not.toBeInTheDocument();
    });
  });
});
