import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

type UseDynamicSynopsisClampParams<T extends HTMLElement = HTMLDivElement> = {
  enabled: boolean;
  keys: string[];
  maxLines?: number;
  scopeRef?: RefObject<T | null>;
  selectors?: {
    column?: string;
    title?: string;
    synopsis?: string;
    badges?: string;
  };
  resizeDebounceMs?: number;
};

const toPx = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampLines = (lines: number, maxLines: number) => Math.max(0, Math.min(lines, maxLines));

const mapsAreEqual = (a: Record<string, number>, b: Record<string, number>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => a[key] === b[key]);
};

export const useDynamicSynopsisClamp = <T extends HTMLElement = HTMLDivElement>({
  enabled,
  keys,
  maxLines = 3,
  scopeRef,
  selectors,
  resizeDebounceMs = 80,
}: UseDynamicSynopsisClampParams<T>) => {
  const internalRef = useRef<T | null>(null);
  const rootRef = scopeRef ?? internalRef;
  const frameRef = useRef<number | null>(null);
  const [lineByKey, setLineByKey] = useState<Record<string, number>>({});
  const keysHash = useMemo(() => keys.join("||"), [keys]);
  const resolvedSelectors = useMemo(
    () => ({
      column: selectors?.column || '[data-synopsis-role="column"]',
      title: selectors?.title || '[data-synopsis-role="title"]',
      synopsis: selectors?.synopsis || '[data-synopsis-role="synopsis"]',
      badges: selectors?.badges || '[data-synopsis-role="badges"]',
    }),
    [selectors?.badges, selectors?.column, selectors?.synopsis, selectors?.title],
  );

  const recalculate = useCallback(() => {
    const root = rootRef.current;
    if (!enabled || !root) {
      setLineByKey({});
      return;
    }

    const next: Record<string, number> = {};
    const columns = root.querySelectorAll<HTMLElement>(resolvedSelectors.column);
    columns.forEach((column) => {
      const key = String(column.dataset.synopsisKey || "");
      if (!key) {
        return;
      }

      const title = column.querySelector<HTMLElement>(resolvedSelectors.title);
      const synopsis = column.querySelector<HTMLElement>(resolvedSelectors.synopsis);
      const badges = column.querySelector<HTMLElement>(resolvedSelectors.badges);
      if (!title || !synopsis) {
        return;
      }

      const synopsisStyle = window.getComputedStyle(synopsis);
      const lineHeightPx = toPx(synopsisStyle.lineHeight);
      const fontSizePx = toPx(synopsisStyle.fontSize);
      const lineHeight = lineHeightPx > 0 ? lineHeightPx : fontSizePx * 1.2;
      if (!lineHeight) {
        return;
      }

      const synopsisMarginTop = toPx(synopsisStyle.marginTop);
      const availableHeight =
        column.clientHeight - title.offsetHeight - (badges?.offsetHeight || 0) - synopsisMarginTop;
      const lines = clampLines(Math.floor(availableHeight / lineHeight), maxLines);
      next[key] = lines;
    });

    setLineByKey((current) => (mapsAreEqual(current, next) ? current : next));
  }, [enabled, maxLines, resolvedSelectors.badges, resolvedSelectors.column, resolvedSelectors.synopsis, resolvedSelectors.title, rootRef]);

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(recalculate);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled, keysHash, recalculate]);

  useEffect(() => {
    if (!enabled || !rootRef.current) {
      return;
    }

    let timeoutId: number | null = null;
    const handleResize = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(recalculate, resizeDebounceMs);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    const observer = new ResizeObserver(() => recalculate());
    rootRef.current.querySelectorAll<HTMLElement>(resolvedSelectors.column).forEach((element) => {
      observer.observe(element);
    });

    recalculate();
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [enabled, keysHash, recalculate, resizeDebounceMs, resolvedSelectors.column, rootRef]);

  return {
    rootRef,
    lineByKey,
  };
};
