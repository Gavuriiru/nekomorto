import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseDynamicSynopsisClampParams = {
  enabled: boolean;
  keys: string[];
  maxLines?: number;
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

export const useDynamicSynopsisClamp = ({
  enabled,
  keys,
  maxLines = 3,
}: UseDynamicSynopsisClampParams) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [lineByKey, setLineByKey] = useState<Record<string, number>>({});
  const keysHash = useMemo(() => keys.join("||"), [keys]);

  const recalculate = useCallback(() => {
    const root = rootRef.current;
    if (!enabled || !root) {
      setLineByKey({});
      return;
    }

    const next: Record<string, number> = {};
    const columns = root.querySelectorAll<HTMLElement>('[data-synopsis-role="column"]');
    columns.forEach((column) => {
      const key = String(column.dataset.synopsisKey || "");
      if (!key) {
        return;
      }

      const title = column.querySelector<HTMLElement>('[data-synopsis-role="title"]');
      const synopsis = column.querySelector<HTMLElement>('[data-synopsis-role="synopsis"]');
      const badges = column.querySelector<HTMLElement>('[data-synopsis-role="badges"]');
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
  }, [enabled, maxLines]);

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
      timeoutId = window.setTimeout(recalculate, 80);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    const observer = new ResizeObserver(() => recalculate());
    rootRef.current.querySelectorAll<HTMLElement>('[data-synopsis-role="column"]').forEach((element) => {
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
  }, [enabled, keysHash, recalculate]);

  return {
    rootRef,
    lineByKey,
  };
};
