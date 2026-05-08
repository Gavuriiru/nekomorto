import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/components/HeroSection", () => ({
  default: () => <section data-testid="hero-section" />,
}));

vi.mock("@/components/ReleasesSection", () => ({
  default: () => <section data-testid="releases-section">Releases</section>,
}));

const originalIntersectionObserver = window.IntersectionObserver;
const originalScrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
const originalMatchMedia = window.matchMedia;

const setScrollY = (value: number) => {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value,
  });
};

const installIntersectionObserver = () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  let callbackRef: IntersectionObserverCallback | null = null;
  let optionsRef: IntersectionObserverInit | undefined;

  class MockIntersectionObserver {
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      callbackRef = callback;
      optionsRef = options;
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
    getOptions: () => optionsRef,
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

const createMatchMediaController = (initialIsMobile: boolean) => {
  let isMobile = initialIsMobile;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = "(max-width: 767px)";
  const dispatch = () => {
    const event = { matches: isMobile, media: query } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };

  window.matchMedia = vi.fn().mockImplementation((input: string) => ({
    matches: input === query ? isMobile : false,
    media: input,
    onchange: null,
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return {
    setIsMobile: (next: boolean) => {
      isMobile = next;
      dispatch();
    },
  };
};

describe("Index releases defer", () => {
  beforeEach(() => {
    window.location.hash = "";
    setScrollY(0);
  });

  afterEach(() => {
    if (originalScrollYDescriptor) {
      Object.defineProperty(window, "scrollY", originalScrollYDescriptor);
    }
    window.location.hash = "";
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
    vi.restoreAllMocks();
  });

  it("renderiza ReleasesSection imediatamente no desktop sem depender de scroll", async () => {
    createMatchMediaController(false);
    const observer = installIntersectionObserver();

    render(<Index />);

    expect(await screen.findByTestId("releases-section")).toBeInTheDocument();
    await waitFor(() => {
      expect(observer.observe).not.toHaveBeenCalled();
    });
  });

  it("nao renderiza ReleasesSection no load mobile sem scroll", async () => {
    createMatchMediaController(true);
    const observer = installIntersectionObserver();

    render(<Index />);

    expect(screen.queryByTestId("releases-section")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(observer.observe).not.toHaveBeenCalled();
    });
  });

  it("renderiza ReleasesSection apos scroll real e sentinela intersectar", async () => {
    createMatchMediaController(true);
    const observer = installIntersectionObserver();

    const { container } = render(<Index />);
    expect(screen.queryByTestId("releases-section")).not.toBeInTheDocument();

    setScrollY(32);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(observer.observe).toHaveBeenCalledTimes(1);
    });

    const sentinel = container.querySelector("div[aria-hidden='true']");
    expect(sentinel).not.toBeNull();
    expect(observer.getOptions()?.rootMargin).toBe("0px 0px -35% 0px");

    act(() => {
      observer.triggerIntersecting(sentinel as Element);
    });

    expect(await screen.findByTestId("releases-section")).toBeInTheDocument();
  });

  it("renderiza ReleasesSection imediatamente com hash #lancamentos", async () => {
    createMatchMediaController(true);
    const observer = installIntersectionObserver();
    window.location.hash = "#lancamentos";

    render(<Index />);

    expect(await screen.findByTestId("releases-section")).toBeInTheDocument();
    expect(observer.observe).not.toHaveBeenCalled();
  });

  it("forca render da ReleasesSection quando viewport muda de mobile para desktop", async () => {
    const media = createMatchMediaController(true);
    const observer = installIntersectionObserver();

    render(<Index />);
    expect(screen.queryByTestId("releases-section")).not.toBeInTheDocument();
    expect(observer.observe).not.toHaveBeenCalled();

    act(() => {
      media.setIsMobile(false);
    });

    expect(await screen.findByTestId("releases-section")).toBeInTheDocument();
    expect(observer.observe).not.toHaveBeenCalled();
  });
});
