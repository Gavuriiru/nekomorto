import { useEffect } from "react";

const EDITOR_SCROLL_STABLE_CLASS = "editor-scroll-stable";
const EDITOR_SCROLL_STABLE_COUNT_ATTR = "data-editor-scroll-stable-count";

const parseStableCount = (value: string | null) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 0;
  }
  return parsed;
};

export const useEditorScrollStability = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const { documentElement, body } = document;
    const nextCount = parseStableCount(body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR)) + 1;

    body.setAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR, String(nextCount));
    documentElement.classList.add(EDITOR_SCROLL_STABLE_CLASS);
    body.classList.add(EDITOR_SCROLL_STABLE_CLASS);

    return () => {
      const currentCount = parseStableCount(body.getAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR));
      const remainingCount = Math.max(0, currentCount - 1);

      if (remainingCount > 0) {
        body.setAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR, String(remainingCount));
        return;
      }

      body.removeAttribute(EDITOR_SCROLL_STABLE_COUNT_ATTR);
      documentElement.classList.remove(EDITOR_SCROLL_STABLE_CLASS);
      body.classList.remove(EDITOR_SCROLL_STABLE_CLASS);
    };
  }, [enabled]);
};
