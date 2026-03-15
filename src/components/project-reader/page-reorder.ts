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

export const reorderList = <T,>(items: T[], fromIndex: number, toIndex: number) => {
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
