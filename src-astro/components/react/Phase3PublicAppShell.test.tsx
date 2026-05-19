import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Link, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Phase3RouteShell } from "./Phase3PublicAppShell";
import {
  getPhase3PublicNavigation,
  PHASE3_PUBLIC_ROUTE_CHANGE_EVENT,
  Phase3PublicNavigationProvider,
} from "@/routes/public-phase3-navigation";

const useRevealMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-reveal", () => ({
  useReveal: () => useRevealMock(),
}));

vi.mock("@/components/ScrollToTop", () => ({
  default: () => <div data-testid="phase3-scroll-to-top" />,
}));

vi.mock("@/hooks/global-shortcuts-provider", () => ({
  GlobalShortcutsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/pages/Index", () => ({
  default: () => <div>phase3-home</div>,
}));

vi.mock("@/pages/Projects", () => ({
  default: () => <div>phase3-projects</div>,
}));

vi.mock("@/pages/Post", () => ({
  default: () => <div>phase3-post</div>,
}));

vi.mock("@/pages/Project", () => ({
  default: () => (
    <div>
      <div>phase3-project</div>
      <Link to="/projetos">anchor-projects</Link>
      <Link to="/">anchor-home</Link>
    </div>
  ),
}));

describe("Phase3RouteShell", () => {
  beforeEach(() => {
    useRevealMock.mockReset();
  });

  it("restores the shared shell runtime for project pages", async () => {
    render(
      <MemoryRouter initialEntries={["/projeto/teste"]}>
        <Phase3RouteShell />
      </MemoryRouter>,
    );

    expect(await screen.findByText("phase3-project")).toBeTruthy();
    expect(screen.getByTestId("phase3-scroll-to-top")).toBeTruthy();
    expect(useRevealMock).toHaveBeenCalledTimes(1);
  });

  it("keeps phase3 navigation inside the shared route tree", async () => {
    const originalAssign = window.location.assign;
    const assignSpy = vi.fn();
    Object.defineProperty(window.location, "assign", {
      value: assignSpy,
      configurable: true,
    });

    try {
      render(
        <MemoryRouter initialEntries={["/projeto/teste"]}>
          <Phase3RouteShell />
        </MemoryRouter>,
      );

      expect(await screen.findByText("phase3-project")).toBeTruthy();

      fireEvent.click(screen.getByRole("link", { name: "anchor-projects" }));
      expect(await screen.findByText("phase3-projects")).toBeTruthy();

      fireEvent.click(screen.getByRole("link", { name: "anchor-home" }));
      expect(await screen.findByText("phase3-home")).toBeTruthy();

      expect(assignSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window.location, "assign", {
        value: originalAssign,
        configurable: true,
      });
    }
  });

  it("registers the phase3 navigation bridge and emits route-change events", async () => {
    const routeChangeSpy = vi.fn();
    window.addEventListener(PHASE3_PUBLIC_ROUTE_CHANGE_EVENT, routeChangeSpy as EventListener);

    try {
      render(
        <MemoryRouter initialEntries={["/projeto/teste"]}>
          <Phase3PublicNavigationProvider>
            <Phase3RouteShell />
          </Phase3PublicNavigationProvider>
        </MemoryRouter>,
      );

      expect(await screen.findByText("phase3-project")).toBeTruthy();
      expect(getPhase3PublicNavigation()).toBeTruthy();

      fireEvent.click(screen.getByRole("link", { name: "anchor-projects" }));
      expect(await screen.findByText("phase3-projects")).toBeTruthy();

      expect(routeChangeSpy).toHaveBeenCalled();
    } finally {
      window.removeEventListener(
        PHASE3_PUBLIC_ROUTE_CHANGE_EVENT,
        routeChangeSpy as EventListener,
      );
    }
  });
});
