import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "@/hooks/use-mobile";

const originalMatchMedia = window.matchMedia;

describe("useIsMobile", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("suporta MediaQueryList legado via addListener/removeListener", () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const removeListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        changeListener = listener;
      },
      removeListener,
      dispatchEvent: () => true,
    })) as unknown as typeof window.matchMedia;

    const { result, unmount } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");

    act(() => {
      changeListener?.({ matches: false } as MediaQueryListEvent);
    });

    expect(result.current).toBe(false);

    unmount();

    expect(removeListener).toHaveBeenCalledWith(changeListener);
  });
});
