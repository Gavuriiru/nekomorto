import type { Transition } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export type ReorderAnnouncementFormatter = (label: string, targetIndex: number) => string;

type AltArrowReorderOptions = {
  event: KeyboardEvent<HTMLElement>;
  index: number;
  total: number;
  label: string;
  announcementFormatter?: ReorderAnnouncementFormatter;
  disabled?: boolean;
  onMove: (targetIndex: number) => void;
  onAnnounce?: (message: string) => void;
};

export const reorderList = <T>(items: T[], fromIndex: number, toIndex: number) => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
};

export const buildPreviewReorderList = <T>(
  items: T[],
  fromIndex: number | null | undefined,
  toIndex: number | null | undefined,
) => {
  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
    return items;
  }
  return reorderList(items, Number(fromIndex), Number(toIndex));
};

export const REORDER_POINTER_DRAG_THRESHOLD = 6;

export type ReorderSurfaceRect = {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export type PointerReorderState = {
  sourceIndex: number;
  overIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  isDragging: boolean;
  isLongPressPending?: boolean;
  isLongPressActive?: boolean;
};

type PointerReorderMove = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

type PointerReorderGeometry = {
  rects: ReorderSurfaceRect[];
  itemCount: number;
};

type UsePointerReorderOptions<TElement extends HTMLElement> = {
  containerRef: RefObject<TElement | null>;
  disabled?: boolean;
  itemCount: number;
  onCommit: (fromIndex: number, toIndex: number) => void;
  scope: string;
  touchLongPressDelayMs?: number;
  touchLongPressMoveTolerance?: number;
};

export const usePointerReorder = <TElement extends HTMLElement>({
  containerRef,
  disabled = false,
  itemCount,
  onCommit,
  scope,
  touchLongPressDelayMs = 0,
  touchLongPressMoveTolerance = 48,
}: UsePointerReorderOptions<TElement>) => {
  const pointerDragStateRef = useRef<PointerReorderState | null>(null);
  const reorderGeometryRef = useRef<PointerReorderGeometry | null>(null);
  const queuedPointerMoveRef = useRef<PointerReorderMove | null>(null);
  const pointerMoveFrameRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const disabledRef = useRef(disabled);
  const onCommitRef = useRef(onCommit);
  const [pointerDragState, setPointerDragState] = useState<PointerReorderState | null>(null);

  useEffect(() => {
    disabledRef.current = disabled;
    onCommitRef.current = onCommit;
  }, [disabled, onCommit]);

  const captureReorderGeometry = useCallback(() => {
    const rects = collectReorderSurfaceRects({
      container: containerRef.current,
      scope,
    });
    const nextGeometry = {
      rects,
      itemCount,
    };
    reorderGeometryRef.current = nextGeometry;
    return nextGeometry;
  }, [containerRef, itemCount, scope]);

  const getReorderGeometry = useCallback(() => {
    const current = reorderGeometryRef.current;
    if (!current || current.itemCount !== itemCount) {
      return captureReorderGeometry();
    }
    return current;
  }, [captureReorderGeometry, itemCount]);

  const cancelLongPressTimer = useCallback(() => {
    if (
      longPressTimerRef.current !== null &&
      typeof window !== "undefined" &&
      typeof window.clearTimeout === "function"
    ) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = null;
  }, []);

  const cancelScheduledPointerMove = useCallback(() => {
    if (
      pointerMoveFrameRef.current !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(pointerMoveFrameRef.current);
    }
    pointerMoveFrameRef.current = null;
    queuedPointerMoveRef.current = null;
  }, []);

  const clearDragState = useCallback(() => {
    cancelLongPressTimer();
    cancelScheduledPointerMove();
    const current = pointerDragStateRef.current;
    if (current && pointerTargetRef.current && Number.isFinite(current.pointerId)) {
      try {
        pointerTargetRef.current.releasePointerCapture(current.pointerId);
      } catch {
        // Ignore release failures for pointers that were already cancelled.
      }
    }
    pointerDragStateRef.current = null;
    pointerTargetRef.current = null;
    reorderGeometryRef.current = null;
    setPointerDragState(null);
  }, [cancelLongPressTimer, cancelScheduledPointerMove]);

  useEffect(() => clearDragState, [clearDragState]);

  useEffect(() => {
    const clearGeometry = () => {
      reorderGeometryRef.current = null;
    };
    window.addEventListener("resize", clearGeometry);
    return () => {
      window.removeEventListener("resize", clearGeometry);
    };
  }, []);

  const applyPointerMove = useCallback(
    ({ pointerId, clientX, clientY }: PointerReorderMove) => {
      if (disabledRef.current) {
        return;
      }

      const current = pointerDragStateRef.current;
      if (!current || (Number.isFinite(pointerId) && current.pointerId !== pointerId)) {
        return;
      }

      if (current.isLongPressPending && !current.isLongPressActive) {
        if (
          hasExceededPointerDragThreshold({
            startX: current.startX,
            startY: current.startY,
            clientX,
            clientY,
            threshold: touchLongPressMoveTolerance,
          })
        ) {
          clearDragState();
          return;
        }

        const nextPendingState = {
          ...current,
          lastX: clientX,
          lastY: clientY,
        };
        pointerDragStateRef.current = nextPendingState;
        setPointerDragState(nextPendingState);
        return;
      }

      const hasDragDistance =
        current.isDragging ||
        hasExceededPointerDragThreshold({
          startX: current.startX,
          startY: current.startY,
          clientX,
          clientY,
        });
      if (!hasDragDistance) {
        return;
      }

      const geometry = getReorderGeometry();
      const resolvedIndex = resolvePointerReorderIndexFromRects({
        clientX,
        clientY,
        rects: geometry.rects,
      });
      const nextOverIndex = resolvedIndex ?? current.overIndex;

      if (current.isDragging && current.overIndex === nextOverIndex) {
        return;
      }

      const nextState = {
        ...current,
        isDragging: true,
        isLongPressPending: false,
        overIndex: nextOverIndex,
      };
      pointerDragStateRef.current = nextState;
      setPointerDragState(nextState);
    },
    [clearDragState, getReorderGeometry, touchLongPressMoveTolerance],
  );

  const schedulePointerMove = useCallback(
    (move: PointerReorderMove) => {
      queuedPointerMoveRef.current = move;

      if (pointerMoveFrameRef.current !== null) {
        return;
      }

      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        const queuedMove = queuedPointerMoveRef.current;
        queuedPointerMoveRef.current = null;
        if (queuedMove) {
          applyPointerMove(queuedMove);
        }
        return;
      }

      pointerMoveFrameRef.current = window.requestAnimationFrame(() => {
        pointerMoveFrameRef.current = null;
        const queuedMove = queuedPointerMoveRef.current;
        queuedPointerMoveRef.current = null;
        if (queuedMove) {
          applyPointerMove(queuedMove);
        }
      });
    },
    [applyPointerMove],
  );

  const finishPointerReorder = useCallback(
    (move: PointerReorderMove) => {
      cancelScheduledPointerMove();
      applyPointerMove(move);

      const currentState = pointerDragStateRef.current;
      const geometry = reorderGeometryRef.current;
      clearDragState();
      if (
        disabledRef.current ||
        !currentState ||
        (Number.isFinite(move.pointerId) && currentState.pointerId !== move.pointerId) ||
        !currentState.isDragging
      ) {
        return;
      }

      const resolvedIndex = geometry
        ? resolvePointerReorderIndexFromRects({
            clientX: move.clientX,
            clientY: move.clientY,
            rects: geometry.rects,
          })
        : null;
      const targetIndex = resolvedIndex ?? currentState.overIndex;
      if (currentState.sourceIndex === targetIndex) {
        return;
      }

      onCommitRef.current(currentState.sourceIndex, targetIndex);
    },
    [applyPointerMove, cancelScheduledPointerMove, clearDragState],
  );

  const startPointerReorder = useCallback(
    (event: ReactPointerEvent<HTMLElement>, index: number) => {
      if (disabledRef.current) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const nextState = {
        sourceIndex: index,
        overIndex: index,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        isDragging: false,
        isLongPressPending: event.pointerType === "touch" && touchLongPressDelayMs > 0,
        isLongPressActive: event.pointerType !== "touch" || touchLongPressDelayMs <= 0,
      };
      pointerDragStateRef.current = nextState;
      pointerTargetRef.current = event.currentTarget;
      setPointerDragState(nextState);

      if (nextState.isLongPressPending) {
        longPressTimerRef.current = window.setTimeout(() => {
          const current = pointerDragStateRef.current;
          if (!current || current.pointerId !== event.pointerId || disabledRef.current) {
            return;
          }
          try {
            pointerTargetRef.current?.setPointerCapture(current.pointerId);
          } catch {
            // Pointer capture can fail in older browsers or test environments.
          }
          captureReorderGeometry();
          const activeState = {
            ...current,
            startX: current.lastX,
            startY: current.lastY,
            isLongPressPending: false,
            isLongPressActive: true,
          };
          pointerDragStateRef.current = activeState;
          setPointerDragState(activeState);
          longPressTimerRef.current = null;
        }, touchLongPressDelayMs);
        return;
      }

      captureReorderGeometry();
    },
    [captureReorderGeometry, touchLongPressDelayMs],
  );

  const cancelPointerReorder = useCallback(
    (event?: ReactPointerEvent<HTMLElement> | globalThis.PointerEvent) => {
      const current = pointerDragStateRef.current;
      if (
        event &&
        current &&
        Number.isFinite(event.pointerId) &&
        current.pointerId !== event.pointerId
      ) {
        return;
      }
      clearDragState();
    },
    [clearDragState],
  );

  useEffect(() => {
    const pointerId = pointerDragState?.pointerId;
    if (!Number.isFinite(pointerId)) {
      return undefined;
    }

    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      const current = pointerDragStateRef.current;
      if (
        current &&
        current.pointerId === event.pointerId &&
        (current.isLongPressActive || current.isDragging)
      ) {
        event.preventDefault();
      }
      schedulePointerMove({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handleWindowPointerUp = (event: globalThis.PointerEvent) => {
      finishPointerReorder({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handleWindowPointerCancel = (event: globalThis.PointerEvent) => {
      cancelPointerReorder(event);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };
  }, [
    cancelPointerReorder,
    finishPointerReorder,
    pointerDragState?.pointerId,
    schedulePointerMove,
  ]);

  return {
    cancelPointerReorder,
    pointerDragState,
    startPointerReorder,
  };
};

export const hasExceededPointerDragThreshold = ({
  startX,
  startY,
  clientX,
  clientY,
  threshold = REORDER_POINTER_DRAG_THRESHOLD,
}: {
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  threshold?: number;
}) => Math.hypot(clientX - startX, clientY - startY) >= threshold;

export const getReorderLayoutTransition = (reduceMotion = false): Transition =>
  reduceMotion
    ? { duration: 0 }
    : {
        type: "spring",
        stiffness: 380,
        damping: 30,
        mass: 0.82,
      };

const decodeFileSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getPathBasename = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split(/[?#]/)[0];
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  const lastSegment = segments.at(-1) || normalized;
  return decodeFileSegment(lastSegment);
};

/**
 * Resolves the user-facing page label. The default fallback stays in Portuguese
 * because the reader/editor UI is localized for this project.
 */
export const resolvePageDisplayName = ({
  name,
  relativePath,
  imageUrl,
  fallback = "Imagem",
}: {
  name?: string | null;
  relativePath?: string | null;
  imageUrl?: string | null;
  fallback?: string;
}) =>
  getPathBasename(String(name || "")) ||
  getPathBasename(String(relativePath || "")) ||
  getPathBasename(String(imageUrl || "")) ||
  fallback;

export const collectReorderSurfaceRects = ({
  container,
  scope,
}: {
  container: HTMLElement | null;
  scope: string;
}): ReorderSurfaceRect[] => {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `[data-reorder-surface="true"][data-reorder-scope="${scope}"]`,
    ),
  )
    .map((surface) => {
      const index = Number(surface.getAttribute("data-reorder-index"));
      const rect = surface.getBoundingClientRect();
      if (!Number.isInteger(index) || index < 0 || rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return {
        index,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    })
    .filter((rect): rect is ReorderSurfaceRect => Boolean(rect))
    .sort((left, right) => left.index - right.index);
};

export const resolvePointerReorderIndexFromRects = ({
  clientX,
  clientY,
  rects,
}: {
  clientX: number;
  clientY: number;
  rects: ReorderSurfaceRect[];
}) => {
  if (!rects.length) {
    return null;
  }

  const containingRect = rects.find(
    (rect) =>
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom,
  );
  if (containingRect) {
    return containingRect.index;
  }

  let closestRect = rects[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const distance = (clientX - rect.centerX) ** 2 + (clientY - rect.centerY) ** 2;
    if (distance < closestDistance) {
      closestRect = rect;
      closestDistance = distance;
    }
  }

  return closestRect.index;
};

/**
 * Builds the live announcement text for a successful reorder action.
 * Default output is Portuguese to match the surrounding reader UI.
 */
export const buildReorderAnnouncement = (
  label: string,
  targetIndex: number,
  formatter?: ReorderAnnouncementFormatter,
) =>
  formatter ? formatter(label, targetIndex) : `${label} movida para a posição ${targetIndex + 1}.`;

export const handleAltArrowReorder = ({
  event,
  index,
  total,
  label,
  announcementFormatter,
  disabled = false,
  onMove,
  onAnnounce,
}: AltArrowReorderOptions) => {
  if (disabled || !event.altKey || event.metaKey || event.ctrlKey) {
    return false;
  }

  const targetIndex =
    event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;

  if (targetIndex === null || targetIndex < 0 || targetIndex >= total || targetIndex === index) {
    return false;
  }

  event.preventDefault();
  onMove(targetIndex);
  onAnnounce?.(buildReorderAnnouncement(label, targetIndex, announcementFormatter));
  return true;
};
