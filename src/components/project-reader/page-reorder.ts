import type { Transition } from "framer-motion";
import type { DragEvent, KeyboardEvent } from "react";

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
  if (
    !Number.isFinite(fromIndex) ||
    !Number.isFinite(toIndex) ||
    fromIndex === null ||
    toIndex === null
  ) {
    return items;
  }
  return reorderList(items, fromIndex, toIndex);
};

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

export const setDragPreviewFromElement = (
  event: DragEvent<HTMLElement>,
  element: HTMLElement | null,
) => {
  if (!event.dataTransfer || !element || typeof document === "undefined") {
    return;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const preview = element.cloneNode(true);
  if (!(preview instanceof HTMLElement)) {
    return;
  }

  preview.style.position = "fixed";
  preview.style.top = "-10000px";
  preview.style.left = "-10000px";
  preview.style.width = `${rect.width}px`;
  preview.style.height = `${rect.height}px`;
  preview.style.pointerEvents = "none";
  preview.style.opacity = "0.96";
  preview.style.transform = "rotate(1.5deg)";
  preview.style.zIndex = "2147483647";

  document.body.appendChild(preview);

  try {
    const offsetX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    event.dataTransfer.setDragImage(preview, offsetX, offsetY);
  } catch {
    preview.remove();
    return;
  }

  window.setTimeout(() => {
    preview.remove();
  }, 0);
};

export const buildReorderAnnouncement = (label: string, targetIndex: number) =>
  `${label} movida para a posicao ${targetIndex + 1}.`;

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

  let targetIndex = index;
  if (event.key === "ArrowUp") {
    targetIndex = index - 1;
  } else if (event.key === "ArrowDown") {
    targetIndex = index + 1;
  } else {
    return false;
  }

  if (targetIndex < 0 || targetIndex >= total || targetIndex === index) {
    return false;
  }

  event.preventDefault();
  onMove(targetIndex);
  onAnnounce?.(buildReorderAnnouncement(label, targetIndex));
  return true;
};
