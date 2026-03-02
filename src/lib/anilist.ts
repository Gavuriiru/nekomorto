const ANI_LIST_HOSTS = new Set(["anilist.co", "www.anilist.co"]);

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;

export const parseAniListMediaId = (input: string): number | null => {
  const source = String(input || "").trim();
  if (!source) {
    return null;
  }

  if (/^\d+$/.test(source)) {
    const parsed = Number(source);
    return isPositiveInteger(parsed) ? parsed : null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(source);
  } catch {
    return null;
  }

  if (!ANI_LIST_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    return null;
  }

  const segments = parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const mediaType = segments[0]?.toLowerCase();
  if (mediaType !== "anime" && mediaType !== "manga") {
    return null;
  }

  const parsedId = Number(segments[1]);
  return isPositiveInteger(parsedId) ? parsedId : null;
};
