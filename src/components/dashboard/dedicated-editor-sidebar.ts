import type { CSSProperties, RefObject } from "react";
import { useLayoutEffect, useState } from "react";

export const dedicatedEditorSidebarFallbackHeight = "34rem";

export const dedicatedEditorSidebarStickyClassName = "min-w-0 xl:sticky xl:top-24 xl:min-h-0";

export const dedicatedEditorSidebarPanelClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-editor-surface flex max-h-[var(--dedicated-editor-sidebar-height,34rem)] min-h-0 flex-col";

export const dedicatedEditorSidebarBodyClassName = "flex min-h-0 flex-1 flex-col";

export const dedicatedEditorSidebarScrollRegionClassName =
  "no-scrollbar min-h-0 flex-1 overflow-y-auto";

export type DedicatedEditorSidebarHeightStyle = CSSProperties & {
  "--dedicated-editor-sidebar-height": string;
};

export const useDedicatedEditorSidebarHeight = <ElementType extends HTMLElement>(
  measuredElementRef: RefObject<ElementType | null>,
  measurementKey?: unknown,
) => {
  const [measuredSidebarHeight, setMeasuredSidebarHeight] = useState(
    dedicatedEditorSidebarFallbackHeight,
  );

  useLayoutEffect(() => {
    const measuredElement = measuredElementRef.current;
    if (!measuredElement || typeof window === "undefined") {
      return;
    }

    let frameId = 0;
    const requestFrame =
      window.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    const updateMeasuredHeight = () => {
      frameId = 0;
      const nextHeight = Math.ceil(
        Math.max(
          measuredElement.getBoundingClientRect().height || 0,
          measuredElement.scrollHeight || 0,
        ),
      );

      if (nextHeight <= 0) {
        return;
      }

      const nextValue = `${nextHeight}px`;
      setMeasuredSidebarHeight((current) => (current === nextValue ? current : nextValue));
    };
    const scheduleMeasuredHeightUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = requestFrame(updateMeasuredHeight);
    };

    scheduleMeasuredHeightUpdate();
    window.addEventListener("resize", scheduleMeasuredHeightUpdate);

    const resizeObserver =
      typeof window.ResizeObserver === "undefined"
        ? null
        : new window.ResizeObserver(scheduleMeasuredHeightUpdate);
    resizeObserver?.observe(measuredElement);

    return () => {
      if (frameId) {
        cancelFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasuredHeightUpdate);
    };
  }, [measuredElementRef, measurementKey]);

  return measuredSidebarHeight;
};
