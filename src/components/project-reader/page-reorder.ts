import type { Transition } from "framer-motion";
import type { KeyboardEvent } from "react";

type AltArrowReorderOptions = {
  event: KeyboardEvent<HTMLElement>;
  index: number;
  total: number;
  label: string;
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

export const buildReorderAnnouncement = (label: string, targetIndex: number) =>
  `${label} movida para a posição ${targetIndex + 1}.`;

export const handleAltArrowReorder = ({
  event,
  index,
  total,
  label,
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
  onAnnounce?.(buildReorderAnnouncement(label, targetIndex));
  return true;
};
