import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardIslandApp from "./DashboardIslandApp";

const useRevealMock = vi.hoisted(() => vi.fn());
const initRouteMotionMock = vi.hoisted(() => vi.fn(() => undefined));

vi.mock("@/components/AppProviders", () => ({
  AppProviders: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock("@/components/ScrollToTop", () => ({
  default: () => <div data-testid="dashboard-scroll-to-top" />,
}));

vi.mock("@/hooks/use-reveal", () => ({
  useReveal: () => useRevealMock(),
}));

vi.mock("@/lib/route-motion", () => ({
  initRouteMotion: () => initRouteMotionMock(),
}));

vi.mock("@/routes/DashboardRoutes", () => ({
  default: () => <div>dashboard-route-content</div>,
}));

describe("DashboardIslandApp", () => {
  beforeEach(() => {
    useRevealMock.mockReset();
    initRouteMotionMock.mockClear();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("monta reveal e route motion no host Astro da dashboard", async () => {
    render(<DashboardIslandApp />);

    expect(await screen.findByText("dashboard-route-content")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-scroll-to-top")).toBeInTheDocument();
    expect(useRevealMock).toHaveBeenCalledTimes(1);
    expect(initRouteMotionMock).toHaveBeenCalledTimes(1);
  });
});
