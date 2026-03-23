type ViewerPageLike = {
  type?: string;
  isPurchasePage?: boolean;
  spreadPairId?: string;
};

export type MangaSpreadSlot = {
  pages: number[];
  spread: boolean;
  hasBlank?: boolean;
};

const isStandalonePage = (page: ViewerPageLike | null | undefined) =>
  page?.type === "adsense" || page?.type === "purchase" || page?.isPurchasePage === true;

const getValidSpreadPairStarts = (pages: ViewerPageLike[]) => {
  const indicesByPairId = new Map<string, number[]>();

  pages.forEach((page, index) => {
    const spreadPairId = String(page?.spreadPairId || "").trim();
    if (!spreadPairId || isStandalonePage(page)) {
      return;
    }
    const bucket = indicesByPairId.get(spreadPairId) || [];
    bucket.push(index);
    indicesByPairId.set(spreadPairId, bucket);
  });

  return new Set(
    [...indicesByPairId.entries()]
      .filter(([, indices]) => indices.length === 2 && indices[1] - indices[0] === 1)
      .map(([, indices]) => indices[0]),
  );
};

export const buildMangaSpreadSlots = ({
  pages,
  spreadMode,
  firstPageSingle,
}: {
  pages: ViewerPageLike[];
  spreadMode: boolean;
  firstPageSingle: boolean;
}): MangaSpreadSlot[] => {
  if (!spreadMode) {
    return pages.map((_, index) => ({ pages: [index], spread: false }));
  }

  const slots: MangaSpreadSlot[] = [];
  const forcedPairStarts = getValidSpreadPairStarts(pages);

  let index = 0;
  if (firstPageSingle && pages.length > 0 && !forcedPairStarts.has(0)) {
    slots.push({ pages: [0], spread: true, hasBlank: true });
    index = 1;
  }

  while (index < pages.length) {
    const currentPage = pages[index];

    if (isStandalonePage(currentPage)) {
      slots.push({ pages: [index], spread: false });
      index += 1;
      continue;
    }

    if (forcedPairStarts.has(index) && index + 1 < pages.length) {
      slots.push({ pages: [index, index + 1], spread: true });
      index += 2;
      continue;
    }

    if (forcedPairStarts.has(index + 1)) {
      slots.push({ pages: [index], spread: true, hasBlank: true });
      index += 1;
      continue;
    }

    if (index + 1 < pages.length && !isStandalonePage(pages[index + 1])) {
      slots.push({ pages: [index, index + 1], spread: true });
      index += 2;
      continue;
    }

    if (index + 1 >= pages.length) {
      slots.push({ pages: [index], spread: true, hasBlank: true });
      index += 1;
      continue;
    }

    slots.push({ pages: [index], spread: false });
    index += 1;
  }

  return slots;
};
