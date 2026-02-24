import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";

const EDITOR_SCROLL_STABLE_CLASS = "editor-scroll-stable";
const EDITOR_SCROLL_STABLE_COUNT_ATTR = "data-editor-scroll-stable-count";

const resetDocumentState = () => {
  document.documentElement.classList.remove(EDITOR_SCROLL_STABLE_CLASS);
  document.body.classList.remove(EDITOR_SCROLL_STABLE_CLASS);
  document.body.removeAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR);
};

describe("useEditorScrollStability", () => {
  beforeEach(() => {
    resetDocumentState();
  });

  it("adiciona e remove classes ao alternar enabled", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useEditorScrollStability(enabled),
      { initialProps: { enabled: false } },
    );

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBeNull();

    rerender({ enabled: true });

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBe("1");

    rerender({ enabled: false });

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBeNull();
  });

  it("mantem classes ativas ate o ultimo cleanup em mounts simultaneos", () => {
    const first = renderHook(() => useEditorScrollStability(true));
    const second = renderHook(() => useEditorScrollStability(true));

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBe("2");

    first.unmount();

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBe("1");

    second.unmount();

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_STABLE_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)).toBeNull();
  });
});
