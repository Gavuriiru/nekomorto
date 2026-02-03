export const normalizeType = (type?: string | null) => String(type || "").toLowerCase();

export const isMangaType = (type?: string | null) => {
  const label = normalizeType(type);
  return label === "manga" || label === "mangá" || label.includes("mang") || label.includes("webtoon");
};

export const isLightNovelType = (type?: string | null) => {
  const label = normalizeType(type);
  return label.includes("light") || label.includes("novel");
};

export const isChapterBasedType = (type?: string | null) =>
  isMangaType(type) || isLightNovelType(type);
