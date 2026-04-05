import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";

let resizeObserverCallback: ResizeObserverCallback | null = null;

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}

  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

const defineDimension = (
  element: Element,
  property: "clientHeight" | "offsetHeight",
  value: number,
) => {
  Object.defineProperty(element, property, {
    configurable: true,
    get: () => value,
  });
};

const Harness = ({ maxLines = 3 }: { maxLines?: number }) => {
  const { rootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: true,
    keys: ["project-1"],
    maxLines,
  });

  return (
    <div ref={rootRef}>
      <div data-testid="column" data-synopsis-role="column" data-synopsis-key="project-1">
        <div data-testid="title" data-synopsis-role="title">
          <div>Meta</div>
          <div>Titulo</div>
        </div>
        <p data-testid="synopsis" data-synopsis-role="synopsis">
          Sinopse
        </p>
        <div data-testid="badges" data-synopsis-role="badges">
          Badges
        </div>
      </div>
      <output data-testid="lines">{String(lineByKey["project-1"] ?? "")}</output>
    </div>
  );
};

describe("useDynamicSynopsisClamp", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
    window.requestAnimationFrame = vi.fn(() => 1) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn() as typeof window.cancelAnimationFrame;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalResizeObserver,
    });
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it("desconta padding vertical do column ao calcular as linhas da sinopse", async () => {
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element) => {
        if ((element as HTMLElement).dataset.testid === "column") {
          return {
            paddingTop: "8px",
            paddingBottom: "12px",
          } as CSSStyleDeclaration;
        }
        if ((element as HTMLElement).dataset.testid === "synopsis") {
          return {
            lineHeight: "10px",
            fontSize: "10px",
            marginTop: "8px",
          } as CSSStyleDeclaration;
        }
        return {
          paddingTop: "0px",
          paddingBottom: "0px",
          lineHeight: "0px",
          fontSize: "0px",
          marginTop: "0px",
        } as CSSStyleDeclaration;
      });

    render(<Harness />);

    const column = screen.getByTestId("column");
    const title = screen.getByTestId("title");
    const synopsis = screen.getByTestId("synopsis");
    const badges = screen.getByTestId("badges");

    defineDimension(column, "clientHeight", 80);
    defineDimension(title, "offsetHeight", 20);
    defineDimension(badges, "offsetHeight", 10);
    defineDimension(synopsis, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.([{ target: column } as ResizeObserverEntry], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("2");
    });

    expect(getComputedStyleSpy).toHaveBeenCalledWith(column);
    expect(getComputedStyleSpy).toHaveBeenCalledWith(synopsis);
  });

  it("nunca produz linhas negativas quando a altura util fica abaixo de zero", async () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      if ((element as HTMLElement).dataset.testid === "column") {
        return {
          paddingTop: "20px",
          paddingBottom: "20px",
        } as CSSStyleDeclaration;
      }
      if ((element as HTMLElement).dataset.testid === "synopsis") {
        return {
          lineHeight: "12px",
          fontSize: "12px",
          marginTop: "10px",
        } as CSSStyleDeclaration;
      }
      return {
        paddingTop: "0px",
        paddingBottom: "0px",
        lineHeight: "0px",
        fontSize: "0px",
        marginTop: "0px",
      } as CSSStyleDeclaration;
    });

    render(<Harness />);

    const column = screen.getByTestId("column");
    const title = screen.getByTestId("title");
    const badges = screen.getByTestId("badges");
    const synopsis = screen.getByTestId("synopsis");

    defineDimension(column, "clientHeight", 50);
    defineDimension(title, "offsetHeight", 18);
    defineDimension(badges, "offsetHeight", 8);
    defineDimension(synopsis, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.([{ target: column } as ResizeObserverEntry], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("0");
    });
  });
});
