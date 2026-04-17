import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const responsiveContainerSpy = vi.hoisted(() => vi.fn());

vi.mock("recharts", () => ({
  ResponsiveContainer: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    initialDimension?: { width: number; height: number };
  }) => {
    responsiveContainerSpy(props);
    return <>{children}</>;
  },
  Tooltip: () => null,
  Legend: () => null,
}));

import { ChartContainer } from "@/components/ui/chart";

const renderChart = ({ expectSurface = true }: { expectSurface?: boolean } = {}) => {
  const view = render(
    <ChartContainer
      className="h-52 w-full"
      config={{ metric: { label: "Views", color: "hsl(var(--accent))" } }}
    >
      <svg className="recharts-surface" tabIndex={0}>
        <title>Views</title>
      </svg>
    </ChartContainer>,
  );

  const chart = view.container.querySelector("[data-chart]");
  const surface = view.container.querySelector(".recharts-surface");

  expect(chart).not.toBeNull();
  if (expectSurface) {
    expect(surface).not.toBeNull();
  }

  return {
    ...view,
    chart: chart as HTMLDivElement,
    surface: surface as SVGSVGElement | null,
  };
};

const stubImmediateAnimationFrame = () => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
};

const stubPositiveBoundingClientRect = (width = 480, height = 208) => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function getBoundingClientRect() {
      return {
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      } as DOMRect;
    },
  );
};

const stubBlur = (surface: SVGSVGElement) => {
  const blurSpy = vi.fn();
  Object.defineProperty(surface, "blur", {
    configurable: true,
    value: blurSpy,
  });
  return blurSpy;
};

describe("ChartContainer focus modality guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    responsiveContainerSpy.mockReset();
  });

  it("blurs the Recharts surface when focus follows pointer interaction", () => {
    stubImmediateAnimationFrame();
    stubPositiveBoundingClientRect();
    const { surface } = renderChart();
    const blurSpy = stubBlur(surface as SVGSVGElement);

    fireEvent.pointerDown(surface as SVGSVGElement);
    fireEvent.focusIn(surface as SVGSVGElement);

    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on the Recharts surface without pointer interaction", () => {
    stubImmediateAnimationFrame();
    stubPositiveBoundingClientRect();
    const { surface } = renderChart();
    const blurSpy = stubBlur(surface as SVGSVGElement);

    fireEvent.focusIn(surface as SVGSVGElement);

    expect(blurSpy).not.toHaveBeenCalled();
  });

  it("clears pointer modality on keydown so keyboard focus remains active", () => {
    stubImmediateAnimationFrame();
    stubPositiveBoundingClientRect();
    const { chart, surface } = renderChart();
    const blurSpy = stubBlur(surface as SVGSVGElement);

    fireEvent.pointerDown(surface as SVGSVGElement);
    fireEvent.keyDown(chart, { key: "Tab" });
    fireEvent.focusIn(surface as SVGSVGElement);

    expect(blurSpy).not.toHaveBeenCalled();
  });

  it("waits for a positive container size before mounting ResponsiveContainer", async () => {
    const originalResizeObserver = window.ResizeObserver;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    let resizeCallback = null as ResizeObserverCallback | null;
    let width = 0;
    let height = 0;

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}

      disconnect() {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      } as DOMRect;
    };

    try {
      const { surface } = renderChart({ expectSurface: false });

      expect(responsiveContainerSpy).not.toHaveBeenCalled();
      expect(surface).toBeNull();

      width = 480;
      height = 208;

      act(() => {
        resizeCallback?.([], {} as ResizeObserver);
      });

      await waitFor(() => {
        expect(responsiveContainerSpy).toHaveBeenCalledTimes(1);
      });

      expect(responsiveContainerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialDimension: {
            width: 480,
            height: 208,
          },
        }),
      );
    } finally {
      Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: originalResizeObserver,
      });
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});
