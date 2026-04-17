import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDeferredVisibility } from "@/hooks/use-deferred-visibility";

const originalIntersectionObserver = window.IntersectionObserver;

const installIntersectionObserver = () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  let callbackRef: IntersectionObserverCallback | null = null;

  class MockIntersectionObserver {
    observe = observe;
    disconnect = disconnect;

    constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      callbackRef = callback;
    }
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });

  return {
    observe,
    disconnect,
    triggerIntersecting: (target: Element) => {
      if (!callbackRef) {
        return;
      }
      callbackRef(
        [
          {
            isIntersecting: true,
            target,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
  };
};

const LateMountHarness = () => {
  const [showSentinel, setShowSentinel] = useState(false);
  const { isVisible, sentinelRef } = useDeferredVisibility();

  return (
    <div>
      <span data-testid="deferred-visible">{String(isVisible)}</span>
      <button type="button" onClick={() => setShowSentinel(true)}>
        Montar sentinel
      </button>
      {showSentinel ? <div ref={sentinelRef} data-testid="deferred-sentinel" /> : null}
    </div>
  );
};

const InitialVisibleHarness = () => {
  const [initialVisible, setInitialVisible] = useState(false);
  const { isVisible, sentinelRef } = useDeferredVisibility({ initialVisible });

  return (
    <div>
      <span data-testid="deferred-visible">{String(isVisible)}</span>
      <button type="button" onClick={() => setInitialVisible(true)}>
        Tornar visivel
      </button>
      <div ref={sentinelRef} data-testid="deferred-sentinel" />
    </div>
  );
};

describe("useDeferredVisibility", () => {
  afterEach(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
    vi.restoreAllMocks();
  });

  it("observa um sentinel montado depois do render inicial", async () => {
    const observer = installIntersectionObserver();

    render(<LateMountHarness />);

    expect(screen.getByTestId("deferred-visible")).toHaveTextContent("false");
    expect(observer.observe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Montar sentinel" }));

    const sentinel = await screen.findByTestId("deferred-sentinel");

    await waitFor(() => {
      expect(observer.observe).toHaveBeenCalledWith(sentinel);
    });

    act(() => {
      observer.triggerIntersecting(sentinel);
    });

    await waitFor(() => {
      expect(screen.getByTestId("deferred-visible")).toHaveTextContent("true");
    });
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("promove initialVisible para true depois do mount", async () => {
    const observer = installIntersectionObserver();

    render(<InitialVisibleHarness />);

    const sentinel = await screen.findByTestId("deferred-sentinel");

    await waitFor(() => {
      expect(observer.observe).toHaveBeenCalledWith(sentinel);
    });
    expect(screen.getByTestId("deferred-visible")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Tornar visivel" }));

    await waitFor(() => {
      expect(screen.getByTestId("deferred-visible")).toHaveTextContent("true");
    });
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
