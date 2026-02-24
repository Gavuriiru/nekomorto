import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";

const EDITOR_SCROLL_LOCKED_CLASS = "editor-scroll-locked";
const EDITOR_SCROLL_LOCK_COUNT_ATTR = "data-editor-scroll-lock-count";

const resetDocumentState = () => {
  document.documentElement.classList.remove(EDITOR_SCROLL_LOCKED_CLASS);
  document.body.classList.remove(EDITOR_SCROLL_LOCKED_CLASS);
  document.body.removeAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR);
};

describe("useEditorScrollLock", () => {
  beforeEach(() => {
    resetDocumentState();
  });

  it("adiciona e remove classes ao alternar enabled", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useEditorScrollLock(enabled),
      { initialProps: { enabled: false } },
    );

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBeNull();

    rerender({ enabled: true });

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBe("1");

    rerender({ enabled: false });

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBeNull();
  });

  it("mantem classes ativas ate o ultimo cleanup em mounts simultaneos", () => {
    const first = renderHook(() => useEditorScrollLock(true));
    const second = renderHook(() => useEditorScrollLock(true));

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBe("2");

    first.unmount();

    expect(document.documentElement).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBe("1");

    second.unmount();

    expect(document.documentElement).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body).not.toHaveClass(EDITOR_SCROLL_LOCKED_CLASS);
    expect(document.body.getAttribute(EDITOR_SCROLL_LOCK_COUNT_ATTR)).toBeNull();
  });
});
