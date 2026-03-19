import type { ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Tooltip: () => null,
  Legend: () => null,
}));

import { ChartContainer } from "@/components/ui/chart";

const renderChart = () => {
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
  expect(surface).not.toBeNull();

  return {
    ...view,
    chart: chart as HTMLDivElement,
    surface: surface as SVGSVGElement,
  };
};

const stubImmediateAnimationFrame = () => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
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
  });

  it("blurs the Recharts surface when focus follows pointer interaction", () => {
    stubImmediateAnimationFrame();
    const { surface } = renderChart();
    const blurSpy = stubBlur(surface);

    fireEvent.pointerDown(surface);
    fireEvent.focusIn(surface);

    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on the Recharts surface without pointer interaction", () => {
    stubImmediateAnimationFrame();
    const { surface } = renderChart();
    const blurSpy = stubBlur(surface);

    fireEvent.focusIn(surface);

    expect(blurSpy).not.toHaveBeenCalled();
  });

  it("clears pointer modality on keydown so keyboard focus remains active", () => {
    stubImmediateAnimationFrame();
    const { chart, surface } = renderChart();
    const blurSpy = stubBlur(surface);

    fireEvent.pointerDown(surface);
    fireEvent.keyDown(chart, { key: "Tab" });
    fireEvent.focusIn(surface);

    expect(blurSpy).not.toHaveBeenCalled();
  });
});
