import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useReveal } from "@/hooks/use-reveal";

const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalIntersectionObserver = window.IntersectionObserver;

const setReducedMotion = (enabled: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? enabled : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

const installIntersectionObserver = () => {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  let callbackRef: IntersectionObserverCallback | null = null;

  class MockIntersectionObserver {
    observe = observe;
    unobserve = unobserve;
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
    unobserve,
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

const RevealHarness = () => {
  useReveal();
  return (
    <div data-reveal className="reveal" data-testid="reveal-target">
      <h1 className="animate-slide-up">Reveal</h1>
    </div>
  );
};

describe("useReveal", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
    vi.restoreAllMocks();
  });

  it("marca elemento como visivel quando ja esta no viewport", async () => {
    setReducedMotion(false);
    const observer = installIntersectionObserver();

    render(
      <MemoryRouter>
        <RevealHarness />
      </MemoryRouter>,
    );

    const target = screen.getByTestId("reveal-target");
    observer.triggerIntersecting(target);

    await waitFor(() => {
      expect(target).toHaveClass("reveal-visible");
      expect(target).not.toHaveClass("reveal-hidden");
    });

    expect(observer.unobserve).toHaveBeenCalledWith(target);
  });

  it("respeita prefers-reduced-motion e exibe elemento sem animacao de entrada", async () => {
    setReducedMotion(true);
    const observer = installIntersectionObserver();

    render(
      <MemoryRouter>
        <RevealHarness />
      </MemoryRouter>,
    );

    const target = screen.getByTestId("reveal-target");

    await waitFor(() => {
      expect(target).toHaveClass("reveal-visible");
      expect(target).not.toHaveClass("reveal-hidden");
    });

    expect(observer.observe).not.toHaveBeenCalled();
  });

  it("mantem elemento visivel quando IntersectionObserver nao existe", async () => {
    setReducedMotion(false);
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(
      <MemoryRouter>
        <RevealHarness />
      </MemoryRouter>,
    );

    const target = screen.getByTestId("reveal-target");

    await waitFor(() => {
      expect(target).toHaveClass("reveal-visible");
      expect(target).not.toHaveClass("reveal-hidden");
    });
  });

  it("nao executa leitura sincrona de layout no fluxo inicial", async () => {
    setReducedMotion(false);
    const observer = installIntersectionObserver();
    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

    render(
      <MemoryRouter>
        <RevealHarness />
      </MemoryRouter>,
    );

    const target = screen.getByTestId("reveal-target");
    observer.triggerIntersecting(target);

    await waitFor(() => {
      expect(target).toHaveClass("reveal-visible");
    });
    expect(getBoundingClientRectSpy).not.toHaveBeenCalled();
  });
});
