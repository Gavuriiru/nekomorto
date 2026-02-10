import { comparePtBr } from "@/lib/search-ranking";

export type ProjectBadgeItem = {
  key: string;
  label: string;
  variant: "outline" | "secondary";
  href?: string;
};

type PrepareProjectBadgesParams = {
  tags: string[];
  genres?: string[];
  producers?: string[];
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  maxVisible?: number;
  maxChars?: number;
  maxRowWidth?: number;
  badgeWidths?: Record<string, number>;
  overflowBadgeWidth?: number;
  gapPx?: number;
};

const normalizeLabel = (value: string) => String(value || "").replace(/\s+/g, " ").trim();

const isEligible = (label: string, maxChars: number) => {
  if (!label) {
    return false;
  }
  return Array.from(label).length <= maxChars;
};

export const prepareProjectBadges = ({
  tags,
  genres = [],
  producers = [],
  tagTranslations,
  genreTranslations,
  maxVisible = 3,
  maxChars = 18,
  maxRowWidth,
  badgeWidths,
  overflowBadgeWidth = 36,
  gapPx = 4,
}: PrepareProjectBadgesParams): {
  allItems: ProjectBadgeItem[];
  visibleItems: ProjectBadgeItem[];
  extraCount: number;
  showOverflowBadge: boolean;
} => {
  const tagItems = (Array.isArray(tags) ? tags : [])
    .filter(Boolean)
    .map((tag) => ({
      key: `tag-${tag}`,
      label: normalizeLabel(tagTranslations[tag] || tag),
      variant: "outline" as const,
      href: `/projetos?tag=${encodeURIComponent(tag)}`,
    }))
    .sort((a, b) => comparePtBr(a.label, b.label));

  const genreItems = (Array.isArray(genres) ? genres : [])
    .filter(Boolean)
    .map((genre) => ({
      key: `genre-${genre}`,
      label: normalizeLabel(genreTranslations[genre] || genre),
      variant: "outline" as const,
      href: `/projetos?genero=${encodeURIComponent(genre)}`,
    }))
    .sort((a, b) => comparePtBr(a.label, b.label));

  const producerItems = (Array.isArray(producers) ? producers : [])
    .filter(Boolean)
    .map((producer) => ({
      key: `producer-${producer}`,
      label: normalizeLabel(producer),
      variant: "outline" as const,
    }))
    .sort((a, b) => comparePtBr(a.label, b.label));

  const allItems = [...tagItems, ...genreItems, ...producerItems].filter((item) =>
    isEligible(item.label, maxChars),
  );
  const cappedItems = allItems.slice(0, Math.max(0, maxVisible));

  if (
    typeof maxRowWidth !== "number" ||
    !Number.isFinite(maxRowWidth) ||
    maxRowWidth <= 0 ||
    !badgeWidths
  ) {
    const visibleItems = cappedItems;
    const extraCount = Math.max(0, allItems.length - visibleItems.length);
    return {
      allItems,
      visibleItems,
      extraCount,
      showOverflowBadge: extraCount > 0,
    };
  }

  const maxFitCount = cappedItems.length;
  const getWidthForCount = (count: number) => {
    const visible = cappedItems.slice(0, count);
    const visibleWidth = visible.reduce((sum, item) => sum + Math.max(0, badgeWidths[item.key] || 0), 0);
    const visibleGap = count > 1 ? gapPx * (count - 1) : 0;
    const extra = Math.max(0, allItems.length - count);
    const overflowWidth = extra > 0 ? overflowBadgeWidth : 0;
    const overflowGap = extra > 0 && count > 0 ? gapPx : 0;
    return visibleWidth + visibleGap + overflowGap + overflowWidth;
  };

  let bestCount = 0;
  for (let count = 0; count <= maxFitCount; count += 1) {
    if (getWidthForCount(count) <= maxRowWidth) {
      bestCount = count;
    }
  }

  const visibleItems = cappedItems.slice(0, bestCount);
  const extraCount = Math.max(0, allItems.length - visibleItems.length);

  return {
    allItems,
    visibleItems,
    extraCount,
    showOverflowBadge: extraCount > 0,
  };
};
