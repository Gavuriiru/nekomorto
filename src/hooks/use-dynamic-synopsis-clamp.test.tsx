import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DynamicSynopsisClampMaxLinesContext,
  useDynamicSynopsisClamp,
} from "@/hooks/use-dynamic-synopsis-clamp";

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
  property: "clientHeight" | "offsetHeight" | "clientWidth",
  value: number,
) => {
  Object.defineProperty(element, property, {
    configurable: true,
    get: () => value,
  });
};

const defineColumnRectWidth = (element: Element, width: number) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        width,
        height: 0,
        top: 0,
        right: width,
        bottom: 0,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) satisfies DOMRect,
  });
};

const createResizeObserverEntry = (target: Element) =>
  ({ target }) as unknown as ResizeObserverEntry;

const Harness = ({
  maxLines = 3,
  keys = ["project-1"],
  resolveMaxLines,
}: {
  maxLines?: number;
  keys?: string[];
  resolveMaxLines?: (context: DynamicSynopsisClampMaxLinesContext) => number | null | undefined;
}) => {
  const { rootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: true,
    keys,
    maxLines,
    resolveMaxLines,
  });

  return (
    <div ref={rootRef}>
      <div data-testid="column-project-1" data-synopsis-role="column" data-synopsis-key="project-1">
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
      {keys.includes("project-2") ? (
        <div
          data-testid="column-project-2"
          data-synopsis-role="column"
          data-synopsis-key="project-2"
        >
          <div data-testid="title-project-2" data-synopsis-role="title">
            <div>Meta</div>
            <div>Titulo 2</div>
          </div>
          <p data-testid="synopsis-project-2" data-synopsis-role="synopsis">
            Sinopse 2
          </p>
          <div data-testid="badges-project-2" data-synopsis-role="badges">
            Badges 2
          </div>
        </div>
      ) : null}
      <output data-testid="lines">{String(lineByKey["project-1"] ?? "")}</output>
      {keys.includes("project-2") ? (
        <output data-testid="lines-project-2">{String(lineByKey["project-2"] ?? "")}</output>
      ) : null}
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
        if ((element as HTMLElement).dataset.testid?.startsWith("column")) {
          return {
            paddingTop: "8px",
            paddingBottom: "12px",
          } as CSSStyleDeclaration;
        }
        if ((element as HTMLElement).dataset.testid?.startsWith("synopsis")) {
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

    const column = screen.getByTestId("column-project-1");
    const title = screen.getByTestId("title");
    const synopsis = screen.getByTestId("synopsis");
    const badges = screen.getByTestId("badges");

    defineDimension(column, "clientHeight", 80);
    defineDimension(title, "offsetHeight", 20);
    defineDimension(badges, "offsetHeight", 10);
    defineDimension(synopsis, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.([createResizeObserverEntry(column)], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("2");
    });

    expect(getComputedStyleSpy).toHaveBeenCalledWith(column);
    expect(getComputedStyleSpy).toHaveBeenCalledWith(synopsis);
  });

  it("nunca produz linhas negativas quando a altura util fica abaixo de zero", async () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      if ((element as HTMLElement).dataset.testid?.startsWith("column")) {
        return {
          paddingTop: "20px",
          paddingBottom: "20px",
        } as CSSStyleDeclaration;
      }
      if ((element as HTMLElement).dataset.testid?.startsWith("synopsis")) {
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

    const column = screen.getByTestId("column-project-1");
    const title = screen.getByTestId("title");
    const badges = screen.getByTestId("badges");
    const synopsis = screen.getByTestId("synopsis");

    defineDimension(column, "clientHeight", 50);
    defineDimension(title, "offsetHeight", 18);
    defineDimension(badges, "offsetHeight", 8);
    defineDimension(synopsis, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.([createResizeObserverEntry(column)], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("0");
    });
  });

  it("aplica um teto responsivo por largura do card antes de considerar a altura util", async () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      if ((element as HTMLElement).dataset.testid?.startsWith("column")) {
        return {
          paddingTop: "0px",
          paddingBottom: "0px",
        } as CSSStyleDeclaration;
      }
      if ((element as HTMLElement).dataset.testid?.startsWith("synopsis")) {
        return {
          lineHeight: "12px",
          fontSize: "12px",
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

    render(
      <Harness
        maxLines={4}
        resolveMaxLines={({ columnWidth, defaultMaxLines }) =>
          columnWidth <= 300 ? 2 : defaultMaxLines
        }
      />,
    );

    const column = screen.getByTestId("column-project-1");
    const title = screen.getByTestId("title");
    const badges = screen.getByTestId("badges");
    const synopsis = screen.getByTestId("synopsis");

    defineDimension(column, "clientHeight", 160);
    defineDimension(column, "clientWidth", 280);
    defineColumnRectWidth(column, 280);
    defineDimension(title, "offsetHeight", 24);
    defineDimension(badges, "offsetHeight", 12);
    defineDimension(synopsis, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.([createResizeObserverEntry(column)], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("2");
    });

    defineDimension(column, "clientWidth", 520);
    defineColumnRectWidth(column, 520);

    act(() => {
      resizeObserverCallback?.([createResizeObserverEntry(column)], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("4");
    });
  });

  it("recalcula cards diferentes no mesmo container usando o teto especifico de cada largura", async () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      if ((element as HTMLElement).dataset.testid?.startsWith("column")) {
        return {
          paddingTop: "0px",
          paddingBottom: "0px",
        } as CSSStyleDeclaration;
      }
      if ((element as HTMLElement).dataset.testid?.startsWith("synopsis")) {
        return {
          lineHeight: "10px",
          fontSize: "10px",
          marginTop: "6px",
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

    render(
      <Harness
        keys={["project-1", "project-2"]}
        maxLines={3}
        resolveMaxLines={({ columnWidth, defaultMaxLines }) =>
          columnWidth <= 220 ? 1 : defaultMaxLines
        }
      />,
    );

    const columnOne = screen.getByTestId("column-project-1");
    const columnTwo = screen.getByTestId("column-project-2");
    const titleOne = screen.getByTestId("title");
    const titleTwo = screen.getByTestId("title-project-2");
    const badgesOne = screen.getByTestId("badges");
    const badgesTwo = screen.getByTestId("badges-project-2");
    const synopsisOne = screen.getByTestId("synopsis");
    const synopsisTwo = screen.getByTestId("synopsis-project-2");

    defineDimension(columnOne, "clientHeight", 120);
    defineDimension(columnOne, "clientWidth", 210);
    defineColumnRectWidth(columnOne, 210);
    defineDimension(titleOne, "offsetHeight", 20);
    defineDimension(badgesOne, "offsetHeight", 12);
    defineDimension(synopsisOne, "offsetHeight", 0);

    defineDimension(columnTwo, "clientHeight", 120);
    defineDimension(columnTwo, "clientWidth", 360);
    defineColumnRectWidth(columnTwo, 360);
    defineDimension(titleTwo, "offsetHeight", 20);
    defineDimension(badgesTwo, "offsetHeight", 12);
    defineDimension(synopsisTwo, "offsetHeight", 0);

    act(() => {
      resizeObserverCallback?.(
        [createResizeObserverEntry(columnOne), createResizeObserverEntry(columnTwo)],
        {} as ResizeObserver,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("lines")).toHaveTextContent("1");
      expect(screen.getByTestId("lines-project-2")).toHaveTextContent("3");
    });
  });
});
