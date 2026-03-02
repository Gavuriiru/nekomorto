import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const originalMatchMedia = window.matchMedia;

const clearSidebarCookie = () => {
  document.cookie = "sidebar:state=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
};

const mockDesktopMatchMedia = () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
};

const getDesktopSidebarStateElement = () => {
  const sidebar = document.querySelector<HTMLElement>('[data-sidebar="sidebar"]');

  if (!sidebar) {
    throw new Error("Expected sidebar element to be rendered.");
  }

  const stateElement = sidebar.closest<HTMLElement>("[data-state]");

  if (!stateElement) {
    throw new Error("Expected sidebar state container to be rendered.");
  }

  return stateElement;
};

describe("Sidebar desktop toggle", () => {
  beforeEach(() => {
    clearSidebarCookie();
  });

  afterEach(() => {
    clearSidebarCookie();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("alterna a sidebar desktop e atualiza o offset compartilhado", () => {
    mockDesktopMatchMedia();

    render(
      <SidebarProvider data-testid="sidebar-provider">
        <SidebarTrigger />
        <Sidebar collapsible="icon">
          <div>Sidebar desktop content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    const provider = screen.getByTestId("sidebar-provider");
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    const sidebarState = getDesktopSidebarStateElement();

    expect(sidebarState.dataset.state).toBe("expanded");
    expect(provider.style.getPropertyValue("--sidebar-header-left")).toBe("16rem");

    fireEvent.click(trigger);

    expect(sidebarState.dataset.state).toBe("collapsed");
    expect(sidebarState.dataset.collapsible).toBe("icon");
    expect(provider.style.getPropertyValue("--sidebar-header-left")).toBe("calc(3rem + 1.5rem)");

    fireEvent.click(trigger);

    expect(sidebarState.dataset.state).toBe("expanded");
    expect(provider.style.getPropertyValue("--sidebar-header-left")).toBe("16rem");
  });

  it("inicializa a partir do cookie e persiste o novo estado desktop", async () => {
    mockDesktopMatchMedia();
    document.cookie = "sidebar:state=false; path=/";

    render(
      <SidebarProvider data-testid="sidebar-provider">
        <SidebarTrigger />
        <Sidebar collapsible="icon">
          <div>Sidebar desktop content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    const sidebarState = getDesktopSidebarStateElement();

    expect(sidebarState.dataset.state).toBe("collapsed");

    fireEvent.click(trigger);

    expect(sidebarState.dataset.state).toBe("expanded");

    await waitFor(() => {
      expect(document.cookie).toContain("sidebar:state=true");
    });
  });
});
