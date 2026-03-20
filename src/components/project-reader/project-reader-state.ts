import { buildMangaSpreadSlots, type MangaSpreadSlot } from "@/components/project-reader/manga-spread-slots";

export type ReaderRenderablePage = {
  position: number;
  imageUrl?: string;
  spreadPairId?: string;
  type?: "page" | "purchase";
  isPurchasePage?: boolean;
};

export type ReaderVisibilityMeasurement = {
  index: number;
  start: number;
  end: number;
};

export const isPaginatedReaderLayout = (layout: string) => layout === "single" || layout === "double";

export const buildReaderDisplayPages = ({
  pages,
  previewLimit,
}: {
  pages: Array<{ position: number; imageUrl: string; spreadPairId?: string }>;
  previewLimit?: number | null;
}) => {
  const normalizedPages = pages
    .filter((page) => Boolean(page?.imageUrl))
    .map((page, index) => ({
      position: index,
      imageUrl: page.imageUrl,
      spreadPairId: page.spreadPairId,
      type: "page" as const,
    }));

  const requestedLimit =
    typeof previewLimit === "number" && Number.isFinite(previewLimit) && previewLimit > 0
      ? Math.max(1, Math.floor(previewLimit))
      : null;

  const accessiblePageCount =
    requestedLimit === null ? normalizedPages.length : Math.min(normalizedPages.length, requestedLimit);
  const hasPurchaseGate = accessiblePageCount < normalizedPages.length;

  const renderablePages: ReaderRenderablePage[] = hasPurchaseGate
    ? [
        ...normalizedPages.slice(0, accessiblePageCount),
        {
          position: accessiblePageCount,
          type: "purchase",
          isPurchasePage: true,
        },
      ]
    : normalizedPages;

  return {
    originalPages: normalizedPages,
    renderablePages,
    accessiblePageCount,
    hasPurchaseGate,
  };
};

export const buildReaderSlots = ({
  pages,
  layout,
  firstPageSingle,
}: {
  pages: ReaderRenderablePage[];
  layout: string;
  firstPageSingle: boolean;
}) => {
  if (layout === "double") {
    return buildMangaSpreadSlots({
      pages,
      spreadMode: true,
      firstPageSingle,
    });
  }

  return pages.map((_, index) => ({
    pages: [index],
    spread: false,
  })) satisfies MangaSpreadSlot[];
};

export const findSlotIndexForPage = (slots: MangaSpreadSlot[], pageIndex: number) => {
  const directIndex = slots.findIndex((slot) => slot.pages.includes(pageIndex));
  if (directIndex >= 0) {
    return directIndex;
  }
  return Math.max(0, slots.length - 1);
};

export const formatVisiblePageLabel = ({
  layout,
  activeSlotIndex,
  slots,
  activePageIndex,
  totalPages,
  accessiblePageCount,
}: {
  layout: string;
  activeSlotIndex: number;
  slots: MangaSpreadSlot[];
  activePageIndex: number;
  totalPages: number;
  accessiblePageCount: number;
}) => {
  if (totalPages <= 0) {
    return "0/0";
  }

  if (isPaginatedReaderLayout(layout)) {
    const slot = slots[activeSlotIndex] || slots[0];
    const visiblePages = (slot?.pages || [])
      .filter((pageIndex) => pageIndex < accessiblePageCount)
      .map((pageIndex) => pageIndex + 1);

    if (visiblePages.length >= 2) {
      return `${visiblePages[0]}–${visiblePages[visiblePages.length - 1]} / ${totalPages}`;
    }

    const fallbackPage = Math.min(Math.max(activePageIndex + 1, 1), accessiblePageCount || 1);
    return `${visiblePages[0] || fallbackPage}/${totalPages}`;
  }

  return `${Math.min(Math.max(activePageIndex + 1, 1), totalPages)}/${totalPages}`;
};

export const resolvePaginatedPointerAction = ({
  layout,
  direction,
  pointerRatio,
}: {
  layout: string;
  direction: "rtl" | "ltr";
  pointerRatio: number;
}) => {
  if (!isPaginatedReaderLayout(layout)) {
    return null;
  }

  const clampedRatio = Math.min(Math.max(pointerRatio, 0), 1);
  const clickedPreviousZone = clampedRatio < 0.5;

  if (direction === "rtl") {
    return clickedPreviousZone ? "next" : "previous";
  }

  return clickedPreviousZone ? "previous" : "next";
};

export const pickMostVisiblePage = ({
  measurements,
  viewportSize,
}: {
  measurements: ReaderVisibilityMeasurement[];
  viewportSize: number;
}) => {
  if (measurements.length === 0 || viewportSize <= 0) {
    return 0;
  }

  let bestIndex = measurements[0]?.index || 0;
  let bestVisible = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  measurements.forEach((measurement) => {
    const visibleSize =
      Math.max(0, Math.min(measurement.end, viewportSize) - Math.max(measurement.start, 0));
    const center = (measurement.start + measurement.end) / 2;
    const distanceToCenter = Math.abs(center - viewportSize / 2);

    if (
      visibleSize > bestVisible ||
      (visibleSize === bestVisible && distanceToCenter < bestDistance)
    ) {
      bestIndex = measurement.index;
      bestVisible = visibleSize;
      bestDistance = distanceToCenter;
    }
  });

  return bestIndex;
};

export const buildReaderPageItems = ({
  totalPages,
  accessiblePageCount,
}: {
  totalPages: number;
  accessiblePageCount: number;
}) =>
  Array.from({ length: totalPages }, (_, index) => ({
    value: String(index),
    pageNumber: index + 1,
    blocked: index >= accessiblePageCount,
    label:
      index >= accessiblePageCount ? `Página ${index + 1} (bloqueada)` : `Página ${index + 1}`,
  }));

export const getReaderVisualState = ({
  imageFit,
  background,
  progressStyle,
  progressPosition,
}: {
  imageFit: string;
  background: string;
  progressStyle: string;
  progressPosition: string;
}) => ({
  imageFit,
  background,
  progressStyle,
  progressPosition,
});
